import { Menu, Notice, TFile, debounce, setIcon } from 'obsidian';

import { copyTextToClipboard } from '../../annotations/annotationReference';
import { t } from '../../lang/helpers';
import type ReferenceList from '../../main';
import { createPdfHighlightFromSelection } from './pdfCreateHighlight';
import { getPdfHighlightPrefs } from './pdfHighlightPrefs';
import {
  applyPdfNativeDarkMode,
  clearStrayPdfReaderDarkMode,
} from '../readerDarkMode';
import { scheduleZoteroOverlayRender } from './zoteroPdfOverlay';
import { refreshPdfPanelAnnotations } from './pdfPanelAnnotations';

const TOOLBAR_BTN_CLASS = 'pwc-pdf-highlight-toolbar-btn';
const TOOLBAR_GROUP_CLASS = 'pwc-pdf-reader-toolbar-group';
const RESTYLE_BTN_CLASS = 'pwc-reader-restyle-btn';
const DARK_BTN_CLASS = 'pwc-reader-dark-btn';
const RESYNC_BTN_CLASS = 'pwc-reader-resync-ann-btn';
const TOC_BTN_CLASS = 'pwc-reader-toc-btn';

/** Affiche la sidebar PDF Obsidian et active la vue outline (TOC). */
function showPdfOutlineSidebar(container: HTMLElement): void {
  const sidebar = container.querySelector('.pdf-sidebar') as HTMLElement | null;
  const sidebarHidden =
    !sidebar ||
    sidebar.classList.contains('is-hidden') ||
    sidebar.hasAttribute('hidden') ||
    getComputedStyle(sidebar).display === 'none' ||
    sidebar.offsetWidth < 8;

  if (sidebarHidden) {
    const toggleCandidates = Array.from(
      container.querySelectorAll<HTMLElement>(
        '.pdf-toolbar .clickable-icon, .pdf-toolbar button'
      )
    );
    const toggle =
      toggleCandidates.find((el) => {
        const label = (
          el.getAttribute('aria-label') ||
          el.title ||
          ''
        ).toLowerCase();
        return (
          label.includes('sidebar') ||
          label.includes('outline') ||
          label.includes('table of contents') ||
          label.includes('table des matières')
        );
      }) ?? null;
    toggle?.click();
  }

  window.setTimeout(() => {
    const outlineTab = Array.from(
      container.querySelectorAll<HTMLElement>(
        '.pdf-sidebar .clickable-icon, .pdf-sidebar button, .pdf-sidebar-tabs .clickable-icon'
      )
    ).find((el) => {
      const label = (
        el.getAttribute('aria-label') ||
        el.title ||
        el.dataset.type ||
        ''
      ).toLowerCase();
      return (
        label.includes('outline') ||
        label.includes('table of contents') ||
        label.includes('table des matières') ||
        label === 'outline'
      );
    });
    outlineTab?.click();
  }, 50);
}

function isObsidianNativePdfActive(plugin: ReferenceList): boolean {
  const leaf = plugin.app.workspace.activeLeaf;
  if (!leaf || leaf.view.getViewType() !== 'pdf') return false;
  const file = (leaf.view as { file?: TFile }).file;
  return file instanceof TFile && file.extension.toLowerCase() === 'pdf';
}

function activePdfContainer(plugin: ReferenceList): HTMLElement | null {
  const leaf = plugin.app.workspace.activeLeaf;
  if (!leaf || leaf.view.getViewType() !== 'pdf') return null;
  return leaf.view.containerEl ?? null;
}

function highlightToolbarTitle(plugin: ReferenceList): string {
  const p = getPdfHighlightPrefs(plugin);
  const styleKey =
    p.style === 'highlight'
      ? 'Highlight style highlight'
      : p.style === 'underline'
        ? 'Highlight style underline'
        : p.style === 'strikeout'
          ? 'Highlight style strikeout'
          : 'Highlight style squiggly';
  const targetKey =
    p.target === 'pdf'
      ? 'Highlight target pdf'
      : p.target === 'zotero'
        ? 'Highlight target zotero'
        : 'Highlight target both';
  return `${t('Highlight selection in PDF')} (${t(styleKey)} · ${t(targetKey)})`;
}

function getSelectionText(): string {
  return window.getSelection()?.toString().trim() ?? '';
}

async function copyPdfSelection(): Promise<void> {
  const text = getSelectionText();
  if (!text) return;
  const ok = await copyTextToClipboard(text);
  if (!ok) new Notice(t('Copy failed'));
}

function makeToolbarBtn(
  icon: string,
  label: string,
  className: string,
  onClick: () => void,
  active?: boolean
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `clickable-icon ${className}${active ? ' is-active' : ''}`;
  btn.setAttribute('aria-label', label);
  btn.title = label;
  setIcon(btn, icon);
  btn.addEventListener(
    'pointerdown',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    { capture: true }
  );
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return btn;
}

function syncPdfReaderChrome(plugin: ReferenceList, container: HTMLElement): void {
  applyPdfNativeDarkMode(container, !!plugin.settings.readerDarkMode);
}

