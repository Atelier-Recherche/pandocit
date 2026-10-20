import type { DocumentAnnotation } from '../../annotations/types';
import {
  cfiFromZoteroAnnotationPosition,
  lengthenEpubCfi,
  sanitizeEpubCfiValue,
} from './epubCfiBridge';
import { findRangeForText } from './epubTextRange';
import { sectionIndexFromEpubCfi } from './epubZoteroPosition';

type FoliateViewEl = HTMLElement & {
  getCFI?: (index: number, range: Range) => string;
  resolveCFI?: (
    cfi: string
  ) => { index: number; anchor: (doc: Document) => Range } | null;
  renderer?: { getContents?: () => Array<{ index: number; doc: Document }> };
};

function tryFoliateFromRange(
  view: FoliateViewEl,
  index: number,
  range: Range | null | undefined
): string | undefined {
  if (!range || range.collapsed || !view.getCFI) return undefined;
  try {
    const foliate = view.getCFI(index, range);
    if (foliate?.startsWith('epubcfi(')) return foliate;
  } catch {
    //
  }
  return undefined;
}

function tryResolveZoteroCfi(
  view: FoliateViewEl,
  wrapped: string
): string | undefined {
  if (!view.resolveCFI || !wrapped.startsWith('epubcfi(')) return undefined;
  const candidates = [
    wrapped,
    lengthenEpubCfi(sanitizeEpubCfiValue(wrapped)),
  ];
  const contents = view.renderer?.getContents?.() ?? [];
  for (const cfi of candidates) {
    try {
      const resolved = view.resolveCFI(cfi);
      if (!resolved) continue;
      const content = contents.find((c) => c.index === resolved.index);
      if (!content) continue;
      const range = resolved.anchor(content.doc);
      const hit = tryFoliateFromRange(view, resolved.index, range);
      if (hit) return hit;
    } catch {
      //
    }
  }
  return undefined;
}

function tryTextRelocate(
  view: FoliateViewEl,
  text: string,
  preferredSection?: number
): string | undefined {
  if (!text || text.length < 2 || !view.getCFI) return undefined;
  const contents = view.renderer?.getContents?.() ?? [];
  if (!contents.length) return undefined;

  const ordered =
    preferredSection != null
      ? [
          ...contents.filter((c) => c.index === preferredSection),
          ...contents.filter((c) => c.index !== preferredSection),
        ]
      : contents;

  for (const { index, doc } of ordered) {
    const range = findRangeForText(doc, text);
    const hit = tryFoliateFromRange(view, index, range);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * CFI foliate pour surlignage : préfère le CFI sidecar, sinon résout le CFI Zotero
 * (essai direct puis recherche texte sur toutes les sections chargées).
 */
export function foliateCfiForAnnotation(
  view: FoliateViewEl | null | undefined,
  ann: DocumentAnnotation
): string | undefined {
  const raw = ann.cfi?.trim();
  if (!raw) return undefined;

  const parsed = cfiFromZoteroAnnotationPosition(raw) ?? raw;
  const wrapped = lengthenEpubCfi(sanitizeEpubCfiValue(parsed));

  if (ann.source === 'sidecar' && wrapped.startsWith('epubcfi(')) {
    return wrapped;
  }

  if (!view?.getCFI) {
    return wrapped.startsWith('epubcfi(') ? wrapped : undefined;
  }

  const fromCfi = tryResolveZoteroCfi(view, wrapped);
  if (fromCfi) return fromCfi;

  const text = ann.text?.trim() ?? '';
  const sectionIndex = ann.sectionIndex ?? sectionIndexFromEpubCfi(wrapped);
  const fromText = tryTextRelocate(view, text, sectionIndex);
  if (fromText) return fromText;

  // Dernier recours : CFI Zotero brut (peut échouer silencieusement dans foliate).
  return wrapped.startsWith('epubcfi(') ? wrapped : undefined;
}
