import { TFile, setIcon } from 'obsidian';

import {
  copyAnnotationReferenceNotice,
  formatDocumentAnnotationReference,
} from '../../annotations/annotationReference';
import { t } from '../../lang/helpers';
import type ReferenceList from '../../main';
import {
  dottedBackgroundImage,
  resolveAnnotationDisplayAppearance,
  squigglyBackgroundImage,
} from '../annotationDisplayStyle';
import {
  applyPdfNativeDarkMode,
  clearStrayPdfReaderDarkMode,
} from '../readerDarkMode';
import { readerRegistry } from '../readerRegistry';
import { getCachedPdfPageSizes } from './pdfPanelAnnotations';
import { pdfReaderViewType } from './PdfReaderView';

function clearOverlay(container: HTMLElement): void {
  container
    .querySelectorAll('.pwc-zotero-overlay-layer')
    .forEach((el) => el.remove());
  container
    .querySelectorAll('.pwc-zotero-popup-wrapper')
    .forEach((el) => el.remove());
}

interface ActivePdfTarget {
  container: HTMLElement;
  vaultPath: string;
}

/** Conteneur + chemin du PDF natif focusé (jamais le shell ni un autre panneau). */
function findActivePdfTarget(plugin: ReferenceList): ActivePdfTarget | null {
  const active = plugin.app.workspace.activeLeaf;
  if (active?.view.getViewType() === 'pdf') {
    const vf = (active.view as { file?: TFile }).file;
    if (vf instanceof TFile && vf.extension.toLowerCase() === 'pdf') {
      return { container: active.view.containerEl, vaultPath: vf.path };
    }
  }

  const activeFile = plugin.app.workspace.getActiveFile();
  const preferPath =
    activeFile instanceof TFile && activeFile.extension.toLowerCase() === 'pdf'
      ? activeFile.path
      : null;

  let found: ActivePdfTarget | null = null;
  plugin.app.workspace.iterateAllLeaves((leaf) => {
    if (found) return;
    if (leaf.view.getViewType() === pdfReaderViewType) return;
    if (leaf.view.getViewType() !== 'pdf') return;
    const vf = (leaf.view as { file?: TFile }).file;
    if (!(vf instanceof TFile) || vf.extension.toLowerCase() !== 'pdf') return;
    if (preferPath && vf.path !== preferPath) return;
    found = { container: leaf.view.containerEl, vaultPath: vf.path };
  });
  return found;
}

