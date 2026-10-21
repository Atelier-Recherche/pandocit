import { ItemView, Notice, TFile, WorkspaceLeaf, debounce, setIcon } from 'obsidian';

import { t } from '../../lang/helpers';
import type ReferenceList from '../../main';
import { readerRegistry } from '../readerRegistry';
import type { DocumentAnnotation } from '../../annotations/types';
import { vaultPathFromViewState } from '../documentRouter';
import { findZoteroAttachmentKeyForVaultFile } from '../pdf/zoteroAttachmentMatch';
import { readOrCreateSidecarAnnotations, saveEpubSidecar } from './epubSidecar';
import {
  cfiFromZoteroAnnotationPosition,
  lengthenEpubCfi,
  normalizeEpubHighlightColor,
} from './epubCfiBridge';
import { resolveAnnotationDisplayAppearance } from '../annotationDisplayStyle';
import { applyFoliateDarkMode } from '../readerDarkMode';
import { epubAnnotationDraw } from './epubAnnotationDraw';
import type { PdfHighlightStyle } from '../pdf/pdfHighlightPrefs';
import {
  dismissEpubContextMenu,
  getEpubAnnCfiAttr,
  showEpubHighlightContextMenu,
} from './epubContextMenu';
import { foliateCfiForAnnotation } from './epubFoliateCfi';
import { ensureFoliateLoaded } from './foliateLoader';
import { createEpubHighlightFromSelection } from './epubCreateHighlight';
import type { EpubPendingSelection } from './epubCreateHighlight';
import { zoteroAnnotationsForEpubAttachment } from './zoteroEpubAnnotations';

export const epubReaderViewType = 'pwc-epub-reader-view';

interface EpubReaderState {
  path?: string;
  file?: string;
  zoteroAttachmentKey?: string;
  gotoCfi?: string;
}

type FoliateAnnotation = { value: string; color?: string };

type FoliateTocItem = {
  id?: string;
  label?: string;
  href?: string;
  subitems?: FoliateTocItem[];
};

type FoliateLocation = {
  fraction?: number;
  section?: { current?: number; total?: number };
  location?: { current?: number; next?: number; total?: number };
  tocItem?: FoliateTocItem | null;
  pageItem?: { label?: string } | null;
};

type FoliateViewEl = HTMLElement & {
  open?: (book: File | string) => Promise<void>;
  init?: (opts?: { showTextStart?: boolean }) => Promise<void>;
  close?: () => void;
  goLeft?: () => Promise<void>;
  goRight?: () => Promise<void>;
  goTo?: (target: unknown) => Promise<void>;
  goToFraction?: (frac: number) => Promise<void>;
  getCFI?: (index: number, range?: Range) => string;
  addAnnotation?: (a: FoliateAnnotation, remove?: boolean) => Promise<unknown>;
  deleteAnnotation?: (a: FoliateAnnotation) => Promise<unknown>;
  showAnnotation?: (a: FoliateAnnotation) => Promise<void>;
  book?: {
    toc?: FoliateTocItem[];
    sections?: unknown[];
    pageList?: unknown[];
  };
  lastLocation?: FoliateLocation | null;
  renderer?: HTMLElement & {
    getContents?: () => Array<{ index: number; doc: Document }>;
    setStyles?: (css: string) => void;
    shadowRoot?: ShadowRoot | null;
  };
};

export class EpubReaderView extends ItemView {
  plugin: ReferenceList;
  private file: TFile | null = null;
  private annotations: DocumentAnnotation[] = [];
  private zoteroAttachmentKey: string | undefined;
  private bodyEl: HTMLElement;
  private railEl: HTMLElement;
  private tocPanelEl: HTMLElement;
  private tocListEl: HTMLElement;
  private host: HTMLElement;
  private toolbar: HTMLElement;
  private pageInputEl: HTMLInputElement | null = null;
  private pageTotalEl: HTMLElement | null = null;
  private tocOpen = false;
  private currentPage = 1;
  private totalPages = 1;
  private currentTocHref: string | undefined;
  private foliateEl: FoliateViewEl | null = null;
  private pendingGotoCfi: string | undefined;
  private pendingSelection: EpubPendingSelection | null = null;
  private annotationStyles = new Map<string, PdfHighlightStyle>();
  private annotationOpacity = new Map<string, number>();
  /** CFI foliate affiché → id d’annotation (clic droit sur surlignage). */
  private foliateCfiToAnnId = new Map<string, string>();
  /** Overlays actuellement posés dans foliate (pour retirer les fantômes). */
  /** CFI effectivement posés dans foliate (clés overlayer). */
  private appliedFoliateCfis = new Set<string>();
  /** CFI foliate stable par id d’annotation (évite de recalculer → fantômes). */
  private resolvedFoliateCfiByAnnId = new Map<string, string>();
  private loadGeneration = 0;
  private saveDebounced: () => void;
  private applyOverlaysQueued = false;

