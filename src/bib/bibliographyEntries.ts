import type { PartialCSLEntry } from './types';

export function looksLikeZoteroItemKey(id: string): boolean {
  return /^[A-Z0-9]{8}$/.test(id.trim());
}

/** Une entrée par citekey lisible (évite doublons clé API Zotero / alias bibCache). */
export function dedupeBibliographyEntries(
  entries: PartialCSLEntry[]
): PartialCSLEntry[] {
  const byId = new Map<string, PartialCSLEntry>();
  for (const e of entries) {
    if (!e?.id) continue;
    if (!byId.has(e.id)) byId.set(e.id, e);
  }

  const byTitle = new Map<string, PartialCSLEntry>();
  for (const e of byId.values()) {
    const titleKey = (e.title || '').trim().toLowerCase();
    if (!titleKey) {
      byTitle.set(`__id__:${e.id}`, e);
      continue;
    }
    const cur = byTitle.get(titleKey);
    if (!cur) {
      byTitle.set(titleKey, e);
      continue;
    }
    const curFallback = looksLikeZoteroItemKey(cur.id);
    const nextFallback = looksLikeZoteroItemKey(e.id);
    if (curFallback && !nextFallback) {
      byTitle.set(titleKey, e);
      continue;
    }
    if (curFallback === nextFallback && e.id.length < cur.id.length) {
      byTitle.set(titleKey, e);
    }
  }

  return Array.from(byTitle.values());
}

export function listBibliographyEntriesFromCache(
  bibCache: Map<string, PartialCSLEntry>
): PartialCSLEntry[] {
  return dedupeBibliographyEntries(Array.from(bibCache.values()));
}
