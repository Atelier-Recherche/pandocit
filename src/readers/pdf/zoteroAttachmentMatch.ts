import { TFile } from 'obsidian';

import { resolveVaultRelativePdfPath } from '../../helpers';
import type ReferenceList from '../../main';
import { readerRegistry } from '../readerRegistry';
import type { ZoteroStoreSnapshot } from '../../zoteroApi/types';
import { getLinkedFilePathFromAttachmentData } from '../../zoteroApi/attachmentLinks';
import { parseStorageItemKey } from '../../zoteroApi/zoteroMerge';

/** Tous les identifiants possibles d'une pièce jointe dans le snapshot. */
export function collectAttachmentParentIds(
  snap: ZoteroStoreSnapshot,
  attachmentStorageKey: string
): Set<string> {
  const ids = new Set<string>();
  if (!attachmentStorageKey) return ids;

  ids.add(attachmentStorageKey);
  const plain = parseStorageItemKey(attachmentStorageKey).plainKey;
  ids.add(plain);

  const attachSt = snap.items[attachmentStorageKey];
  if (attachSt) {
    ids.add(attachSt.key);
    const dk = attachSt.data?.key;
    if (typeof dk === 'string' && dk.trim()) ids.add(dk.trim());
  }

  for (const [k, st] of Object.entries(snap.items)) {
    if (String(st.data.itemType) !== 'attachment') continue;
    if (parseStorageItemKey(k).plainKey !== plain) continue;
    ids.add(k);
    const dk = st.data?.key;
    if (typeof dk === 'string' && dk.trim()) ids.add(dk.trim());
  }

  return ids;
}

export function annotationBelongsToAttachment(
  snap: ZoteroStoreSnapshot,
  annotationParentItem: string,
  attachmentStorageKey: string
): boolean {
  if (!annotationParentItem || !attachmentStorageKey) return false;

  const parentIds = collectAttachmentParentIds(snap, attachmentStorageKey);
  if (parentIds.has(annotationParentItem)) return true;

  const parentPlain = parseStorageItemKey(annotationParentItem).plainKey;
  const attachPlain = parseStorageItemKey(attachmentStorageKey).plainKey;
  if (parentPlain === attachPlain) return true;

  const parentSt = snap.items[annotationParentItem];
  if (
    parentSt &&
    String(parentSt.data.itemType) === 'attachment' &&
    parseStorageItemKey(parentSt.key).plainKey === attachPlain
  ) {
    return true;
  }

  return false;
}

/** @deprecated Utiliser {@link annotationBelongsToAttachment} */
export function attachmentKeyMatchesParent(
  parentItem: string,
  attachmentKey: string
): boolean {
  if (!parentItem || !attachmentKey) return false;
  if (parentItem === attachmentKey) return true;
  const attach = parseStorageItemKey(attachmentKey);
  const parent = parseStorageItemKey(parentItem);
  return attach.plainKey === parent.plainKey;
}

function normPathKey(p: string): string {
  return p.replace(/\\/g, '/').normalize('NFC').toLowerCase();
}

function attachmentBasename(d: Record<string, unknown>): string {
  const fromFilename =
    typeof d.filename === 'string' ? d.filename.trim() : '';
  if (fromFilename) return fromFilename.replace(/\\/g, '/').split('/').pop() ?? '';

  const raw = String(d.path ?? d.url ?? d.title ?? '').trim();
  if (!raw) return '';
  return raw.replace(/\\/g, '/').split('/').pop() ?? '';
}

function attachmentMatchesFileExt(
  d: Record<string, unknown>,
  fileExt: string
): boolean {
  const ct = String(d.contentType ?? '').toLowerCase();
  const name = attachmentBasename(d).toLowerCase();
  if (fileExt === 'epub') {
    if (ct.includes('epub')) return true;
    if (name.endsWith('.epub')) return true;
    return false;
  }
  if (fileExt === 'pdf') {
    if (ct.includes('pdf')) return true;
    if (name.endsWith('.pdf')) return true;
    return false;
  }
  return true;
}

/**
 * Trouve la pièce jointe Zotero liée à un PDF/EPUB du coffre
 * (chemin lié, puis nom de fichier, en privilégiant le contentType).
 */
export async function findZoteroAttachmentKeyForVaultFile(
  plugin: ReferenceList,
  file: TFile,
  opts?: { fresh?: boolean }
): Promise<string | undefined> {
  if (!plugin.settings.pullFromZoteroApi) return undefined;

  if (!opts?.fresh) {
    const reg = readerRegistry.get(file.path);
    if (reg?.zoteroAttachmentKey) {
      return reg.zoteroAttachmentKey;
    }
  }

  const snap = await plugin.zoteroSync.loadSnapshot();
  const normFile = normPathKey(file.path);
  const fileName = normFile.split('/').pop() ?? '';
  const fileExt = file.extension.toLowerCase();

  let filenameMatch: string | undefined;
  let bestNameLen = 0;
  let bestExtMatch = false;

  for (const st of Object.values(snap.items)) {
    if (String(st.data.itemType) !== 'attachment') continue;
    const d = st.data as Record<string, unknown>;
    const extOk = attachmentMatchesFileExt(d, fileExt);

    const linked = getLinkedFilePathFromAttachmentData(d);
    if (linked) {
      const vaultPath = resolveVaultRelativePdfPath(linked);
      if (vaultPath && normPathKey(vaultPath) === normFile) {
        // Match chemin exact : priorité maximale, surtout si contentType cohérent.
        if (extOk) return st.key;
        if (!filenameMatch) filenameMatch = st.key;
        continue;
      }
    }

    if (!fileName) continue;
    const name = normPathKey(attachmentBasename(d));
    if (!name || !normFile.endsWith(name)) continue;

    const betterExt = extOk && !bestExtMatch;
    const longer = name.length > bestNameLen && extOk === bestExtMatch;
    if (betterExt || longer || (!filenameMatch && name.length >= bestNameLen)) {
      bestNameLen = name.length;
      bestExtMatch = extOk;
      filenameMatch = st.key;
    }
  }

  return filenameMatch;
}
