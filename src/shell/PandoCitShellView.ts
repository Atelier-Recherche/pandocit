import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';

import { t } from '../lang/helpers';
import type ReferenceList from '../main';
import { ZoteroLibraryPanel } from '../zoteroLibraryView';
import { ReferenceListPanel } from './ReferenceListPanel';
import { DocumentAnnotationsPanel } from './DocumentAnnotationsPanel';
import { shellViewType } from './types';
import type { ShellTab } from './types';

export { shellViewType };

const SHELL_TABS: ShellTab[] = [
  'references',
  'zotero',
  'document-annotations',
];

/** Largeur du panneau (px) en dessous de laquelle seules les icônes des onglets sont affichées. */
const NARROW_SHELL_WIDTH = 230;

const SHELL_TAB_ICONS: Record<ShellTab, string> = {
  references: 'quote-glyph',
  zotero: 'library',
  'document-annotations': 'highlighter',
};

export class PandoCitShellView extends ItemView {
  plugin: ReferenceList;
  activeTab: ShellTab = 'references';
  private tabsEl: HTMLElement;
  private panelsEl: HTMLElement;
  private panelHosts = new Map<ShellTab, HTMLElement>();
  private narrowObserver: ResizeObserver | null = null;
  refsPanel: ReferenceListPanel;
  zoteroPanel: ZoteroLibraryPanel | null = null;
  docPanel: DocumentAnnotationsPanel | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: ReferenceList) {
    super(leaf);
    this.plugin = plugin;
    this.contentEl.addClass('pwc-shell');
    this.tabsEl = this.contentEl.createDiv({ cls: 'pwc-shell__tabs' });
    this.panelsEl = this.contentEl.createDiv({ cls: 'pwc-shell__panels' });

    for (const tab of SHELL_TABS) {
      const host = this.panelsEl.createDiv({
        cls: `pwc-shell__panel pwc-shell__panel--${tab}`,
      });
      this.panelHosts.set(tab, host);
    }

    this.refsPanel = new ReferenceListPanel(
      this.panelHosts.get('references')!,
      plugin
    );
    this.buildTabs();
    const pending = plugin.pendingShellTab;
    this.switchTab(
      pending && SHELL_TABS.includes(pending) ? pending : 'references'
    );
    plugin.pendingShellTab = undefined;

    if (typeof ResizeObserver !== 'undefined') {
      this.narrowObserver = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width ?? this.contentEl.clientWidth;
        this.contentEl.toggleClass('pwc-shell--narrow', width < NARROW_SHELL_WIDTH);
      });
      this.narrowObserver.observe(this.contentEl);
    }
  }

  getViewType(): string {
    return shellViewType;
  }

  getDisplayText(): string {
    return 'PandoCit';
  }

  getIcon(): string {
    return 'quote-glyph';
  }

  private tabLabel(tab: ShellTab): string {
    switch (tab) {
      case 'references':
        return t('References');
      case 'zotero':
        return t('Library');
      case 'document-annotations':
        return t('Annotations');
    }
  }

  private buildTabs(): void {
    this.tabsEl.empty();
    for (const tab of SHELL_TABS) {
      const label = this.tabLabel(tab);
      const btn = this.tabsEl.createEl('button', {
        cls: 'pwc-shell__tab',
        attr: {
          type: 'button',
          'data-tab': tab,
          'aria-label': label,
          title: label,
        },
      });
      const iconEl = btn.createSpan({
        cls: 'pwc-shell__tab-icon',
        attr: { 'aria-hidden': 'true' },
      });
      setIcon(iconEl, SHELL_TAB_ICONS[tab]);
      btn.createSpan({ cls: 'pwc-shell__tab-label', text: label });
      btn.addEventListener('click', () => this.switchTab(tab));
    }
  }

  switchTab(tab: ShellTab): void {
    this.activeTab = tab;
    this.tabsEl.findAll('.pwc-shell__tab').forEach((el) => {
      el.toggleClass('is-active', el.getAttribute('data-tab') === tab);
    });
    for (const [id, host] of this.panelHosts) {
      host.toggleClass('is-active', id === tab);
    }
    if (tab === 'zotero' && !this.zoteroPanel) {
      const hasLibrary =
        !!this.plugin.settings.pullFromZoteroApi ||
        !!this.plugin.settings.pathToBibliography?.trim();
      const host = this.panelHosts.get('zotero')!;
      if (!hasLibrary) {
        host.empty();
        host.createDiv({
          cls: 'pane-empty',
          text: t(
            'Set a bibliography file path or enable Zotero Web API in plugin settings'
          ),
        });
      } else {
        this.zoteroPanel = new ZoteroLibraryPanel(host, this.plugin);
      }
    }
    if (tab === 'document-annotations' && !this.docPanel) {
      this.docPanel = new DocumentAnnotationsPanel(
        this.panelHosts.get('document-annotations')!,
        this.plugin
      );
    }
    if (tab === 'zotero') void this.zoteroPanel?.refreshList();
    if (tab === 'document-annotations') this.docPanel?.render();
  }

  async onOpen(): Promise<void> {
    if (this.activeTab === 'zotero') await this.zoteroPanel?.refreshList();
  }

  async onClose(): Promise<void> {
    this.narrowObserver?.disconnect();
    this.narrowObserver = null;
  }
}
