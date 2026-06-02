/** CFI sans enveloppe `epubcfi(…)` — format valeur Zotero / epub.js. */
export function shortenEpubCfi(cfi: string): string {
  const t = cfi.trim();
  const m = t.match(/^epubcfi\((.+)\)$/i);
  return m ? m[1] : t;
}

/** Préfixe spine (`/6/N`) avant `!` — base epub.js dérivée d’un CFI foliate. */
export function epubjsCfiBaseFromFoliateCfi(cfi: string): string {
  const inner = shortenEpubCfi(cfi);
  const bang = inner.indexOf('!');
  return bang >= 0 ? inner.slice(0, bang) : inner;
}

/** CFI avec enveloppe — format foliate-js. */
export function lengthenEpubCfi(cfi: string): string {
  const t = cfi.trim();
  if (/^epubcfi\(/i.test(t)) return t;
  return `epubcfi(${t})`;
}

/** Extrait un CFI EPUB utilisable par foliate-js depuis `annotationPosition` Zotero. */
export function cfiFromZoteroAnnotationPosition(raw: string): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  if (t.startsWith('epubcfi(')) return t;

  try {
    const parsed = JSON.parse(t) as unknown;
    return extractCfiFromParsed(parsed);
  } catch {
    const m = t.match(/epubcfi\([^)]+\)/);
    return m ? m[0] : undefined;
  }
}

function extractCfiFromParsed(obj: unknown): string | undefined {
  if (!obj) return undefined;
  if (typeof obj === 'string') {
    const v = obj.trim();
    if (!v) return undefined;
    if (v.startsWith('epubcfi(')) return v;
    if (v.includes('/')) return lengthenEpubCfi(v);
    return undefined;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const c = extractCfiFromParsed(item);
      if (c) return c;
    }
    return undefined;
  }
  if (typeof obj !== 'object') return undefined;

  const o = obj as Record<string, unknown>;
  if (typeof o.value === 'string' && o.value.trim()) {
    const v = o.value.trim();
    if (v.startsWith('epubcfi(')) return v;
    return lengthenEpubCfi(v);
  }
  if (typeof o.cfi === 'string' && o.cfi.trim()) {
    const v = o.cfi.trim();
    if (v.startsWith('epubcfi(')) return v;
    return lengthenEpubCfi(v);
  }
  if (Array.isArray(o.selector)) {
    for (const s of o.selector) {
      const c = extractCfiFromParsed(s);
      if (c) return c;
    }
  }
  if (o.position) return extractCfiFromParsed(o.position);
  if (o.target) return extractCfiFromParsed(o.target);
  return undefined;
}

/** Format FragmentSelector attendu par Zotero pour les pièces jointes EPUB. */
export function zoteroPositionFromEpubCfi(cfi: string): string {
  const value = shortenEpubCfi(cfi);
  return zoteroPositionFromCfiValue(value);
}

export function zoteroPositionFromCfiValue(cfiValue: string): string {
  const value = shortenEpubCfi(cfiValue);
  return JSON.stringify({
    type: 'FragmentSelector',
    conformsTo: 'http://www.idpf.org/epub/linking/cfi/epub-cfi.html',
    value,
  });
}

/**
 * Index de tri Zotero pour annotations EPUB : `#####|########` (5 + 8 chiffres).
 * @see zotero item.js — `parentItem?.isEPUBAttachment()`
 */
export function zoteroSortIndexFromEpubCfi(cfi: string): string {
  const bang = cfi.indexOf('!');
  const spinePart = bang >= 0 ? cfi.slice(0, bang) : cfi;
  const rangePart = bang >= 0 ? cfi.slice(bang + 1) : '';

  const spineMatch =
    spinePart.match(/\/6\/(\d+)\s*$/i) ?? spinePart.match(/\/(\d+)\s*$/);
  const spine = spineMatch ? parseInt(spineMatch[1], 10) : 0;

  const offsetMatch = rangePart.match(/,\/(\d+):(\d+)/);
  const offset = offsetMatch ? parseInt(offsetMatch[2], 10) : 0;

  return `${String(Math.max(0, spine)).padStart(5, '0')}|${String(Math.max(0, offset)).padStart(8, '0')}`;
}

/** Couleur d’affichage foliate (hex CSS). */
export function normalizeEpubHighlightColor(color: string | undefined): string {
  const c = String(color ?? '').trim();
  if (!c) return '#ffd400';
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^[0-9a-f]{6}$/i.test(c)) return `#${c}`;
  const rgb = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const hex = (n: string) =>
      Math.min(255, parseInt(n, 10)).toString(16).padStart(2, '0');
    return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`;
  }
  return '#ffd400';
}
