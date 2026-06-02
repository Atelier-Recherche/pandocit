import type { TFile } from 'obsidian';

import type ReferenceList from '../../main';
import type { EpubPendingSelection } from './epubCreateHighlight';
import {
  readFileFromEpubZip,
  parseSectionXhtml,
} from './epubArchiveLoad';
import {
  lengthenEpubCfi,
  shortenEpubCfi,
  zoteroSortIndexFromEpubCfi,
} from './epubCfiBridge';
import { findRangeForText, normalizeWs } from './epubTextRange';

type FoliateViewEl = HTMLElement & {
  renderer?: { getContents?: () => Array<{ index: number; doc: Document }> };
};

type EpubSection = {
  href: string;
  load: (request?: (url: string) => Promise<unknown>) => Promise<unknown>;
  find: (query: string) => Array<{ cfi: string }>;
  cfiFromRange: (range: Range) => string;
  document?: Document;
  contents?: Element;
  cfiBase?: string;
};

type EpubBook = {
  ready: Promise<void>;
  section: (index: number) => EpubSection | null;
  load: (path: string) => Promise<Document | string>;
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

async function openEpubBook(bytes: ArrayBuffer): Promise<EpubBook> {
  const ePub = (await import('epubjs')).default;
  const book = ePub(bytes, { openAs: 'binary' }) as EpubBook;
  await book.ready;
  return book;
}

/** Charge le document XHTML de section via l’archive (pas XHR Obsidian). */
async function ensureSectionDocument(
  book: EpubBook,
  section: EpubSection,
  epubBytes: ArrayBuffer
): Promise<Document> {
  if (section.document?.documentElement) return section.document;

  const href = section.href;
  if (!href) throw new Error('section href missing');

  try {
    await section.load(() => book.load(href));
    if (section.document?.documentElement) return section.document;
  } catch {
    // repli zip ci-dessous
  }

  const html = readFileFromEpubZip(epubBytes, href);
  if (!html) {
    throw new Error(`section not in epub zip: ${href}`);
  }
  const doc = parseSectionXhtml(html);
  section.document = doc;
  section.contents = doc.documentElement;
  return doc;
}

async function zoteroCfiFromEpubJsSection(
  book: EpubBook,
  sectionIndex: number,
  text: string,
  epubBytes: ArrayBuffer
): Promise<string | null> {
  const section = book.section(sectionIndex);
  if (!section?.cfiBase) return null;

  await ensureSectionDocument(book, section, epubBytes);
  const query = text.trim();
  if (query.length < 2) return null;

  const matches = section.find(query);
  if (!matches.length) return null;

  const want = normalizeWs(query);
  const hit =
    matches.find((m) => normalizeWs(m.cfi).includes(want.slice(0, 20))) ??
    matches[0];
  return shortenEpubCfi(hit.cfi);
}

/**
 * Construit position + sortIndex au format lecteur Zotero (epub.js sur le XHTML de section).
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
        : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

    const book = await openEpubBook(buf);

    let zoteroCfi = await zoteroCfiFromEpubJsSection(
      book,
      selection.sectionIndex,
      selection.text,
      buf
    );

    if (!zoteroCfi && foliateEl) {
      const contents = foliateEl.renderer?.getContents?.() ?? [];
      const range = liveRangeForSelection(contents, selection);
      const section = book.section(selection.sectionIndex);
      if (range && section?.cfiBase) {
        try {
          await ensureSectionDocument(book, section, buf);
          zoteroCfi = shortenEpubCfi(section.cfiFromRange(range));
        } catch {
          //
        }
      }
    }

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
