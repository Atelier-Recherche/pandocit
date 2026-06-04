import type { TFile } from 'obsidian';

import type ReferenceList from '../../main';
import type { EpubPendingSelection } from './epubCreateHighlight';
import {
  readFileFromEpubZip,
  parseSectionXhtml,
} from './epubArchiveLoad';
import { zoteroCfiFromDomRange } from './epubCfiFromRange';
import {
  lengthenEpubCfi,
  shortenEpubCfi,
  zoteroSortIndexFromEpubCfi,
} from './epubCfiBridge';
import { parseEpubSpine } from './epubSpine';
import { findRangeForText, normalizeWs } from './epubTextRange';

type FoliateViewEl = HTMLElement & {
  renderer?: { getContents?: () => Array<{ index: number; doc: Document }> };
};

/** Index de section foliate à partir du préfixe spine `/6/NN`. */
export function sectionIndexFromEpubCfi(cfi: string): number {
  const inner = shortenEpubCfi(cfi);
  const m = inner.match(/^\/6\/(\d+)/);
  if (!m) return 0;
  const spineNum = parseInt(m[1], 10);
  return Math.max(0, Math.round(spineNum / 2) - 1);
}

function liveRangeForSelection(
  contents: Array<{ index: number; doc: Document }>,
  selection: EpubPendingSelection
): Range | null {
  const want = normalizeWs(selection.text);
  for (const { index, doc } of contents) {
    if (index !== selection.sectionIndex) continue;
    const sel = doc.getSelection?.();
    if (!sel || sel.isCollapsed) continue;
    if (normalizeWs(sel.toString()) === want) {
      return sel.getRangeAt(0).cloneRange();
    }
  }
  for (const { index, doc } of contents) {
    if (index !== selection.sectionIndex) continue;
    return findRangeForText(doc, selection.text);
  }
  return null;
}

function rangeFromSectionText(
  sectionDoc: Document,
  text: string
): Range | null {
  return findRangeForText(sectionDoc, text);
}

function zoteroCfiForSection(
  cfiBase: string,
  sectionDoc: Document,
  text: string,
  liveRange: Range | null
): string | null {
  const range = liveRange ?? rangeFromSectionText(sectionDoc, text);
  if (!range) return null;
  try {
    return zoteroCfiFromDomRange(cfiBase, range);
  } catch {
    return null;
  }
}

/**
 * Construit position + sortIndex au format lecteur Zotero (ZIP + CFI foliate, sans epub.js).
 */
export async function resolveZoteroEpubPosition(
  plugin: ReferenceList,
  file: TFile,
  selection: EpubPendingSelection,
  foliateEl: FoliateViewEl | null
): Promise<{ zoteroCfi: string; zoteroSortIndex: string } | null> {
  try {
    const bytes = await plugin.app.vault.readBinary(file);
    const buf =
      bytes instanceof ArrayBuffer
        ? bytes
        : bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
          );

    const spine = parseEpubSpine(buf);
    const section = spine?.[selection.sectionIndex];
    if (!section) {
      console.warn('[PandoCit EPUB] spine section', selection.sectionIndex);
      return null;
    }

    const html = readFileFromEpubZip(buf, section.href);
    if (!html) {
      console.warn('[PandoCit EPUB] section file', section.href);
      return null;
    }

    const sectionDoc = parseSectionXhtml(html);
    const contents = foliateEl?.renderer?.getContents?.() ?? [];
    const live = liveRangeForSelection(contents, selection);

    const zoteroCfi = zoteroCfiForSection(
      section.cfiBase,
      sectionDoc,
      selection.text,
      live
    );

    if (!zoteroCfi) {
      console.warn(
        '[PandoCit EPUB] CFI Zotero introuvable',
        selection.text.slice(0, 40)
      );
      return null;
    }

    const zoteroSortIndex = zoteroSortIndexFromEpubCfi(
      lengthenEpubCfi(zoteroCfi)
    );
    return { zoteroCfi, zoteroSortIndex };
  } catch (e) {
    console.warn('[PandoCit EPUB] resolveZoteroEpubPosition', e);
    return null;
  }
}

/** @deprecated Utiliser zoteroSortIndexFromEpubCfi sur le CFI Zotero. */
export function zoteroSortIndexFromDomRange(
  sectionIndex: number,
  doc: Document,
  range: Range
): string {
  const root = doc.documentElement ?? doc.body;
  const offsetRange = doc.createRange();
  try {
    offsetRange.setStart(root, 0);
    offsetRange.setEnd(range.startContainer, range.startOffset);
    const len = offsetRange.toString().length;
    const spine = (sectionIndex + 1) * 2;
    return `${String(spine).padStart(5, '0')}|${String(Math.max(0, len)).padStart(8, '0')}`;
  } catch {
    const spine = (sectionIndex + 1) * 2;
    return `${String(spine).padStart(5, '0')}|00000000`;
  }
}
