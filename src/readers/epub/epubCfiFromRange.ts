// CFI foliate (pas de dépendance epub.js) — bundlé dans main.js
import { fromRange, joinIndir } from '../../../foliate/epubcfi.js';

import { shortenEpubCfi } from './epubCfiBridge';

/** CFI complet (raccourci pour Zotero) à partir d’une plage DOM et base spine epub.js. */
export function zoteroCfiFromDomRange(cfiBase: string, range: Range): string {
  const baseWrapped = cfiBase.startsWith('epubcfi(')
    ? cfiBase
    : `epubcfi(${cfiBase})`;
  const full = joinIndir(baseWrapped, fromRange(range));
  return shortenEpubCfi(full);
}
