import { Menu, Notice } from 'obsidian';

import { copyTextToClipboard } from '../../annotations/annotationReference';
import type { DocumentAnnotation } from '../../annotations/types';
import { t } from '../../lang/helpers';
import type ReferenceList from '../../main';
import { deleteDocumentAnnotation } from '../pdf/pdfAnnotationActions';
import { createEpubHighlightFromSelection } from './epubCreateHighlight';
import type { EpubReaderView } from './EpubReaderView';
import { normalizeWs } from './epubTextRange';

const PWC_ANN_CFI_ATTR = 'data-pwc-ann-cfi';

let openMenu: Menu | null = null;
let dismissCleanup: (() => void) | null = null;

export function getEpubAnnCfiAttr(): string {
  return PWC_ANN_CFI_ATTR;
}

/** Coordonnées viewport Obsidian pour un événement souris (y compris iframe foliate). */
function viewportCoordsForMouseEvent(evt: MouseEvent): { x: number; y: number } {
  const eventDoc = evt.view?.document;
  if (!eventDoc || eventDoc === document) {
    return { x: evt.clientX, y: evt.clientY };
  }
  const frame = eventDoc.defaultView?.frameElement as HTMLIFrameElement | null;
  if (!frame) {
    return { x: evt.clientX, y: evt.clientY };
  }
  const rect = frame.getBoundingClientRect();
  return {
    x: rect.left + evt.clientX,
    y: rect.top + evt.clientY,
  };
}

function annotationMatchingText(
  view: EpubReaderView,
  text: string | undefined
): DocumentAnnotation | undefined {
  const needle = normalizeWs(text ?? '');
  if (needle.length < 2) return undefined;
  const anns = view.getAnnotations();
  return (
    anns.find((a) => normalizeWs(a.text) === needle) ??
    anns.find((a) => needle.includes(normalizeWs(a.text)) && a.text.length >= 4) ??
    anns.find((a) => normalizeWs(a.text).includes(needle) && needle.length >= 4)
  );
}

function annotationFromEventTarget(
  view: EpubReaderView,
  target: EventTarget | null
): DocumentAnnotation | undefined {
  if (!(target instanceof Element)) return undefined;
  let el: Element | null = target;
  while (el && !el.getAttribute?.(PWC_ANN_CFI_ATTR)) {
    el = el.parentElement;
  }
  const cfi = el?.getAttribute?.(PWC_ANN_CFI_ATTR)?.trim();
  if (!cfi) return undefined;
  return view.findAnnotationByFoliateCfi(cfi);
}

export function dismissEpubContextMenu(): void {
  dismissCleanup?.();
  dismissCleanup = null;
  try {
    openMenu?.hide();
  } catch {
    //
  }
  openMenu = null;
}

function wireMenuDismiss(menu: Menu, eventDoc: Document | null): void {
  dismissCleanup?.();
  const docs = new Set<Document>([document]);
  if (eventDoc) docs.add(eventDoc);

  const onPointerDown = (e: Event) => {
    const t = e.target;
    // Ne pas fermer si on clique dans le menu Obsidian lui-même.
    if (t instanceof Node) {
      const menuEl =
        (menu as unknown as { containerEl?: HTMLElement }).containerEl ??
        (menu as unknown as { dom?: HTMLElement }).dom;
      if (menuEl?.contains(t)) return;
      if (t instanceof Element && t.closest?.('.menu, .menu-item')) return;
    }
    dismissEpubContextMenu();
  };

  // Laisser le menu s’afficher avant d’écouter (sinon le même clic le ferme).
  const timer = window.setTimeout(() => {
    for (const d of docs) {
      d.addEventListener('pointerdown', onPointerDown, true);
    }
  }, 0);

  dismissCleanup = () => {
    window.clearTimeout(timer);
    for (const d of docs) {
      d.removeEventListener('pointerdown', onPointerDown, true);
    }
  };
}

export function showEpubHighlightContextMenu(
  plugin: ReferenceList,
  view: EpubReaderView,
  evt: MouseEvent
): void {
  dismissEpubContextMenu();

  const sel = view.getPendingSelection();
  const fromOverlay = annotationFromEventTarget(view, evt.target);
  const fromText = annotationMatchingText(view, sel?.text);
  const match = fromOverlay ?? fromText;

  const menu = new Menu();
  let hasItem = false;

  if (sel?.text) {
    hasItem = true;
    menu.addItem((item) => {
      item.setTitle(t('Copy selection'));
      item.setIcon('copy');
      item.onClick(() => {
        void copyTextToClipboard(sel.text).then((ok) => {
          if (!ok) new Notice(t('Copy failed'));
        });
      });
    });
    menu.addSeparator();
    menu.addItem((item) => {
      item.setTitle(t('Highlight with last settings'));
      item.setIcon('highlighter');
      item.onClick(() => {
        void createEpubHighlightFromSelection(plugin, view, {
          useSavedPrefs: true,
        });
      });
    });
    menu.addItem((item) => {
      item.setTitle(t('Highlight with options…'));
      item.setIcon('settings');
      item.onClick(() => {
        void createEpubHighlightFromSelection(plugin, view, {
          showModal: true,
        });
      });
    });
  }

  if (match) {
    if (hasItem) menu.addSeparator();
    hasItem = true;
    menu.addItem((item) => {
      item.setTitle(t('Delete annotation'));
      item.setIcon('trash');
      item.onClick(() => {
        const file = view.getFile();
        if (!file) return;
        const ok = window.confirm(t('Delete annotation confirm'));
        if (!ok) return;
        void deleteDocumentAnnotation(plugin, file.path, match);
      });
    });
  }

  if (!hasItem) return;

  openMenu = menu;
  wireMenuDismiss(menu, evt.view?.document ?? null);
  const { x, y } = viewportCoordsForMouseEvent(evt);
  menu.showAtPosition({ x, y });
}