  constructor(leaf: WorkspaceLeaf, plugin: ReferenceList) {
    super(leaf);
    this.plugin = plugin;
    this.contentEl.addClass('pwc-epub-reader');
    this.toolbar = this.contentEl.createDiv({ cls: 'pwc-epub-reader__toolbar' });
    this.bodyEl = this.contentEl.createDiv({ cls: 'pwc-epub-reader__body' });
    this.railEl = this.bodyEl.createDiv({ cls: 'pwc-epub-reader__rail' });
    this.tocPanelEl = this.bodyEl.createDiv({
      cls: 'pwc-epub-reader__toc-panel',
    });
    this.tocPanelEl.createDiv({
      cls: 'pwc-epub-reader__toc-title',
      text: t('Table of contents'),
    });
    this.tocListEl = this.tocPanelEl.createDiv({
      cls: 'pwc-epub-reader__toc-list',
    });
    this.host = this.bodyEl.createDiv({ cls: 'pwc-epub-reader__host' });
    this.saveDebounced = debounce(() => void this.persistSidecar(), 800, true);
    this.buildRail();
    this.buildToolbar();
    this.syncTocPanelVisibility();
    this.syncReaderChrome();
  }

  getViewType(): string {
    return epubReaderViewType;
  }

  getDisplayText(): string {
    return this.file?.basename ?? t('EPUB reader');
  }

  getIcon(): string {
    return 'book-open';
  }

  getEpubFile(): TFile | null {
    return this.file;
  }

  getHostElement(): HTMLElement {
    return this.host;
  }

  getFoliateEl(): FoliateViewEl | null {
    return this.foliateEl;
  }

  getFile(): TFile | null {
    return this.file;
  }

  getAnnotations(): DocumentAnnotation[] {
    return [...this.annotations];
  }

  findAnnotationByFoliateCfi(cfi: string): DocumentAnnotation | undefined {
    const id = this.foliateCfiToAnnId.get(cfi);
    if (id) {
      const byId = this.annotations.find((a) => a.id === id);
      if (byId) return byId;
    }
    return (
      this.annotations.find((a) => a.cfi === cfi) ??
      this.annotations.find(
        (a) => !!a.cfi && (cfi.includes(a.cfi) || a.cfi.includes(cfi))
      )
    );
  }

  getZoteroAttachmentKey(): string | undefined {
    return this.zoteroAttachmentKey;
  }

  setZoteroAttachmentKey(key: string | undefined): void {
    this.zoteroAttachmentKey = key;
  }

  getPendingSelection(): EpubPendingSelection | null {
    return this.pendingSelection;
  }

  async goToAnnotation(cfi: string, ann?: DocumentAnnotation): Promise<void> {
    const value =
      (ann && foliateCfiForAnnotation(this.foliateEl, ann)) ||
      lengthenEpubCfi(cfiFromZoteroAnnotationPosition(cfi) ?? cfi.trim());
    if (!value.startsWith('epubcfi(')) return;
    if (this.foliateEl?.showAnnotation) {
      try {
        await this.foliateEl.showAnnotation({ value });
      } catch (e) {
        console.warn('[PandoCit EPUB] goto CFI', e);
      }
      return;
    }
    this.pendingGotoCfi = value;
  }

  clearPendingSelection(): void {
    this.pendingSelection = null;
    const contents = this.foliateEl?.renderer?.getContents?.() ?? [];
    for (const { doc } of contents) {
      doc.getSelection?.()?.removeAllRanges();
    }
  }

  async addAnnotationFromPlugin(ann: DocumentAnnotation): Promise<void> {
    const cfi = foliateCfiForAnnotation(this.foliateEl, ann);
    if (!cfi) return;
    const exists = this.annotations.some((a) => a.id === ann.id);
    if (!exists) this.annotations.push(ann);
    this.resolvedFoliateCfiByAnnId.set(ann.id, cfi);
    try {
      await this.foliateEl?.addAnnotation?.({
        value: cfi,
        color: normalizeEpubHighlightColor(ann.color),
      });
      this.appliedFoliateCfis.add(cfi);
    } catch (e) {
      console.warn('[PandoCit EPUB] overlay', e);
    }
    this.syncRegistry();
  }

