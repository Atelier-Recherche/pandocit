export type AnnotationSource =
  | 'local-pdf'
  | 'zotero'
  | 'sidecar'
  | 'hypothesis';

export interface DocumentAnnotation {
  id: string;
  source: AnnotationSource;
  text: string;
  comment: string;
  color?: string;
  pageLabel?: string;
  pageIndex?: number;
  cfi?: string;
  /** Index de section foliate (spine) pour recalcul CFI Zotero. */
  sectionIndex?: number;
  /** CFI epub.js (Zotero) — peut différer du CFI foliate. */
  zoteroCfi?: string;
  zoteroSortIndex?: string;
  zoteroKey?: string;
  created?: string;
  /** PDF rects in page space */
  rects?: Array<{ x: number; y: number; width: number; height: number }>;
  /** Rendu PDF : surlignage, soulignement, barré, ondulé */
  markupStyle?: 'highlight' | 'underline' | 'strikeout' | 'squiggly';
  /** Opacité du surlignage (0–1), lecteur EPUB */
  opacity?: number;
}

export interface ZoteroAnnotationRow {
  key: string;
  annotationText: string;
  annotationComment: string;
  annotationPageLabel: string;
  annotationColor: string;
  annotationType: string;
  parentAttachmentKey: string;
  parentTitle: string;
  topItemTitle: string;
  citekey: string;
}
