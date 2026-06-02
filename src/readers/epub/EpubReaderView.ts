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
import { epubAnnotationDraw } from './epubAnnotationDraw';
import type { PdfHighlightStyle } from '../pdf/pdfHighlightPrefs';
import { showEpubHighlightContextMenu } from './epubContextMenu';
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

type FoliateViewEl = HTMLElement & {
  open?: (book: File | string) => Promise<void>;
  init?: (opts?: { showTextStart?: boolean }) => Promise<void>;
  close?: () => void;
  goLeft?: () => Promise<void>;
  goRight?: () => Promise<void>;
  getCFI?: (index: number, range?: Range) => string;
  addAnnotation?: (a: FoliateAnnotation) => Promise<unknown>;
  showAnnotation?: (a: FoliateAnnotation) => Promise<void>;
  renderer?: {
    getContents?: () => Array<{ index: number; doc: Document }>;
  };
};

export class EpubReaderView extends ItemView {
  plugin: ReferenceList;
  private file: TFile | null = null;
  private annotations: DocumentAnnotation[] = [];
  private zoteroAttachmentKey: string | undefined;
  private host: HTMLElement;
  private toolbar: HTMLElement;
  private foliateEl: FoliateViewEl | null = null;
  private pendingGotoCfi: string | undefined;
  private pendingSelection: EpubPendingSelection | null = null;
  private annotationStyles = new Map<string, PdfHighlightStyle>();
  private annotationOpacity = new Map<string, number>();
  private loadGeneration = 0;
  private saveDebounced: () => void;

  constructor(leaf: WorkspaceLeaf, plugin: ReferenceList) {
    super(leaf);
    this.plugin = plugin;
    this.contentEl.addClass('pwc-epub-reader');
    this.toolbar = this.contentEl.createDiv({ cls: 'pwc-epub-reader__toolbar' });
    this.host = this.contentEl.createDiv({ cls: 'pwc-epub-reader__host' });
    this.saveDebounced = debounce(() => void this.persistSidecar(), 800, true);
    this.buildToolbar();
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
    const exists = this.annotations.some(
      (a) => foliateCfiForAnnotation(this.foliateEl, a) === cfi
    );
    if (!exists) this.annotations.push(ann);
    try {
      await this.foliateEl?.addAnnotation?.({
        value: cfi,
        color: normalizeEpubHighlightColor(ann.color),
      });
    } catch (e) {
      console.warn('[PandoCit EPUB] overlay', e);
    }
    this.syncRegistry();
  }

  async onOpen(): Promise<void> {
    this.registerEvent(
      this.plugin.emitter.on('pwc-zotero-synced', () => {
        void this.reloadAnnotationsFromRegistry();
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
    const reg = readerRegistry.get();
    if (reg?.vaultPath !== this.file.path) return;
    this.annotations = [...reg.annotations];
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

  private buildToolbar(): void {
    const addBtn = (icon: string, label: string, onClick: () => void) => {
      const b = this.toolbar.createEl('button', {
        cls: 'clickable-icon',
        attr: { 'aria-label': label, title: label, type: 'button' },
      });
      setIcon(b, icon);
      b.addEventListener('click', onClick);
    };

    addBtn('chevron-left', t('Previous page'), () => {
      void this.foliateEl?.goLeft?.();
    });
    addBtn('chevron-right', t('Next page'), () => {
      void this.foliateEl?.goRight?.();
    });
    addBtn('highlighter', t('Highlight selection in EPUB'), () => {
      void createEpubHighlightFromSelection(this.plugin, this, {
        useSavedPrefs: true,
      });
    });
    addBtn('refresh-ccw', t('Reload EPUB'), () => {
      if (this.file) void this.openFile(this.file.path);
    });
  }

  private foliateAnnotationPayloads(): FoliateAnnotation[] {
    const out: FoliateAnnotation[] = [];
    const seen = new Set<string>();
    this.annotationStyles.clear();
    this.annotationOpacity.clear();
    for (const a of this.annotations) {
      const cfi = foliateCfiForAnnotation(this.foliateEl, a);
      if (!cfi?.startsWith('epubcfi(') || seen.has(cfi)) continue;
      seen.add(cfi);
      const style = (a.markupStyle ?? 'highlight') as PdfHighlightStyle;
      this.annotationStyles.set(cfi, style);
      this.annotationOpacity.set(cfi, a.opacity ?? 0.35);
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
          fn: typeof epubAnnotationDraw,
          opts?: {
            color?: string;
            opacity?: number;
            style?: PdfHighlightStyle;
          }
        ) => void;
        annotation: FoliateAnnotation;
      };
      const cfi = annotation.value;
      draw(epubAnnotationDraw, {
        color: normalizeEpubHighlightColor(annotation.color),
        style: this.annotationStyles.get(cfi) ?? 'highlight',
        opacity: this.annotationOpacity.get(cfi) ?? 0.35,
      });
    });

    view.addEventListener('create-overlay', () => {
      void this.applyAllFoliateAnnotations();
    });
  }

  private async applyAllFoliateAnnotations(): Promise<void> {
    const view = this.foliateEl;
    if (!view?.addAnnotation) return;
    for (const a of this.foliateAnnotationPayloads()) {
      try {
        await view.addAnnotation(a);
      } catch (e) {
        console.warn('[PandoCit EPUB] addAnnotation', a.value.slice(0, 48), e);
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
        if (!this.pendingSelection) return;
        e.preventDefault();
        e.stopPropagation();
        showEpubHighlightContextMenu(this.plugin, this, e);
      });
    };

    view.addEventListener('load', (ev: Event) => {
      const detail = (ev as CustomEvent).detail as
        | { doc?: Document; index?: number }
        | undefined;
      if (detail?.doc) {
        attach(detail.doc, detail.index ?? 0);
        void this.applyAllFoliateAnnotations();
        return;
      }
      const contents = view.renderer?.getContents?.() ?? [];
      for (const c of contents) attach(c.doc, c.index);
      void this.applyAllFoliateAnnotations();
    });
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

    try {
      await ensureFoliateLoaded(this.plugin);
      if (gen !== this.loadGeneration) return;

      const bytes = await this.app.vault.readBinary(f);
      if (!bytes?.byteLength) {
        throw new Error('empty epub');
      }
      const blob = new Blob([bytes], { type: 'application/epub+zip' });
      const fileObj = new File([blob], f.name, { type: 'application/epub+zip' });

      this.annotations = await readOrCreateSidecarAnnotations(f.path);
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
    if (!this.zoteroAttachmentKey) return;

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
    await saveEpubSidecar(this.file.path, sidecarOnly);
  }

  private syncRegistry(): void {
    if (!this.file) return;
    readerRegistry.set({
      kind: 'epub',
      vaultPath: this.file.path,
      annotations: [...this.annotations],
      zoteroAttachmentKey: this.zoteroAttachmentKey,
    });
    this.plugin.emitter.trigger('pwc-document-annotations-changed');
  }

  async onClose(): Promise<void> {
    this.loadGeneration++;
    this.pendingSelection = null;
    readerRegistry.set(null);
    this.foliateEl?.close?.();
    this.foliateEl = null;
  }
}
