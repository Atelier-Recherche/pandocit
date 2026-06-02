import type { DocumentAnnotation } from '../../annotations/types';
import {
  cfiFromZoteroAnnotationPosition,
  lengthenEpubCfi,
} from './epubCfiBridge';
import { findRangeForText } from './epubTextRange';
import { sectionIndexFromEpubCfi } from './epubZoteroPosition';

type FoliateViewEl = HTMLElement & {
  getCFI?: (index: number, range: Range) => string;
  resolveCFI?: (cfi: string) => { index: number; anchor: (doc: Document) => Range } | null;
  renderer?: { getContents?: () => Array<{ index: number; doc: Document }> };
};

/**
 * CFI foliate pour surlignage : préfère le CFI sidecar, sinon résout le CFI Zotero
 * (essai direct puis recherche texte + getCFI).
 */
export function foliateCfiForAnnotation(
  view: FoliateViewEl | null | undefined,
  ann: DocumentAnnotation
): string | undefined {
  const raw = ann.cfi?.trim();
  if (!raw) return undefined;

  const parsed = cfiFromZoteroAnnotationPosition(raw) ?? raw;
  const wrapped = lengthenEpubCfi(parsed);

  if (ann.source === 'sidecar' && wrapped.startsWith('epubcfi(')) {
    return wrapped;
  }

  if (!view?.getCFI) {
    return wrapped.startsWith('epubcfi(') ? wrapped : undefined;
  }

  if (wrapped.startsWith('epubcfi(') && view.resolveCFI) {
    try {
      const resolved = view.resolveCFI(wrapped);
      if (resolved) {
        const contents = view.renderer?.getContents?.() ?? [];
        const content = contents.find((c) => c.index === resolved.index);
        if (content) {
          const range = resolved.anchor(content.doc);
          if (range && !range.collapsed) {
            const foliate = view.getCFI(resolved.index, range);
            if (foliate.startsWith('epubcfi(')) return foliate;
          }
        }
      }
    } catch {
      // recherche texte ci-dessous
    }
  }

  const text = ann.text?.trim();
  if (!text || text.length < 2) {
    return wrapped.startsWith('epubcfi(') ? wrapped : undefined;
  }

  const sectionIndex =
    ann.sectionIndex ?? sectionIndexFromEpubCfi(wrapped);
  const contents = view.renderer?.getContents?.() ?? [];
  for (const { index, doc } of contents) {
    if (index !== sectionIndex) continue;
    const range = findRangeForText(doc, text);
    if (!range) continue;
    try {
      const foliate = view.getCFI(index, range);
      if (foliate.startsWith('epubcfi(')) return foliate;
    } catch {
      //
    }
  }

  return wrapped.startsWith('epubcfi(') ? wrapped : undefined;
}
