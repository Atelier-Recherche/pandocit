import { Modal, Notice, Setting } from 'obsidian';



import { t } from '../../lang/helpers';

import type ReferenceList from '../../main';

import type { DocumentAnnotation } from '../../annotations/types';

import type { PdfHighlightPrefs, PdfHighlightStyle } from '../pdf/pdfHighlightPrefs';

import { findZoteroAttachmentKeyForVaultFile } from '../pdf/zoteroAttachmentMatch';

import { normalizeEpubHighlightColor } from './epubCfiBridge';

import { pushEpubAnnotationToZotero } from './zoteroEpubAnnotations';

import { saveEpubSidecar, readOrCreateSidecarAnnotations } from './epubSidecar';

import { refreshEpubReaderAnnotations } from './epubReaderRefresh';

import {

  epubPrefsSummaryLabel,

  getEpubHighlightPrefs,

  saveEpubHighlightPrefs,

} from './epubHighlightPrefs';

import type { EpubReaderView } from './EpubReaderView';
import { resolveZoteroEpubPosition } from './epubZoteroPosition';



export interface EpubPendingSelection {
  text: string;
  /** CFI foliate (affichage Obsidian). */
  cfi: string;
  /** CFI epub.js (lecteur Zotero). */
  zoteroCfi?: string;
  zoteroSortIndex?: string;
  sectionIndex: number;
}



export interface CreateEpubHighlightOptions {

  useSavedPrefs?: boolean;

  showModal?: boolean;

}



class EpubHighlightModal extends Modal {

  private color: string;

  private commentEl: HTMLTextAreaElement | null = null;

  private opacity: number;

  private style: PdfHighlightStyle;

  private target: PdfHighlightPrefs['target'];

  private done = false;



  constructor(

    app: ReferenceList['app'],

    initial: PdfHighlightPrefs,

    private onSubmit: (value: (PdfHighlightPrefs & { comment: string }) | null) => void

  ) {

    super(app);

    this.color = initial.color;

    this.opacity = initial.opacity;

    this.style = initial.style;

    this.target = initial.target;

  }



  onOpen(): void {

    const { contentEl } = this;

    contentEl.empty();

    contentEl.addClass('pwc-pdf-comment-modal');



    contentEl.createEl('h3', { text: t('EPUB highlight modal title') });



    new Setting(contentEl)

      .setName(t('Color'))

      .addColorPicker((cp) => {

        cp.setValue(this.color).onChange((v) => {

          this.color = v;

        });

      });

    new Setting(contentEl)

      .setName(t('Highlight opacity label'))

      .setDesc(t('Highlight opacity desc'))

      .addSlider((sl) => {

        sl.setLimits(10, 90, 5)

          .setValue(Math.round((1 - this.opacity) * 100))

          .setDynamicTooltip()

          .onChange((v) => {

            this.opacity = 1 - v / 100;

          });

      });

    new Setting(contentEl)

      .setName(t('Highlight style label'))

      .addDropdown((dd) => {

        dd.addOption('highlight', t('Highlight style highlight'))

          .addOption('underline', t('Highlight style underline'))

          .addOption('strikeout', t('Highlight style strikeout'))

          .addOption('squiggly', t('Highlight style squiggly'));

        dd.setValue(this.style).onChange((v) => {

          this.style = v as PdfHighlightStyle;

        });

      });

    new Setting(contentEl)

      .setName(t('Highlight save target'))

      .setDesc(t('EPUB highlight target hint'))

      .addDropdown((dd) => {

        dd.addOption('both', t('Highlight target both epub'))

          .addOption('pdf', t('Highlight target sidecar'))

          .addOption('zotero', t('Highlight target zotero'));

        dd.setValue(this.target).onChange((v) => {

          this.target = v as PdfHighlightPrefs['target'];

        });

      });



    const ta = contentEl.createEl('textarea', {

      cls: 'pwc-pdf-comment-textarea',

    });

    ta.placeholder = t('Optional comment placeholder');

    ta.rows = 4;

    ta.spellcheck = true;

    ta.addEventListener('keydown', (e) => e.stopPropagation());

    ta.addEventListener('keypress', (e) => e.stopPropagation());

    ta.addEventListener('mousedown', (e) => e.stopPropagation());

    this.commentEl = ta;



    const row = contentEl.createDiv({ cls: 'pwc-open-mode-modal__row' });

    row

      .createEl('button', { text: t('Save highlight'), cls: 'mod-cta' })

      .addEventListener('click', () => {

        this.done = true;

        this.onSubmit({

          comment: (this.commentEl?.value ?? '').trim(),

          style: this.style,

          target: this.target,

          color: this.color,

          opacity: this.opacity,

        });

        this.close();

      });

    row.createEl('button', { text: t('Cancel') }).addEventListener('click', () => {

      this.close();

    });

    window.setTimeout(() => ta.focus(), 80);

  }