  async onOpen(): Promise<void> {
    this.registerEvent(
      this.plugin.emitter.on('pwc-zotero-synced', () => {
        // Recharger depuis le snapshot Zotero (pas seulement le registry en mémoire).
        if (this.file) {
          void import('./epubReaderRefresh').then(({ refreshEpubReaderAnnotations }) =>
            refreshEpubReaderAnnotations(this.plugin, this.file!.path)
          );
        }
      })
    );
    await this.loadFromStateOrActiveFile();
  }

  async setState(state: EpubReaderState, result: unknown): Promise<void> {
    await super.setState(state, result);
    const path = vaultPathFromViewState(state);
    const goto = state?.gotoCfi?.trim();

    if (path && path === this.file?.path && this.foliateEl) {
      if (goto && this.foliateEl.showAnnotation) {
        try {
          await this.foliateEl.showAnnotation({ value: goto });
        } catch (e) {
          console.warn('[PandoCit EPUB] goto CFI', e);
        }
      }
      return;
    }

    await this.loadFromStateOrActiveFile(state);
  }

  getState(): EpubReaderState {
    return {
      path: this.file?.path,
      file: this.file?.path,
      zoteroAttachmentKey: this.zoteroAttachmentKey,
    };
  }

  reloadAnnotationsFromRegistry(): void {
    if (!this.file || !this.foliateEl) return;
    const reg = readerRegistry.get(this.file.path);
    if (!reg) return;
    this.annotations = [...reg.annotations];
    // Invalider les CFI des annotations disparues ; garder le cache pour le reste.
    const keep = new Set(this.annotations.map((a) => a.id));
    for (const id of [...this.resolvedFoliateCfiByAnnId.keys()]) {
      if (!keep.has(id)) this.resolvedFoliateCfiByAnnId.delete(id);
    }
    void this.applyAllFoliateAnnotations();
  }

  private resolveVaultPath(state?: EpubReaderState): string | null {
    const fromState =
      vaultPathFromViewState(state) ??
      vaultPathFromViewState(this.leaf.getViewState().state);
    if (fromState?.toLowerCase().endsWith('.epub')) return fromState;

    const active = this.app.workspace.getActiveFile();
    if (active?.extension.toLowerCase() === 'epub') return active.path;
    if (this.file?.path) return this.file.path;
    return null;
  }

  private async loadFromStateOrActiveFile(state?: EpubReaderState): Promise<void> {
    const path = this.resolveVaultPath(state);
    if (!path) {
      this.host.empty();
      this.host.createDiv({
        cls: 'pane-empty',
        text: t('Open an EPUB file from the vault.'),
      });
      return;
    }
    await this.openFile(path, state);
  }

  private buildRail(): void {
    this.railEl.empty();
    const tocBtn = this.railEl.createEl('button', {
      cls: `clickable-icon pwc-epub-reader__toc-toggle${
        this.tocOpen ? ' is-active' : ''
      }`,
      attr: {
        type: 'button',
        'aria-label': t('Table of contents'),
        title: t('Table of contents'),
      },
    });
    setIcon(tocBtn, 'list');
    tocBtn.addEventListener('click', () => {
      this.tocOpen = !this.tocOpen;
      this.syncTocPanelVisibility();
      this.buildRail();
    });
  }

  private syncTocPanelVisibility(): void {
    this.tocPanelEl.toggleClass('is-open', this.tocOpen);
  }

