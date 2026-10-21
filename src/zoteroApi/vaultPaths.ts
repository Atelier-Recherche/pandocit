import type { App } from 'obsidian';

import { getPath } from '../platformAdapter';
import { getVaultRoot } from '../helpers';

/** Chemin absolu pour une pièce jointe Zotero `linked_file`. */
export function resolveVaultPdfAbsolutePath(app: App, input: string): string {
  const v = input.trim();
  if (!v) return '';
  const pathMod = getPath();
  if (pathMod.isAbsolute(v)) return pathMod.normalize(v);
  const root = getVaultRoot(app);
  if (!root) return v;
  return pathMod.join(root, v.replace(/^[/\\]+/, ''));
}
