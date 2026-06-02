import { strFromU8, unzipSync } from 'fflate';

/** Lit un fichier dans l’EPUB (chemin relatif OPF, ex. `OEBPS/ch01.xhtml`). */
export function readFileFromEpubZip(
  bytes: ArrayBuffer,
  href: string
): string | null {
  const zip = unzipSync(new Uint8Array(bytes));
  const want = href.replace(/\\/g, '/').replace(/^\//, '');
  const key =
    Object.keys(zip).find((k) => {
      const p = k.replace(/\\/g, '/');
      return p === want || p.endsWith('/' + want);
    }) ?? null;
  if (!key) return null;
  return strFromU8(zip[key]);
}

export function parseSectionXhtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'application/xhtml+xml');
}
