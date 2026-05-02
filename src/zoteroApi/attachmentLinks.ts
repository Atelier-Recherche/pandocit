import { Platform } from 'obsidian';

import { getFs, getPath } from 'src/platformAdapter';

import type { StoredZoteroItem } from './types';

export type ResolvedAttachmentLink =
  | { kind: 'zotero'; href: string }
  | { kind: 'local'; path: string }
  | { kind: 'web'; href: string };

/**
 * Chemins pour `linked_file` côté API Zotero / client bureau :
 * sous **Windows**, Zotero attend des antislashes (`D:\…`), comme les pièces jointes
 * créées dans l’appli — les slashs POSIX (`D:/…`) ouvrent souvent mal le fichier.
 */
export function pathForZoteroLinkedFileStorage(absPath: string): string {
  const p = absPath.trim();
  if (!p) return p;
  if (/^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('\\\\')) {
    return p.replace(/\//g, '\\');
  }
  return p.replace(/\\/g, '/');
}

/** URL utilisable dans un navigateur (Zotero accepte souvent une URL sans schéma). */
export function normalizeWebHref(raw: string): string {
  const u = raw.trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (/^\/\//.test(u)) return `https:${u}`;
  return `https://${u}`;
}

/**
 * Chemin local exploitable pour une pièce jointe « fichier lié » (API Zotero).
 * Les chemins `attachments:…` (stockage interne Zotero) ne sont pas résolus ici.
 */
export function getLinkedFilePathFromAttachmentData(
  data: Record<string, unknown>
): string | null {
  const linkMode = String(data.linkMode ?? '');
  const raw = typeof data.path === 'string' ? data.path.trim() : '';
  if (!raw || raw.startsWith('attachments:')) return null;
  if (/^https?:\/\//i.test(raw)) return null;

  if (linkMode && linkMode !== 'linked_file') return null;

  const looksFs =
    /^[a-zA-Z]:[\\/]/.test(raw) ||
    raw.startsWith('\\\\') ||
    raw.startsWith('/');

  const acceptAsPath =
    looksFs ||
    (linkMode === 'linked_file' &&
      (raw.includes('/') || raw.includes('\\')));

  if (!acceptAsPath) return null;

  if (!Platform.isDesktop) return raw;

  const fs = getFs();
  const pathMod = getPath();
  if (!fs) return raw;

  try {
    const norm = pathMod.normalize(raw);
    if (fs.existsSync(norm)) return norm;
    if (fs.existsSync(raw)) return raw;
  } catch {
    //
  }
  return raw;
}

export function resolveAttachmentLinks(
  att: StoredZoteroItem,
  zoteroUri: string | null
): ResolvedAttachmentLink[] {
  const d = att.data as Record<string, unknown>;
  const out: ResolvedAttachmentLink[] = [];

  if (zoteroUri) {
    out.push({ kind: 'zotero', href: zoteroUri });
  }

  const local = getLinkedFilePathFromAttachmentData(d);
  if (local) {
    out.push({ kind: 'local', path: local });
  }

  const rawUrl = typeof d.url === 'string' ? d.url.trim() : '';
  const url = normalizeWebHref(rawUrl);
  if (/^https?:\/\//i.test(url)) {
    out.push({ kind: 'web', href: url });
  }

  return out;
}
