import Fuse from 'fuse.js';
import { App, MarkdownView, Modal, Notice, Platform } from 'obsidian';

import {
  dedupeBibliographyEntries,
  listBibliographyEntriesFromCache,
} from '../bib/bibliographyEntries';
import type { PartialCSLEntry } from '../bib/types';
import { t } from '../lang/helpers';
import type ReferenceList from '../main';

const RESULT_LIMIT = 50;
const EMPTY_PREVIEW = 12;

function sourceLabel(plugin: ReferenceList): string {
  if (plugin.settings.pullFromZoteroApi) {
    return t('Searching library and bibliography');
  }
  return t('Searching bibliography');
}

export function openCitekeyPickerModal(plugin: ReferenceList): void {
  const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
  if (!view) {
    new Notice(t('Open a markdown note to insert a citation'));
    return;
  }
  new CitekeyPickerModal(plugin.app, plugin, view).open();
}

export class CitekeyPickerModal extends Modal {
  private query = '';
  private results: Fuse.FuseResult<PartialCSLEntry>[] = [];
  private selectedIndex = 0;
  private inputEl: HTMLInputElement;
  private listEl: HTMLElement;

  constructor(
    app: App,
    private plugin: ReferenceList,
    private markdownView: MarkdownView
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('pwc-citekey-picker');

    contentEl.createEl('h2', { text: t('Insert citation') });
    contentEl.createEl('p', {
      cls: 'pwc-citekey-picker__hint',
      text: sourceLabel(this.plugin),
    });

    this.inputEl = contentEl.createEl('input', {
      cls: 'pwc-citekey-picker__input',
      attr: { type: 'search', placeholder: t('Search by citekey or title…') },
    });

    const keys = contentEl.createDiv({ cls: 'pwc-citekey-picker__keys' });
    keys.createSpan({
      text: Platform.isMacOS ? '↵' : 'Enter',
      cls: 'pwc-citekey-picker__key',
    });
    keys.createSpan({ text: t('insert [@citekey]') });
    keys.createSpan({ text: ' · ', cls: 'pwc-citekey-picker__sep' });
    keys.createSpan({
      text: Platform.isMacOS ? '⌘↵' : 'Ctrl+Enter',
      cls: 'pwc-citekey-picker__key',
    });
    keys.createSpan({ text: t('insert @citekey') });

    this.listEl = contentEl.createDiv({ cls: 'pwc-citekey-picker__list' });

    this.inputEl.addEventListener('input', () => {
      this.query = this.inputEl.value;
      this.selectedIndex = 0;
      void this.refreshResults();
    });

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = Math.min(
          this.selectedIndex + 1,
          Math.max(0, this.results.length - 1)
        );
        this.renderList();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.renderList();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const bracketed = e.metaKey || e.ctrlKey;
        this.insertSelected(bracketed);
      } else if (e.key === 'Escape') {
        this.close();
      }
    });

    this.inputEl.focus();
    void this.refreshResults();
  }

  private async refreshResults(): Promise<void> {
    await this.plugin.initPromise.promise;
    await this.plugin.bibManager.initPromise.promise;

    const { bibManager } = this.plugin;
    const q = this.query.trim();

    if (!bibManager.fuse) {
      this.results = [];
      this.renderList();
      return;
    }

    if (!q) {
      const all = listBibliographyEntriesFromCache(bibManager.bibCache).sort((a, b) =>
        (a.title || a.id).localeCompare(b.title || b.id, undefined, {
          sensitivity: 'base',
        })
      );
      this.results = all.slice(0, EMPTY_PREVIEW).map((item, i) => ({
        item,
        refIndex: i,
      })) as Fuse.FuseResult<PartialCSLEntry>[];
    } else {
      const deduped = dedupeBibliographyEntries(
        (bibManager.fuse.search(q, { limit: RESULT_LIMIT * 2 }) ?? []).map(
          (r) => r.item
        )
      );
      this.results = deduped.slice(0, RESULT_LIMIT).map((item, i) => ({
        item,
        refIndex: i,
      })) as Fuse.FuseResult<PartialCSLEntry>[];
    }

    this.selectedIndex = 0;
    this.renderList();
  }

  private renderList(): void {
    this.listEl.empty();

    if (!this.results.length) {
      this.listEl.createDiv({
        cls: 'pwc-citekey-picker__empty',
        text: this.query.trim()
          ? t('No matching references')
          : t('Bibliography is empty'),
      });
      return;
    }

    this.results.forEach((res, i) => {
      const row = this.listEl.createDiv({
        cls: 'pwc-citekey-picker__row',
      });
      if (i === this.selectedIndex) row.addClass('is-selected');

      row.createSpan({ cls: 'pwc-citekey-picker__citekey', text: `@${res.item.id}` });
      if (res.item.title) {
        row.createSpan({ cls: 'pwc-citekey-picker__title', text: res.item.title });
      }

      row.addEventListener('click', () => {
        this.selectedIndex = i;
        this.insertSelected(true);
      });
    });
  }

  private insertSelected(bracketed: boolean): void {
    const res = this.results[this.selectedIndex];
    if (!res) return;

    const text = bracketed ? `[@${res.item.id}]` : `@${res.item.id}`;
    const editor = this.markdownView.editor;
    const cursor = editor.getCursor();
    editor.replaceRange(text, cursor, cursor);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
