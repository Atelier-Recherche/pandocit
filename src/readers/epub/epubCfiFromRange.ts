/**
 * CFI au format lecteur Zotero (epub.js EpubCFI), pas foliate.
 * On vendore uniquement la classe EpubCFI + un shim core (~45 Ko),
 * sans le reader epub.js complet.
 */
// @ts-expect-error vendored CJS/ESM hybrid without types
import EpubCFI from './vendor/epubcfi.js';

import { shortenEpubCfi, stripEpubCfiIdAssertions } from './epubCfiBridge';

/** CFI Zotero (raccourci ou long) à partir d’une plage DOM et base spine `/6/N`. */
export function zoteroCfiFromDomRange(cfiBase: string, range: Range): string {
  const base = stripEpubCfiIdAssertions(
    cfiBase.startsWith('epubcfi(') ? shortenEpubCfi(cfiBase) : cfiBase.trim()
  );
  const cfi = new EpubCFI(range, base);
  return stripEpubCfiIdAssertions(shortenEpubCfi(String(cfi)));
}