  onClose(): void {

    if (!this.done) this.onSubmit(null);

    this.contentEl.empty();

  }

}



class EpubQuickHighlightModal extends Modal {

  private commentEl: HTMLTextAreaElement | null = null;

  private done = false;



  constructor(

    app: ReferenceList['app'],

    private prefs: PdfHighlightPrefs,

    private onSubmit: (value: (PdfHighlightPrefs & { comment: string }) | null) => void

  ) {

    super(app);

  }



  onOpen(): void {

    const { contentEl } = this;

    contentEl.empty();

    contentEl.addClass('pwc-pdf-comment-modal');

    contentEl.addClass('pwc-pdf-comment-modal--quick');



    contentEl.createEl('h3', { text: t('Highlight quick modal title') });

    contentEl.createEl('p', {

      cls: 'pwc-pdf-comment-modal__prefs',

      text: `${epubPrefsSummaryLabel(this.prefs)} · ${this.prefs.color}`,

    });

    contentEl.createEl('p', {

      cls: 'pwc-pdf-comment-modal__hint',

      text: t('Highlight quick modal hint'),

    });



    const ta = contentEl.createEl('textarea', {

      cls: 'pwc-pdf-comment-textarea',

    });

    ta.placeholder = t('Optional comment placeholder');

    ta.rows = 3;

    ta.spellcheck = true;

    ta.addEventListener('keydown', (e) => e.stopPropagation());

    ta.addEventListener('keypress', (e) => e.stopPropagation());

    ta.addEventListener('mousedown', (e) => e.stopPropagation());

    this.commentEl = ta;



    const row = contentEl.createDiv({ cls: 'pwc-open-mode-modal__row' });

    row

      .createEl('button', { text: t('Save highlight'), cls: 'mod-cta' })

      .addEventListener('click', () => {

        this.done = true;

        this.onSubmit({

          ...this.prefs,

          comment: (this.commentEl?.value ?? '').trim(),

        });

        this.close();

      });

    row.createEl('button', { text: t('Cancel') }).addEventListener('click', () => {

      this.close();

    });

    window.setTimeout(() => ta.focus(), 80);

  }



  onClose(): void {

    if (!this.done) this.onSubmit(null);

    this.contentEl.empty();

  }

}



async function askEpubHighlightPrefs(

  plugin: ReferenceList,

  initial: PdfHighlightPrefs

): Promise<(PdfHighlightPrefs & { comment: string }) | null> {

  return new Promise((resolve) => {

    const m = new EpubHighlightModal(plugin.app, initial, resolve);

    m.open();

  });

}



async function askEpubQuickHighlight(

  plugin: ReferenceList,

  prefs: PdfHighlightPrefs

): Promise<(PdfHighlightPrefs & { comment: string }) | null> {

  return new Promise((resolve) => {

    const m = new EpubQuickHighlightModal(plugin.app, prefs, resolve);

    m.open();

  });

}



