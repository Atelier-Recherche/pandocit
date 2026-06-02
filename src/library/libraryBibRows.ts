import type { PartialCSLEntry } from '../bib/types';
import { getPath } from '../platformAdapter';
import type { StoredZoteroItem } from '../zoteroApi/types';

export const BIB_FILE_ROW_PREFIX = 'bibfile:';
export const BIB_FILE_ITEM_TYPE = 'bibFileEntry';

export function isBibliographyFileRow(stored: StoredZoteroItem): boolean {
  return (
    stored.key.startsWith(BIB_FILE_ROW_PREFIX) ||
    String(stored.data?.itemType ?? '') === BIB_FILE_ITEM_TYPE
  );
}

export function bibliographyRowFromEntry(entry: PartialCSLEntry): {
  key: string;
  stored: StoredZoteroItem;
  title: string;
  citekey: string;
} {
  const key = `${BIB_FILE_ROW_PREFIX}${entry.id}`;
  return {
    key,
    stored: {
      key,
      version: 0,
      synced: true,
      data: {
        itemType: BIB_FILE_ITEM_TYPE,
        title: entry.title || entry.id,
        citationKey: entry.id,
      },
    },
    title: entry.title || entry.id,
    citekey: entry.id,
  };
}

/** Pièces jointes synthétiques pour les champs `file` d’un export Better BibTeX. */
export function bibFileAttachmentsFromPaths(
  citekey: string,
  paths: string[]
): StoredZoteroItem[] {
  const pathMod = getPath();
  const out: StoredZoteroItem[] = [];
  const seen = new Set<string>();
  for (const raw of paths) {
    const p = raw?.trim();
    if (!p || seen.has(p)) continue;
    seen.add(p);
    const filename = pathMod.basename(p);
    out.push({
      key: `${BIB_FILE_ROW_PREFIX}${citekey}:file:${out.length}`,
      version: 0,
      synced: true,
      data: {
        itemType: 'attachment',
        linkMode: 'linked_file',
        path: p,
        filename,
        title: filename,
      },
    });
  }
  return out;
}