  private buildToolbar(): void {
    this.toolbar.empty();
    this.pageInputEl = null;
    this.pageTotalEl = null;
    const addBtn = (
      icon: string,
      label: string,
      onClick: () => void,
      opts?: { active?: boolean; cls?: string }
    ) => {
      const b = this.toolbar.createEl('button', {
        cls: `clickable-icon${opts?.cls ? ` ${opts.cls}` : ''}${
          opts?.active ? ' is-active' : ''
        }`,
        attr: { 'aria-label': label, title: label, type: 'button' },
      });
      setIcon(b, icon);
      b.addEventListener('click', onClick);
      return b;
    };

    addBtn('chevron-left', t('Previous page'), () => {
      void this.foliateEl?.goLeft?.();
    });
    addBtn('chevron-right', t('Next page'), () => {
      void this.foliateEl?.goRight?.();
    });

    const pageWrap = this.toolbar.createDiv({
      cls: 'pwc-epub-reader__page-numbers',
    });
    this.pageInputEl = pageWrap.createEl('input', {
      cls: 'pwc-epub-reader__page-input',
      type: 'number',
      attr: {
        min: '1',
        'aria-label': t('Go to page'),
        title: t('Go to page'),
      },
    });
    this.pageInputEl.value = String(this.currentPage);
    this.pageInputEl.addEventListener('change', () => {
      void this.goToPageFromInput();
    });
    this.pageInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void this.goToPageFromInput();
      }
    });
    pageWrap.createSpan({ text: ' / ' });
    this.pageTotalEl = pageWrap.createSpan({
      cls: 'pwc-epub-reader__page-total',
      text: String(this.totalPages),
    });

    addBtn('book-up', t('Reload EPUB'), () => {
      if (this.file) void this.openFile(this.file.path);
    });
    addBtn('highlighter', t('Highlight selection in EPUB'), () => {
      void createEpubHighlightFromSelection(this.plugin, this, {
        useSavedPrefs: true,
      });
    });
    addBtn(
      'palette',
      t('Toggle annotation restyle'),
      () => {
        this.plugin.settings.annotationRestyleEnabled =
          this.plugin.settings.annotationRestyleEnabled === false;
        void this.plugin.saveSettings();
        this.buildToolbar();
        void this.runApplyFoliateAnnotationsSerialized();
      },
      {
        active: this.plugin.settings.annotationRestyleEnabled !== false,
        cls: 'pwc-reader-restyle-btn',
      }
    );
    addBtn(
      this.plugin.settings.readerDarkMode ? 'sun' : 'moon',
      t('Toggle reader dark mode'),
      () => {
        this.plugin.settings.readerDarkMode = !this.plugin.settings.readerDarkMode;
        void this.plugin.saveSettings();
        this.syncReaderChrome();
        this.buildToolbar();
        void this.runApplyFoliateAnnotationsSerialized();
        window.setTimeout(() => this.syncReaderChrome(), 50);
        window.setTimeout(() => this.syncReaderChrome(), 250);
      },
      {
        active: !!this.plugin.settings.readerDarkMode,
        cls: 'pwc-reader-dark-btn',
      }
    );
    addBtn('refresh-cw', t('Resync document annotations'), () => {
      if (!this.file) return;
      void import('./epubReaderRefresh').then(({ refreshEpubReaderAnnotations }) =>
        refreshEpubReaderAnnotations(this.plugin, this.file!.path, {
          syncRemote: true,
        })
      );
    });
  }

  private async goToPageFromInput(): Promise<void> {
    const view = this.foliateEl;
    if (!view || !this.pageInputEl) return;
    const raw = Number(this.pageInputEl.value);
    if (!Number.isFinite(raw)) return;
    const page = Math.min(this.totalPages, Math.max(1, Math.floor(raw)));
    this.pageInputEl.value = String(page);
    if (view.goToFraction && this.totalPages > 1) {
      const frac = (page - 1) / this.totalPages;
      try {
        await view.goToFraction(Math.min(0.999999, Math.max(0, frac)));
      } catch (e) {
        console.warn('[PandoCit EPUB] goToFraction', e);
      }
      return;
    }
    if (view.goTo) {
      try {
        await view.goTo(page - 1);
      } catch (e) {
        console.warn('[PandoCit EPUB] goTo page', e);
      }
    }
  }

  private updatePageUi(loc?: FoliateLocation | null): void {
    const location = loc ?? this.foliateEl?.lastLocation ?? null;
    const pageLabel = location?.pageItem?.label?.trim();
    if (pageLabel && /^\d+$/.test(pageLabel)) {
      this.currentPage = Math.max(1, parseInt(pageLabel, 10));
    } else if (location?.location?.current != null) {
      this.currentPage = Math.max(1, (location.location.current ?? 0) + 1);
      this.totalPages = Math.max(
        1,
        location.location.total ?? this.totalPages
      );
    } else if (location?.section?.current != null) {
      this.currentPage = Math.max(1, (location.section.current ?? 0) + 1);
      this.totalPages = Math.max(
        1,
        location.section.total ?? this.totalPages
      );
    }
    if (location?.location?.total != null) {
      this.totalPages = Math.max(1, location.location.total);
    }
    if (this.pageInputEl && document.activeElement !== this.pageInputEl) {
      this.pageInputEl.value = String(this.currentPage);
      this.pageInputEl.max = String(this.totalPages);
    }
    if (this.pageTotalEl) this.pageTotalEl.setText(String(this.totalPages));

    const href = location?.tocItem?.href;
    if (href !== this.currentTocHref) {
      this.currentTocHref = href;
      this.highlightActiveTocItem();
    }
  }

  private rebuildToc(): void {
    this.tocListEl.empty();
    const toc = this.foliateEl?.book?.toc ?? [];
    if (!toc.length) {
      this.tocListEl.createDiv({
        cls: 'pane-empty',
        text: t('No table of contents'),
      });
      return;
    }
    const renderItems = (items: FoliateTocItem[], depth: number) => {
      for (const item of items) {
        const row = this.tocListEl.createDiv({
          cls: 'pwc-epub-reader__toc-item',
          attr: { 'data-depth': String(depth) },
        });
        if (item.href) row.dataset.href = item.href;
        row.createSpan({ text: item.label?.trim() || '—' });
        if (item.href) {
          row.addClass('is-clickable');
          row.addEventListener('click', () => {
            void this.foliateEl?.goTo?.(item.href);
          });
        }
        if (item.subitems?.length) renderItems(item.subitems, depth + 1);
      }
    };
    renderItems(toc, 0);
    this.highlightActiveTocItem();
  }

  private highlightActiveTocItem(): void {
    const href = this.currentTocHref;
    this.tocListEl
      .querySelectorAll('.pwc-epub-reader__toc-item.is-active')
      .forEach((el) => el.removeClass('is-active'));
    if (!href) return;
    const match = Array.from(
      this.tocListEl.querySelectorAll<HTMLElement>('.pwc-epub-reader__toc-item')
    ).find((el) => el.dataset.href === href);
    match?.addClass('is-active');
    match?.scrollIntoView({ block: 'nearest' });
  }

  private syncReaderChrome(): void {
    const dark = !!this.plugin.settings.readerDarkMode;
    this.contentEl.toggleClass('pwc-epub-reader--dark', dark);
    this.applyFoliateThemeStyles();
  }

  private applyFoliateThemeStyles(): void {
    const dark = !!this.plugin.settings.readerDarkMode;
    applyFoliateDarkMode(this.foliateEl, dark);
  }

  private foliateAnnotationPayloads(): FoliateAnnotation[] {
    const out: FoliateAnnotation[] = [];
    const seen = new Set<string>();
    this.annotationStyles.clear();
    this.annotationOpacity.clear();
    this.foliateCfiToAnnId.clear();
    for (const a of this.annotations) {
      let cfi = this.resolvedFoliateCfiByAnnId.get(a.id);
      if (!cfi?.startsWith('epubcfi(')) {
        cfi = foliateCfiForAnnotation(this.foliateEl, a);
        if (cfi?.startsWith('epubcfi(')) {
          this.resolvedFoliateCfiByAnnId.set(a.id, cfi);
        }
      }
      if (!cfi?.startsWith('epubcfi(') || seen.has(cfi)) continue;
      seen.add(cfi);
      const style = (a.markupStyle ?? 'highlight') as PdfHighlightStyle;
      this.annotationStyles.set(cfi, style);
      this.annotationOpacity.set(cfi, a.opacity ?? 0.35);
      this.foliateCfiToAnnId.set(cfi, a.id);
      out.push({
        value: cfi,
        color: normalizeEpubHighlightColor(a.color),
      });
    }
    return out;
  }

  private wireFoliateAnnotationRendering(view: FoliateViewEl): void {
    view.addEventListener('draw-annotation', (ev: Event) => {
      const { draw, annotation } = (ev as CustomEvent).detail as {
        draw: (
          fn: (
            rects: Parameters<typeof epubAnnotationDraw>[0],
            opts?: Parameters<typeof epubAnnotationDraw>[1]
          ) => SVGGElement,
          opts?: {
            color?: string;
            opacity?: number;
            style?: PdfHighlightStyle;
          }
        ) => void;
        annotation: FoliateAnnotation;
      };
      const cfi = annotation.value;
      const attr = getEpubAnnCfiAttr();
      draw((rects, drawOpts) => {
        try {
          const storedColor = normalizeEpubHighlightColor(
            drawOpts?.color ?? annotation.color
          );
          // Style stocké : map locale, pas opts Foliate (souvent absents).
          const storedStyle =
            this.annotationStyles.get(cfi) ??
            drawOpts?.style ??
            'highlight';
          const storedOpacity =
            this.annotationOpacity.get(cfi) ??
            drawOpts?.opacity ??
            0.35;
          const appearance = resolveAnnotationDisplayAppearance({
            color: storedColor,
            markupStyle: storedStyle,
            opacity: storedOpacity,
            restyleEnabled:
              this.plugin.settings.annotationRestyleEnabled !== false,
            readerDarkMode: !!this.plugin.settings.readerDarkMode,
            restyleColor:
              this.plugin.settings.annotationRestyleBlackColor?.trim() ||
              '#ffd400',
            restyleStyle: this.plugin.settings.annotationRestyleStyle,
          });
          const g = epubAnnotationDraw(rects, {
            color: appearance.displayColor,
            style: appearance.displayStyle,
            opacity: appearance.opacity,
            blendMode: appearance.blendMode,
          });
          g.setAttribute(attr, cfi);
          g.setCssStyles({
            pointerEvents: 'visiblePainted',
            cursor: 'context-menu',
          });
          return g;
        } catch (e) {
          console.warn('[PandoCit EPUB] draw-annotation', e);
          return epubAnnotationDraw(rects, {
            color: normalizeEpubHighlightColor(annotation.color),
          });
        }
      });
    });

    view.addEventListener('load', () => {
      this.applyFoliateThemeStyles();
      this.scheduleApplyFoliateAnnotations();
    });

    view.addEventListener('create-overlay', () => {
      this.applyFoliateThemeStyles();
      // Nouvelle couche vide pour une section : reposer les overlays (CFI stables).
      this.scheduleApplyFoliateAnnotations();
    });

    view.addEventListener('relocate', ((e: CustomEvent<FoliateLocation>) => {
      this.updatePageUi(e.detail ?? view.lastLocation);
    }) as EventListener);
  }

  private scheduleApplyFoliateAnnotations(): void {
    if (this.applyOverlaysQueued) return;
    this.applyOverlaysQueued = true;
    window.requestAnimationFrame(() => {
      this.applyOverlaysQueued = false;
      void this.runApplyFoliateAnnotationsSerialized();
    });
  }

  private applyOverlaysRunning = false;
  private applyOverlaysRerun = false;

  private async runApplyFoliateAnnotationsSerialized(): Promise<void> {
    if (this.applyOverlaysRunning) {
      this.applyOverlaysRerun = true;
      return;
    }
    this.applyOverlaysRunning = true;
    try {
      do {
        this.applyOverlaysRerun = false;
        await this.applyAllFoliateAnnotations();
      } while (this.applyOverlaysRerun);
    } finally {
      this.applyOverlaysRunning = false;
    }
  }

  private async applyAllFoliateAnnotations(): Promise<void> {
    const view = this.foliateEl;
    if (!view?.addAnnotation) return;
    const payloads = this.foliateAnnotationPayloads();
    const next = new Set(payloads.map((p) => p.value));

    // Toujours retirer tous les CFI déjà posés (même s’ils restent dans next) :
    // sinon un CFI recalculé ou un create-overlay laisse des fantômes.
    const toRemove = [...this.appliedFoliateCfis];
    for (const old of toRemove) {
      try {
        if (view.deleteAnnotation) {
          await view.deleteAnnotation({ value: old });
        } else {
          await view.addAnnotation({ value: old }, true);
        }
      } catch (e) {
        console.warn('[PandoCit EPUB] deleteAnnotation', old.slice(0, 48), e);
      }
    }
    this.appliedFoliateCfis.clear();

    let ok = 0;
    for (const a of payloads) {
      try {
        await view.addAnnotation(a);
        this.appliedFoliateCfis.add(a.value);
        ok++;
      } catch (e) {
        console.warn('[PandoCit EPUB] addAnnotation', a.value.slice(0, 64), e);
      }
    }
  }

  private captureSelection(doc: Document, index: number): void {
    const sel = doc.getSelection?.();
    const text = sel?.toString().trim();
    if (!text || text.length < 2) {
      return;
    }
    const view = this.foliateEl;
    if (!view?.getCFI) return;
    try {
      const range = sel && sel.rangeCount ? sel.getRangeAt(0) : undefined;
      const cfi = range ? view.getCFI(index, range) : undefined;
      if (!cfi?.startsWith('epubcfi(')) return;
      this.pendingSelection = {
        text,
        cfi,
        sectionIndex: index,
      };
    } catch (e) {
      console.warn('[PandoCit EPUB] capture selection', e);
    }
  }

  private attachSelectionHandlers(): void {
    const view = this.foliateEl;
    if (!view) return;

    const attach = (doc: Document, index: number) => {
      if ((doc as Document & { __pwcEpubSel?: boolean }).__pwcEpubSel) return;
      (doc as Document & { __pwcEpubSel?: boolean }).__pwcEpubSel = true;
      doc.addEventListener('mouseup', () => {
        this.captureSelection(doc, index);
      });
      doc.addEventListener('contextmenu', (e) => {
        this.captureSelection(doc, index);
        e.preventDefault();
        e.stopPropagation();
        showEpubHighlightContextMenu(this.plugin, this, e);
      });
      // Clic ailleurs dans l’iframe : fermer le menu (Obsidian n’entend pas ces events).
      doc.addEventListener(
        'pointerdown',
        () => {
          dismissEpubContextMenu();
        },
        true
      );
      // Raccourcis Obsidian (Ctrl/Cmd+P, etc.) : l’iframe ne les remonte pas toute seule.
      doc.addEventListener('keydown', (e) => this.forwardHotkeyFromIframe(e), true);
    };

    view.addEventListener('load', (ev: Event) => {
      const detail = (ev as CustomEvent).detail as
        | { doc?: Document; index?: number }
        | undefined;
      if (detail?.doc) {
        attach(detail.doc, detail.index ?? 0);
        this.scheduleApplyFoliateAnnotations();
        return;
      }
      const contents = view.renderer?.getContents?.() ?? [];
      for (const c of contents) attach(c.doc, c.index);
      this.scheduleApplyFoliateAnnotations();
    });
  }

  /**
   * Les iframes foliate mangent les raccourcis : on résout la commande Obsidian
   * via HotkeyManager et on l’exécute (les KeyboardEvent synthétiques sont ignorés).
   */
  private forwardHotkeyFromIframe(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.isComposing) return;
    const t = e.target;
    if (
      t instanceof HTMLElement &&
      (t.tagName === 'INPUT' ||
        t.tagName === 'TEXTAREA' ||
        t.isContentEditable)
    ) {
      return;
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey) return;

    const cmdId = this.findCommandIdForKeyboardEvent(e);
    if (!cmdId) return;
    e.preventDefault();
    e.stopPropagation();
    void this.app.commands.executeCommandById(cmdId);
  }

  private findCommandIdForKeyboardEvent(e: KeyboardEvent): string | null {
    const keyRaw = e.key;
    const key =
      keyRaw.length === 1 ? keyRaw.toLowerCase() : keyRaw;
    const wantMod = e.ctrlKey || e.metaKey;
    const wantShift = e.shiftKey;
    const wantAlt = e.altKey;

    const hm = this.app.hotkeyManager as {
      getHotkeys?: (
        id: string
      ) => Array<{ modifiers: string[]; key: string }> | undefined;
      getDefaultHotkeys?: (
        id: string
      ) => Array<{ modifiers: string[]; key: string }> | undefined;
    };

    if (!hm?.getHotkeys) {
      if (wantMod && !wantShift && !wantAlt && key === 'p') {
        return 'command-palette:open';
      }
      return null;
    }

    const matches = (
      hk: { modifiers: string[]; key: string } | undefined
    ): boolean => {
      if (!hk?.key) return false;
      const hkKey = hk.key.length === 1 ? hk.key.toLowerCase() : hk.key;
      if (
        hkKey !== key &&
        hk.key !== keyRaw &&
        hk.key !== e.code &&
        hk.key.toLowerCase() !== e.code.toLowerCase()
      ) {
        return false;
      }
      const mods = new Set(
        (hk.modifiers ?? []).map((m) => String(m).toLowerCase())
      );
      const needMod =
        mods.has('mod') || mods.has('ctrl') || mods.has('meta');
      const needShift = mods.has('shift');
      const needAlt = mods.has('alt');
      return (
        needMod === wantMod &&
        needShift === wantShift &&
        needAlt === wantAlt
      );
    };

    for (const id of Object.keys(this.app.commands.commands)) {
      const list = [
        ...(hm.getHotkeys(id) ?? []),
        ...(hm.getDefaultHotkeys?.(id) ?? []),
      ];
      if (list.some(matches)) return id;
    }
    return null;
  }

  private async openFile(
    vaultPath: string,
    state?: EpubReaderState
  ): Promise<void> {
    if (!vaultPath.toLowerCase().endsWith('.epub')) return;

    const f = this.app.vault.getAbstractFileByPath(vaultPath);
    if (!(f instanceof TFile)) {
      new Notice(t('EPUB not found in vault'));
      return;
    }

    const gen = ++this.loadGeneration;
    this.file = f;
    this.pendingGotoCfi = state?.gotoCfi?.trim() || undefined;
    if (state?.zoteroAttachmentKey) {
      this.zoteroAttachmentKey = state.zoteroAttachmentKey;
    }

    this.foliateEl?.close?.();
    this.foliateEl = null;
    this.appliedFoliateCfis.clear();
    this.resolvedFoliateCfiByAnnId.clear();

    try {
      await ensureFoliateLoaded(this.plugin);
      if (gen !== this.loadGeneration) return;

      const bytes = await this.app.vault.readBinary(f);
      if (!bytes?.byteLength) {
        throw new Error('empty epub');
      }
      const blob = new Blob([bytes], { type: 'application/epub+zip' });
      const fileObj = new File([blob], f.name, { type: 'application/epub+zip' });

      this.annotations = await readOrCreateSidecarAnnotations(this.app, f.path);
      await this.mergeZoteroAnnotations();
      if (gen !== this.loadGeneration) return;

      this.host.empty();
      const el = document.createElement('foliate-view') as FoliateViewEl;
      el.classList.add('pwc-epub-reader__view');
      this.host.appendChild(el);
      this.foliateEl = el;

      this.wireFoliateAnnotationRendering(el);
      this.attachSelectionHandlers();

      if (typeof el.open !== 'function') {
        throw new Error('foliate-view missing open()');
      }
      await el.open(fileObj);
      if (gen !== this.loadGeneration) return;
      if (typeof el.init === 'function') await el.init({ showTextStart: true });
      this.rebuildToc();
      this.updatePageUi(el.lastLocation);
      this.syncReaderChrome();
      // Foliate finit de monter l’iframe après open/init.
      window.requestAnimationFrame(() => {
        if (gen !== this.loadGeneration) return;
        this.syncReaderChrome();
        this.updatePageUi(el.lastLocation);
      });
      window.setTimeout(() => {
        if (gen !== this.loadGeneration) return;
        this.syncReaderChrome();
        this.updatePageUi(el.lastLocation);
      }, 200);

      await this.applyAllFoliateAnnotations();

      const goto = this.pendingGotoCfi;
      this.pendingGotoCfi = undefined;
      if (goto && el.showAnnotation) {
        try {
          await el.showAnnotation({ value: goto });
        } catch (e) {
          console.warn('[PandoCit EPUB] goto CFI', e);
        }
      }

      this.syncRegistry();
    } catch (e) {
      if (gen !== this.loadGeneration) return;
      const msg = String((e as { message?: unknown })?.message ?? e ?? '');
      if (!msg.includes('File type not supported')) {
        console.error('[PandoCit EPUB]', e);
      }
      this.host.empty();
      this.host.createDiv({
        cls: 'pane-empty',
        text: t('EPUB reader failed to initialize'),
      });
    }
  }

  private async mergeZoteroAnnotations(): Promise<void> {
    if (!this.plugin.settings.pullFromZoteroApi || !this.file) return;

    if (!this.zoteroAttachmentKey) {
      this.zoteroAttachmentKey = await findZoteroAttachmentKeyForVaultFile(
        this.plugin,
        this.file
      );
    }
    if (!this.zoteroAttachmentKey) {
      return;
    }

    const snap = await this.plugin.zoteroSync.loadSnapshot();
    const zot = zoteroAnnotationsForEpubAttachment(
      snap,
      this.zoteroAttachmentKey
    );
    const ids = new Set(this.annotations.map((a) => a.id));
    for (const a of zot) {
      if (!ids.has(a.id)) this.annotations.push(a);
    }
  }

  private async persistSidecar(): Promise<void> {
    if (!this.file) return;
    const sidecarOnly = this.annotations.filter((a) => a.source === 'sidecar');
    await saveEpubSidecar(this.app, this.file.path, sidecarOnly);
  }

  private syncRegistry(): void {
    if (!this.file) return;
    readerRegistry.upsert({
      kind: 'epub',
      vaultPath: this.file.path,
      annotations: [...this.annotations],
      zoteroAttachmentKey: this.zoteroAttachmentKey,
    });
    readerRegistry.setActive(this.file.path);
    this.plugin.emitter.trigger('pwc-document-annotations-changed');
  }

  async onClose(): Promise<void> {
    this.loadGeneration++;
    this.pendingSelection = null;
    this.appliedFoliateCfis.clear();
    this.resolvedFoliateCfiByAnnId.clear();
    if (this.file?.path) readerRegistry.remove(this.file.path);
    this.foliateEl?.close?.();
    this.foliateEl = null;
  }
}