export async function applyEpubHighlight(

  plugin: ReferenceList,

  view: EpubReaderView,

  selection: EpubPendingSelection,

  opts: PdfHighlightPrefs & { comment: string }

): Promise<void> {

  const file = view.getEpubFile();

  if (!file) return;



  const color = normalizeEpubHighlightColor(opts.color);

  const cfi = selection.cfi.trim();

  if (!cfi.startsWith('epubcfi(')) {

    new Notice(t('Invalid EPUB position'));

    return;

  }



  const wantsSidecar = opts.target === 'pdf' || opts.target === 'both';

  const wantsZotero = opts.target === 'zotero' || opts.target === 'both';



  const base: DocumentAnnotation = {

    id: `epub-${Date.now()}`,

    source: 'sidecar',

    text: selection.text,

    cfi,
    zoteroCfi: selection.zoteroCfi,
    zoteroSortIndex: selection.zoteroSortIndex,
    comment: opts.comment,
    color,
    markupStyle: opts.style,
    opacity: opts.opacity,
    sectionIndex: selection.sectionIndex,
    created: new Date().toISOString(),
  };



  let attachmentKey = view.getZoteroAttachmentKey();

  if (wantsZotero && plugin.settings.pullFromZoteroApi) {
    attachmentKey = await findZoteroAttachmentKeyForVaultFile(plugin, file, {
      fresh: true,
    });
    view.setZoteroAttachmentKey(attachmentKey);
  }



  let zoteroAnn: DocumentAnnotation | null = null;



  if (wantsZotero && plugin.settings.pullFromZoteroApi) {

    if (!attachmentKey) {

      new Notice(t('No Zotero attachment match for this EPUB'));

      if (!wantsSidecar) return;

    } else {
      const zoteroPos = await resolveZoteroEpubPosition(
        plugin,
        file,
        selection,
        view.getFoliateEl()
      );
      if (zoteroPos) {
        base.zoteroCfi = zoteroPos.zoteroCfi;
        base.zoteroSortIndex = zoteroPos.zoteroSortIndex;
      } else {
        new Notice(t('EPUB Zotero position could not be computed'));
        if (!wantsSidecar) return;
      }

      if (!base.zoteroCfi?.trim()) {
        // pas de CFI epub.js — ne pas envoyer le CFI foliate à Zotero
      } else {
      const res = await pushEpubAnnotationToZotero(plugin, attachmentKey, base);

      if (res.ok && res.key) {

        zoteroAnn = {

          ...base,

          id: `zotero-${res.key}`,

          source: 'zotero',

          zoteroKey: res.key,

        };

      } else if (!res.ok) {

        new Notice(`${t('Zotero save failed')}: ${res.error ?? ''}`);

        if (!wantsSidecar) return;

      }
      }

    }

  }



  if (wantsSidecar) {

    const sidecar = await readOrCreateSidecarAnnotations(file.path);

    sidecar.push({ ...base, id: `epub-${Date.now()}`, source: 'sidecar' });

    await saveEpubSidecar(file.path, sidecar);

  }



  const displayAnn = zoteroAnn ?? base;

  await view.addAnnotationFromPlugin(displayAnn);

  await saveEpubHighlightPrefs(plugin, opts);

  await refreshEpubReaderAnnotations(plugin, file.path);



  if (opts.target === 'zotero' && zoteroAnn) {

    new Notice(t('Highlight saved to Zotero'));

  } else if (opts.target === 'pdf') {

    new Notice(t('Highlight saved to sidecar'));

  } else if (zoteroAnn) {

    new Notice(t('Highlight saved to sidecar and Zotero'));

  } else {

    new Notice(t('Highlight saved to sidecar'));

  }

}



export async function createEpubHighlightFromSelection(

  plugin: ReferenceList,

  view: EpubReaderView,

  options: CreateEpubHighlightOptions = {}

): Promise<void> {

  const selection = view.getPendingSelection();

  if (!selection) {

    new Notice(t('Select text in the EPUB reader first'));

    return;

  }



  const saved = getEpubHighlightPrefs(plugin);

  let prefs: (PdfHighlightPrefs & { comment: string }) | null;



  if (options.useSavedPrefs) {

    prefs = await askEpubQuickHighlight(plugin, saved);

  } else if (options.showModal === true) {

    prefs = await askEpubHighlightPrefs(plugin, saved);

  } else {

    prefs = await askEpubHighlightPrefs(plugin, saved);

  }



  if (!prefs) return;

  await applyEpubHighlight(plugin, view, selection, prefs);

  view.clearPendingSelection();

}


