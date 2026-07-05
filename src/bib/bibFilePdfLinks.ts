/**
 * Extrait les champs BibTeX `file` (p. ex. export Better BibTeX) et les mappe aux clés d'entrée.
 * Les chemins sont passés tels quels à `openPdfAbsolutePathInObsidianOrExternal`, qui résout
 * vers le coffre comme pour les pièces jointes Zotero.
 */

const ENTRY_HEAD_RE = /@\w+\s*\{\s*([^,\s#}%]+)\s*,/g;
const FILE_FIELD_RE = /file\s*=\s*(\{((?:[^{}]|\{[^{}]*\})*)\}|"([^"]*)")/gi;
const DOCUMENT_EXT_RE = /\.(pdf|epub)(\b|$)/i;

/**
 * Supprime les commentaires % (hors \%).
 * Pas de lookbehind (non supporté sur iOS < 16.4) : on capture le caractère précédent
 * (ou le début de ligne) et on le réinjecte dans le remplacement.
 */
export function stripBibTeXComments(source: string): string {
  return source.replace(/(^|[^\\])%.*$/gm, (_match, prefix: string) => prefix);
}

/**
 * Découpe un champ `file` BBT (chemins séparés par `:` ; attention aux lecteurs Windows).
 * Pas de lookbehind/lookahead combinés (non supportés sur iOS < 16.4) : on repère les
 * limites de coupe via des groupes capturants puis on reconstruit les segments à la main.
 */
export function splitBibFileFieldValue(raw: string): string[] {
  const v = raw.trim();
  if (!v) return [];

  if (!v.includes(':')) return [v];

  const multiDriveSplit =
    /(\.(?:pdf|epub|djvu|docx?|html?|txt|rtf|odt|mobi|azw\d?))(:+)(?=[A-Za-z]:[\\/])/gi;
  const boundaries: Array<[number, number]> = [];
  let dm: RegExpExecArray | null;
  while ((dm = multiDriveSplit.exec(v)) !== null) {
    const extEnd = dm.index + dm[1].length;
    const colonsEnd = extEnd + dm[2].length;
    boundaries.push([extEnd, colonsEnd]);
  }

  if (boundaries.length) {
    const parts: string[] = [];
    let cursor = 0;
    for (const [extEnd, colonsEnd] of boundaries) {
      parts.push(v.slice(cursor, extEnd));
      cursor = colonsEnd;
    }
    parts.push(v.slice(cursor));
    return parts.map((s) => s.trim()).filter(Boolean);
  }

  if (/^[A-Za-z]:[\\/]/.test(v)) return [v];

  return v
    .split(':')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function extractFileFieldsFromBibEntry(block: string): string[] {
  const paths: string[] = [];
  let m: RegExpExecArray | null;
  FILE_FIELD_RE.lastIndex = 0;
  while ((m = FILE_FIELD_RE.exec(block)) !== null) {
    const inner = (m[2] ?? m[3] ?? '').trim();
    for (const part of splitBibFileFieldValue(inner)) {
      if (part && !paths.includes(part)) paths.push(part);
    }
  }
  return paths;
}

export function parseBibTeXFilePaths(source: string): Map<string, string[]> {
  const text = stripBibTeXComments(source);
  const map = new Map<string, string[]>();

  const heads: { key: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  ENTRY_HEAD_RE.lastIndex = 0;
  while ((m = ENTRY_HEAD_RE.exec(text)) !== null) {
    heads.push({ key: m[1], index: m.index });
  }

  for (let i = 0; i < heads.length; i++) {
    const { key, index } = heads[i];
    const end =
      i + 1 < heads.length ? heads[i + 1].index : text.length;
    const block = text.slice(index, end);
    const files = extractFileFieldsFromBibEntry(block).filter((p) =>
      DOCUMENT_EXT_RE.test(p)
    );
    if (!files.length) continue;

    const arr = map.get(key) ?? [];
    for (const f of files) {
      if (!arr.includes(f)) arr.push(f);
    }
    map.set(key, arr);
  }

  return map;
}
