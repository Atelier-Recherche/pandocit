import type { StoredZoteroItem, ZoteroStoreSnapshot } from './types';

export type ParsedStorageKey =
  | { scope: 'primary'; plainKey: string }
  | { scope: 'group'; groupId: number; plainKey: string };

/** Clé préfixée `g{groupId}_{itemKey}` pour fusionner une bib. de groupe dans la vue utilisateur */
export function parseStorageItemKey(fullKey: string): ParsedStorageKey {
  const m = fullKey.match(/^g(\d+)_(.+)$/);
  if (m) {
    const groupId = parseInt(m[1], 10);
    if (Number.isFinite(groupId) && m[2]) {
      return { scope: 'group', groupId, plainKey: m[2] };
    }
  }
  return { scope: 'primary', plainKey: fullKey };
}

/** Lien `zotero://select/…` : la clé stockée peut être `g{groupId}_{itemKey}` (bib. fusionnée). */
export function zoteroUriForStorageKey(
  fullKey: string,
  settings: {
    zoteroApiLibraryType?: 'user' | 'group';
    zoteroApiUserId?: number;
    zoteroApiGroupId?: number;
  }
): string | null {
  const parsed = parseStorageItemKey(fullKey);
  if (parsed.scope === 'group') {
    return `zotero://select/items/@${parsed.groupId}_${parsed.plainKey}`;
  }
  const libId =
    settings.zoteroApiLibraryType === 'group'
      ? settings.zoteroApiGroupId
      : settings.zoteroApiUserId;
  if (libId == null) return null;
  return `zotero://select/items/@${libId}_${parsed.plainKey}`;
}

export function mergeUserAndGroupSnapshots(
  userSnap: ZoteroStoreSnapshot,
  groupSnap: ZoteroStoreSnapshot,
  groupId: number
): ZoteroStoreSnapshot {
  const gp = `g${groupId}_`;
  const collP = `${gp}c_`;
  const items: Record<string, StoredZoteroItem> = { ...userSnap.items };
  for (const [k, v] of Object.entries(groupSnap.items)) {
    const nk = `${gp}${k}`;
    const data = { ...v.data };
    if (typeof data.parentItem === 'string') {
      data.parentItem = `${gp}${data.parentItem}`;
    }
    if (Array.isArray(data.collections)) {
      data.collections = (data.collections as unknown[]).map((c) =>
        typeof c === 'string' ? `${collP}${c}` : c
      );
    }
    items[nk] = {
      ...v,
      key: nk,
      data,
    };
  }
  return {
    libraryVersion: Math.max(userSnap.libraryVersion, groupSnap.libraryVersion),
    items,
    pendingDeleteKeys: [
      ...userSnap.pendingDeleteKeys,
      ...groupSnap.pendingDeleteKeys.map((x) => `${gp}${x}`),
    ],
    retryFetchKeys: [
      ...userSnap.retryFetchKeys,
      ...groupSnap.retryFetchKeys.map((x) => `${gp}${x}`),
    ],
  };
}
