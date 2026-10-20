/** CFI sans enveloppe `epubcfi(…)` — format valeur Zotero / epub.js. */
export function shortenEpubCfi(cfi: string): string {
  const t = cfi.trim();
  const m = t.match(/^epubcfi\((.+)\)$/i);
  return m ? m[1] : t;
}

/**
 * Retire les assertions d’ID CFI (`[couv]`, etc.) — foliate-js les gère mal
 * alors que Zotero / epub.js les produit souvent.
 */
export function stripEpubCfiIdAssertions(cfi: string): string {
  return cfi.replace(/\[[^\]]*]/g, '');
}

/** Nettoie une valeur CFI (backslashs JSON survivants, assertions ID). */
export function sanitizeEpubCfiValue(cfi: string): string {
  let v = cfi.trim().replace(/\\\//g, '/');
  v = stripEpubCfiIdAssertions(v);
  return v;
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
  if (t.startsWith('epubcfi(') || t.startsWith('/')) {
    return lengthenEpubCfi(sanitizeEpubCfiValue(t));
  }

  try {
    const parsed = JSON.parse(t) as unknown;
    return extractCfiFromParsed(parsed);
  } catch {
    const m = t.match(/epubcfi\([^)]+\)/);
    return m ? lengthenEpubCfi(sanitizeEpubCfiValue(m[0])) : undefined;
  }
}

function extractCfiFromParsed(obj: unknown): string | undefined {
  if (!obj) return undefined;
  if (typeof obj === 'string') {
    const v = sanitizeEpubCfiValue(obj);
    if (!v) return undefined;
    if (v.startsWith('epubcfi(') || v.includes('/')) return lengthenEpubCfi(v);
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
    return lengthenEpubCfi(sanitizeEpubCfiValue(o.value));
  }
  if (typeof o.cfi === 'string' && o.cfi.trim()) {
    return lengthenEpubCfi(sanitizeEpubCfiValue(o.cfi));
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

/**
 * Format FragmentSelector Zotero pour EPUB.
 * Important : la `value` doit être `epubcfi(…)` **avec** enveloppe (comme le reader
 * Zotero mobile), et **sans** assertions d’ID spine (`[couv]`) — celles-ci font
 * planter / blanchir le lecteur Zotero bureau sur certains EPUB.
 */
export function zoteroPositionFromEpubCfi(cfi: string): string {
  return zoteroPositionFromCfiValue(cfi);
}

export function zoteroPositionFromCfiValue(cfiValue: string): string {
  const value = lengthenEpubCfi(
    stripEpubCfiIdAssertions(shortenEpubCfi(cfiValue))
  );
  return JSON.stringify({
    type: 'FragmentSelector',
    conformsTo: 'http://www.idpf.org/epub/linking/cfi/epub-cfi.html',
    value,
  });
}

/**
 * Index de tri Zotero pour annotations EPUB : `#####|########` (5 + 8 chiffres).
 * Le 1er champ est l’**index de section spine** (0-based), PAS le numéro CFI `/6/N`.
 * @see zotero/reader epub-view.ts — `getAnnotationFromRange`
 */
export function zoteroSortIndexFromEpubCfi(
  cfi: string,
  charOffset?: number
): string {
  const cleaned = stripEpubCfiIdAssertions(shortenEpubCfi(cfi));
  const bang = cleaned.indexOf('!');
  const spinePart = bang >= 0 ? cleaned.slice(0, bang) : cleaned;
  const rangePart = bang >= 0 ? cleaned.slice(bang + 1) : '';

  const spineMatch = spinePart.match(/\/6\/(\d+)/i);
  const spineNum = spineMatch ? parseInt(spineMatch[1], 10) : 0;
  // `/6/{(index+1)*2}` → index = N/2 - 1
  const sectionIndex = Math.max(0, Math.round(spineNum / 2) - 1);

  let offset = charOffset;
  if (offset == null) {
    const offsetMatch = rangePart.match(/,\/(\d+):(\d+)/);
    offset = offsetMatch ? parseInt(offsetMatch[2], 10) : 0;
  }

  return `${String(sectionIndex).padStart(5, '0')}|${String(Math.max(0, offset ?? 0)).padStart(8, '0')}`;
}

/** Comme Zotero reader : `sectionIndex` + offset caractères depuis le début de la section. */
export function zoteroSortIndexFromSectionOffset(
  sectionIndex: number,
  charOffset: number
): string {
  return `${String(Math.max(0, sectionIndex)).padStart(5, '0')}|${String(Math.max(0, charOffset)).padStart(8, '0')}`;
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
