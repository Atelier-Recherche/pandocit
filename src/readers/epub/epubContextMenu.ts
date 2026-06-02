import { Menu, Notice } from 'obsidian';

import { copyTextToClipboard } from '../../annotations/annotationReference';
import { t } from '../../lang/helpers';
import type ReferenceList from '../../main';
import { createEpubHighlightFromSelection } from './epubCreateHighlight';
import type { EpubReaderView } from './EpubReaderView';

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

export function showEpubHighlightContextMenu(
  plugin: ReferenceList,
  view: EpubReaderView,
  evt: MouseEvent
): void {
  const menu = new Menu();
  menu.addItem((item) => {
    item.setTitle(t('Copy selection'));
    item.setIcon('copy');
    item.onClick(() => {
      const sel = view.getPendingSelection();
      if (!sel?.text) return;
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
  const { x, y } = viewportCoordsForMouseEvent(evt);
  menu.showAtPosition({ x, y });
}
