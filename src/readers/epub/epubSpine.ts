import { readFileFromEpubZip } from './epubArchiveLoad';

export type EpubSpineSection = {
  index: number;
  id: string;
  href: string;
  /** Préfixe CFI epub.js / Zotero, ex. `/6/14` ou `/6/14[idref]`. */
  cfiBase: string;
};

/** Base spine CFI (convention foliate / lecteur Zotero : `/6/{(index+1)*2}`). */
export function epubjsChapterCfiBase(
  spineIndex: number,
  idref: string
): string {
  let cfi = `/6/${(spineIndex + 1) * 2}`;
  if (idref) cfi += `[${idref}]`;
  return cfi;
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml');
}

function firstByLocalName(doc: Document | Element, name: string): Element | null {
  const all = doc.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === name) return all[i];
  }
  return null;
}

function allByLocalName(doc: Document | Element, name: string): Element[] {
  const out: Element[] = [];
  const all = doc.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === name) out.push(all[i]);
  }
  return out;
}

function resolveHref(opfDir: string, href: string): string {
  const h = href.replace(/\\/g, '/');
  if (!opfDir) return h.replace(/^\//, '');
  const base = opfDir.replace(/\\/g, '/').replace(/\/?$/, '/');
  if (h.startsWith('/')) return h.slice(1);
  return (base + h).replace(/\/+/g, '/');
}

/**
 * Lit le spine EPUB depuis le ZIP (sans epub.js / sans XHR).
 */
export function parseEpubSpine(bytes: ArrayBuffer): EpubSpineSection[] | null {
  const containerXml = readFileFromEpubZip(bytes, 'META-INF/container.xml');
  if (!containerXml) return null;

  const containerDoc = parseXml(containerXml);
  let opfPath: string | null = null;
  for (const rf of allByLocalName(containerDoc, 'rootfile')) {
    const mt = rf.getAttribute('media-type') ?? '';
    if (mt.includes('package') || mt.includes('opf')) {
      opfPath = rf.getAttribute('full-path');
      if (opfPath) break;
    }
  }
  if (!opfPath) return null;

  const opfXml = readFileFromEpubZip(bytes, opfPath);
  if (!opfXml) return null;

  const opfDoc = parseXml(opfXml);
  const opfDir = opfPath.includes('/')
    ? opfPath.replace(/\/[^/]+$/, '')
    : '';

  const manifest = new Map<string, { href: string }>();
  for (const item of allByLocalName(opfDoc, 'item')) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) manifest.set(id, { href });
  }

  const spineEl = firstByLocalName(opfDoc, 'spine');
  if (!spineEl) return null;

  const sections: EpubSpineSection[] = [];
  let index = 0;
  for (const ref of allByLocalName(spineEl, 'itemref')) {
    const idref = ref.getAttribute('idref');
    if (!idref) continue;
    const entry = manifest.get(idref);
    if (!entry) continue;
    sections.push({
      index,
      id: idref,
      href: resolveHref(opfDir, entry.href),
      cfiBase: epubjsChapterCfiBase(index, idref),
    });
    index++;
  }
  return sections.length ? sections : null;
}
