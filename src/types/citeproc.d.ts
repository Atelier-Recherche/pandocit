declare module 'citeproc' {
  export interface CiteprocSys {
    retrieveLocale(id: string): string | undefined;
    retrieveItem(id: string): unknown;
  }

  export interface CiteprocBibliographyMeta {
    bibstart: string;
    bibend: string;
    /** Une entrée par item : `[citekey, ...]`. */
    entry_ids?: string[][];
  }

  /** `false` quand le style n’a pas de bibliographie. */
  export type CiteprocBibliography =
    | [CiteprocBibliographyMeta, string[]]
    | false;

  /** `[citationID, noteIndex, html]` */
  export type CiteprocBakedCitation = [string, number, string];

  export interface CiteprocEngine {
    opt: {
      xclass: 'note' | 'in-text';
      development_extensions: Record<string, boolean>;
    };
    rebuildProcessorState(
      citations: unknown[],
      mode?: string
    ): CiteprocBakedCitation[];
    makeCitationCluster(items: unknown[]): string;
    makeBibliography(): CiteprocBibliography;
  }

  interface CSLStatic {
    Engine: new (
      sys: CiteprocSys,
      style: string,
      lang?: string,
      forceLang?: boolean
    ) => CiteprocEngine;
    LANGS: Record<string, string | false>;
    LANG_BASES: Record<string, string>;
  }

  const CSL: CSLStatic;
  export default CSL;
}