function injectPdfHighlightToolbarButton(plugin: ReferenceList): void {
  clearStrayPdfReaderDarkMode();
  if (!isObsidianNativePdfActive(plugin)) return;

  const container = activePdfContainer(plugin);
  if (!container) return;

  syncPdfReaderChrome(plugin, container);

  const pageNumbers = container.querySelector('.pdf-page-numbers');
  if (!pageNumbers?.parentElement) return;

  const title = highlightToolbarTitle(plugin);
  const restyleOn = plugin.settings.annotationRestyleEnabled !== false;
  const darkOn = !!plugin.settings.readerDarkMode;

  const existingGroup = pageNumbers.nextElementSibling;
  if (
    existingGroup?.classList.contains(TOOLBAR_GROUP_CLASS) &&
    existingGroup.querySelector(`.${RESYNC_BTN_CLASS}`) &&
    existingGroup.querySelector(`.${TOC_BTN_CLASS}`)
  ) {
    const hl = existingGroup.querySelector(`.${TOOLBAR_BTN_CLASS}`);
    if (hl) {
      hl.setAttribute('aria-label', title);
      (hl as HTMLButtonElement).title = title;
    }
    const restyle = existingGroup.querySelector(
      `.${RESTYLE_BTN_CLASS}`
    ) as HTMLElement | null;
    restyle?.toggleClass('is-active', restyleOn);
    const dark = existingGroup.querySelector(
      `.${DARK_BTN_CLASS}`
    ) as HTMLElement | null;
    if (dark) {
      dark.toggleClass('is-active', darkOn);
      setIcon(dark, darkOn ? 'sun' : 'moon');
      dark.setAttribute('aria-label', t('Toggle reader dark mode'));
      dark.title = t('Toggle reader dark mode');
    }
    return;
  }

  container.querySelectorAll(`.${TOOLBAR_GROUP_CLASS}`).forEach((el) => el.remove());
  container.querySelectorAll(`.${TOOLBAR_BTN_CLASS}`).forEach((el) => el.remove());

  const group = document.createElement('div');
  group.className = TOOLBAR_GROUP_CLASS;
  group.append(
    makeToolbarBtn('list', t('Table of contents'), TOC_BTN_CLASS, () => {
      showPdfOutlineSidebar(container);
    }),
    makeToolbarBtn('highlighter', title, TOOLBAR_BTN_CLASS, () => {
      void createPdfHighlightFromSelection(plugin, { useSavedPrefs: true });
    }),
    makeToolbarBtn(
      'palette',
      t('Toggle annotation restyle'),
      RESTYLE_BTN_CLASS,
      () => {
        plugin.settings.annotationRestyleEnabled =
          plugin.settings.annotationRestyleEnabled === false;
        void plugin.saveSettings();
        injectPdfHighlightToolbarButton(plugin);
        scheduleZoteroOverlayRender(plugin);
      },
      restyleOn
    ),
    makeToolbarBtn(
      darkOn ? 'sun' : 'moon',
      t('Toggle reader dark mode'),
      DARK_BTN_CLASS,
      () => {
        plugin.settings.readerDarkMode = !plugin.settings.readerDarkMode;
        void plugin.saveSettings();
        injectPdfHighlightToolbarButton(plugin);
        scheduleZoteroOverlayRender(plugin);
      },
      darkOn
    ),
    makeToolbarBtn(
      'refresh-cw',
      t('Resync document annotations'),
      RESYNC_BTN_CLASS,
      () => {
        const leaf = plugin.app.workspace.activeLeaf;
        const file = (leaf?.view as { file?: TFile } | undefined)?.file;
        if (!(file instanceof TFile) || file.extension.toLowerCase() !== 'pdf') {
          return;
        }
        void refreshPdfPanelAnnotations(plugin, file, { syncRemote: true }).then(
          () => {
            scheduleZoteroOverlayRender(plugin);
          }
        );
      }
    )
  );

  pageNumbers.insertAdjacentElement('afterend', group);
}

function selectionInActivePdf(): boolean {
  return getSelectionText().length > 0;
}

function contextTargetInPdf(evt: MouseEvent): boolean {
  const t = evt.target;
  if (!(t instanceof Node)) return false;
  const el = t instanceof HTMLElement ? t : t.parentElement;
  if (!el) return false;
  return !!el.closest('[data-page-number], .pdf-viewer, .pdf-toolbar, .workspace-leaf');
}

export function registerPdfNativeViewerUi(plugin: ReferenceList): void {
  const scheduleInject = debounce(
    () => injectPdfHighlightToolbarButton(plugin),
    120,
    true
  );

  plugin.registerEvent(
    plugin.app.workspace.on('active-leaf-change', scheduleInject)
  );
  plugin.registerEvent(
    plugin.app.workspace.on('layout-change', scheduleInject)
  );
  plugin.registerEvent(
    plugin.app.workspace.on('file-open', () => {
      scheduleInject();
      window.setTimeout(scheduleInject, 400);
    })
  );

  plugin.registerDomEvent(
    document,
    'contextmenu',
    (evt) => {
      if (!isObsidianNativePdfActive(plugin)) return;
      if (!selectionInActivePdf()) return;
      if (!contextTargetInPdf(evt)) return;

      evt.preventDefault();
      evt.stopPropagation();

      const menu = new Menu();
      menu.addItem((item) => {
        item.setTitle(t('Copy selection'));
        item.setIcon('copy');
        item.onClick(() => {
          void copyPdfSelection();
        });
      });
      menu.addSeparator();
      menu.addItem((item) => {
        item.setTitle(t('Highlight with last settings'));
        item.setIcon('highlighter');
        item.onClick(() => {
          void createPdfHighlightFromSelection(plugin, { useSavedPrefs: true });
        });
      });
      menu.addItem((item) => {
        item.setTitle(t('Highlight with options…'));
        item.setIcon('settings');
        item.onClick(() => {
          void createPdfHighlightFromSelection(plugin, { showModal: true });
        });
      });
      menu.showAtMouseEvent(evt);
    },
    { capture: true }
  );

  scheduleInject();
}
