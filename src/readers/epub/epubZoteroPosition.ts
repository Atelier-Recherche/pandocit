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
  stripEpubCfiIdAssertions,
  zoteroSortIndexFromSectionOffset,
} from './epubCfiBridge';
import { epubjsChapterCfiBase, parseEpubSpine } from './epubSpine';
import { findRangeForText } from './epubTextRange';

type FoliateViewEl = HTMLElement & {
  renderer?: { getContents?: () => Array<{ index: number; doc: Document }> };
};

/** Index de section foliate à partir du préfixe spine `/6/NN`. */
export function sectionIndexFromEpubCfi(cfi: string): number {
  const inner = stripEpubCfiIdAssertions(shortenEpubCfi(cfi));
  const m = inner.match(/^\/6\/(\d+)/);
  if (!m) return 0;
  const spineNum = parseInt(m[1], 10);
  return Math.max(0, Math.round(spineNum / 2) - 1);
}

function rangeFromSectionText(
  sectionDoc: Document,
  text: string
): Range | null {
  return findRangeForText(sectionDoc, text);
}

/** Nettoie le CFI epub.js : base spine sans `[id]`, chemin document intact. */
function sanitizeZoteroEpubCfi(raw: string, sectionIndex: number): string {
  const cleaned = stripEpubCfiIdAssertions(shortenEpubCfi(raw));
  const spine = epubjsChapterCfiBase(sectionIndex, '');
  const bang = cleaned.indexOf('!');
  if (bang < 0) return cleaned.startsWith('/6/') ? cleaned : `${spine}!${cleaned}`;
  return `${spine}!${cleaned.slice(bang + 1)}`;
}

/** Offset caractères depuis le début du document section (comme Zotero reader). */
function charOffsetInSection(doc: Document, range: Range): number {
  const root = doc.documentElement ?? doc.body;
  if (!root) return 0;
  try {
    const offsetRange = doc.createRange();
    offsetRange.setStart(root, 0);
    offsetRange.setEnd(range.startContainer, range.startOffset);
    return offsetRange.toString().length;
  } catch {
    return 0;
  }
}

/**
 * Position Zotero (CFI epub.js + sortIndex) depuis le XHTML du ZIP —
 * jamais depuis le DOM foliate (wrappers ≠ structure EPUB).
 */
export async function resolveZoteroEpubPosition(
  plugin: ReferenceList,
  file: TFile,
  selection: EpubPendingSelection,
  _foliateEl: FoliateViewEl | null
): Promise<{
  zoteroCfi: string;
  zoteroSortIndex: string;
  pageLabel: string;
} | null> {
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
    const range = rangeFromSectionText(sectionDoc, selection.text);
    if (!range || range.collapsed) {
      console.warn(
        '[PandoCit EPUB] texte introuvable dans la section ZIP',
        selection.text.slice(0, 40)
      );
      return null;
    }

    // Base spine SANS idref : `/6/N` seulement (les `[id]` cassent le reader Zotero).
    const cfiBase = epubjsChapterCfiBase(selection.sectionIndex, '');

    let zoteroCfi: string;
    try {
      zoteroCfi = zoteroCfiFromDomRange(cfiBase, range);
    } catch (e) {
      console.warn('[PandoCit EPUB] CFI Zotero', e);
      return null;
    }
    zoteroCfi = sanitizeZoteroEpubCfi(zoteroCfi ?? '', selection.sectionIndex);
    if (!zoteroCfi.includes('!')) {
      console.warn(
        '[PandoCit EPUB] CFI Zotero invalide',
        selection.text.slice(0, 40)
      );
      return null;
    }

    const offset = charOffsetInSection(sectionDoc, range);
    const zoteroSortIndex = zoteroSortIndexFromSectionOffset(
      selection.sectionIndex,
      offset
    );
    // Sans page-list physique : libellé 1-based de la section (comme Zotero mobile).
    const pageLabel = String(selection.sectionIndex + 1);

    return {
      zoteroCfi: lengthenEpubCfi(zoteroCfi),
      zoteroSortIndex,
      pageLabel,
    };
  } catch (e) {
    console.warn('[PandoCit EPUB] resolveZoteroEpubPosition', e);
    return null;
  }
}

/** @deprecated Utiliser {@link zoteroSortIndexFromSectionOffset}. */
export function zoteroSortIndexFromDomRange(
  sectionIndex: number,
  doc: Document,
  range: Range
): string {
  return zoteroSortIndexFromSectionOffset(
    sectionIndex,
    charOffsetInSection(doc, range)
  );
}