export function renderZoteroOverlayOnActivePdf(plugin: ReferenceList): void {
  clearStrayPdfReaderDarkMode();

  const target = findActivePdfTarget(plugin);
  if (!target) return;

  const { container, vaultPath } = target;
  applyPdfNativeDarkMode(container, !!plugin.settings.readerDarkMode);
  clearOverlay(container);

  // Annotations du PDF affiché (pas seulement l’actif global).
  const state = readerRegistry.get(vaultPath);
  if (!state) return;

  const pageSizes = getCachedPdfPageSizes(vaultPath);
  if (!pageSizes?.size) return;

  const zoteroAnns = state.annotations.filter(
    (a) => a.source === 'zotero' && a.pageIndex != null && a.rects?.length
  );
  if (!zoteroAnns.length) return;

  const pages = container.querySelectorAll<HTMLElement>('[data-page-number]');
  pages.forEach((pageEl) => {
    const pageNumber = Number(pageEl.getAttribute('data-page-number') ?? '0');
    if (!Number.isFinite(pageNumber) || pageNumber < 1) return;
    const pageIndex = pageNumber - 1;
    const pageSize = pageSizes.get(pageIndex);
    if (!pageSize || pageSize.width <= 0 || pageSize.height <= 0) return;

    const anns = zoteroAnns.filter((a) => a.pageIndex === pageIndex);
    if (!anns.length) return;

    const layer = pageEl.createDiv({ cls: 'pwc-zotero-overlay-layer' });
    const restyleEnabled = plugin.settings.annotationRestyleEnabled !== false;
    const readerDarkMode = !!plugin.settings.readerDarkMode;
    const restyleColor =
      plugin.settings.annotationRestyleBlackColor?.trim() || '#ffd400';
    const restyleStyle = plugin.settings.annotationRestyleStyle ?? 'squiggly';
    for (const ann of anns) {
      const appearance = resolveAnnotationDisplayAppearance({
        color: ann.color,
        markupStyle: ann.markupStyle ?? 'highlight',
        opacity: ann.opacity,
        restyleEnabled,
        readerDarkMode,
        restyleColor,
        restyleStyle,
      });
      const markup = appearance.displayStyle;
      for (const rect of ann.rects ?? []) {
        const el = layer.createDiv({
          cls: `pwc-zotero-overlay-rect pwc-zotero-overlay-rect--${markup}`,
        });
        if (readerDarkMode) el.addClass('pwc-zotero-overlay-rect--dark');
        el.setCssStyles({
          left: `${(rect.x / pageSize.width) * 100}%`,
          top: `${(rect.y / pageSize.height) * 100}%`,
          width: `${(rect.width / pageSize.width) * 100}%`,
          height: `${(rect.height / pageSize.height) * 100}%`,
          pointerEvents: 'auto',
          mixBlendMode: appearance.blendMode,
          opacity: String(
            markup === 'highlight' ? appearance.opacity : 0.98
          ),
        });
        el.style.setProperty('--pwc-ann-color', appearance.displayColor);
        el.style.color = appearance.displayColor;
        if (markup === 'highlight') {
          el.style.background = appearance.displayColor;
        } else if (markup === 'squiggly') {
          el.style.backgroundColor = 'transparent';
          el.style.backgroundImage = squigglyBackgroundImage(
            appearance.displayColor
          );
          el.style.backgroundRepeat = 'repeat-x';
          el.style.backgroundPosition = 'left bottom';
          el.style.backgroundSize = '8px 4px';
        } else if (markup === 'dotted') {
          el.style.backgroundColor = 'transparent';
          el.style.backgroundImage = dottedBackgroundImage(
            appearance.displayColor
          );
          el.style.backgroundRepeat = 'repeat-x';
          el.style.backgroundPosition = 'left bottom';
          el.style.backgroundSize = '6px 4px';
        }
        el.title = ann.comment || ann.text || 'Zotero annotation';
        el.addEventListener('click', (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          container
            .querySelectorAll('.pwc-zotero-popup-wrapper')
            .forEach((n) => n.remove());
          const popupWrapper = pageEl.createDiv({ cls: 'pwc-zotero-popup-wrapper' });
          popupWrapper.style.left = `${(rect.x / pageSize.width) * 100}%`;
          popupWrapper.style.top = `${(rect.y / pageSize.height) * 100}%`;
          const popup = popupWrapper.createDiv({ cls: 'popup' });
          popup.createDiv({
            cls: 'popupContent',
            text: (ann.comment || ann.text || '').trim() || 'Zotero annotation',
          });
          const meta = popup.createDiv({ cls: 'popupMeta' });
          meta.createDiv({
            cls: 'popupTitle',
            text: 'Zotero',
          });
          const copyBtn = meta.createEl('button', {
            cls: 'clickable-icon pwc-zotero-popup-copy',
            attr: {
              type: 'button',
              'aria-label': t('Copy annotation reference'),
              title: t('Copy annotation reference'),
            },
          });
          setIcon(copyBtn, 'copy');
          copyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const citekey = state.citekey;
            const text = formatDocumentAnnotationReference(
              ann,
              state.vaultPath,
              citekey
            );
            void copyAnnotationReferenceNotice(text);
          });
        });
      }
    }
  });

  const onDocClick = (ev: MouseEvent) => {
    const t = ev.target as HTMLElement | null;
    if (t?.closest('.pwc-zotero-popup-wrapper, .pwc-zotero-overlay-rect')) return;
    container
      .querySelectorAll('.pwc-zotero-popup-wrapper')
      .forEach((el) => el.remove());
    document.removeEventListener('click', onDocClick, true);
  };
  document.addEventListener('click', onDocClick, true);

  // Re-appliquer le contre-invert sur les overlays fraîchement créés.
  applyPdfNativeDarkMode(container, !!plugin.settings.readerDarkMode);
}

export function scheduleZoteroOverlayRender(plugin: ReferenceList): void {
  const delays = [0, 100, 300, 800, 1500, 2500];
  for (const delay of delays) {
    window.setTimeout(() => renderZoteroOverlayOnActivePdf(plugin), delay);
  }
}
