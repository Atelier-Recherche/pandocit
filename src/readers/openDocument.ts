import { Notice, Platform, TFile } from 'obsidian';

import { t } from '../lang/helpers';
import {
  openPdfAbsolutePathInObsidianOrExternal,
  resolveVaultRelativePdfPath,
} from '../helpers';
import type ReferenceList from '../main';
import { openInPandocitReader } from './documentRouter';
import { openEpubAtAnnotation } from './epub/navigateEpubAnnotation';

export interface OpenDocumentOptions {
  page?: number;
  zoteroAnnotationKey?: string;
  /** CFI EPUB (foliate) pour aller à une annotation. */
  gotoCfi?: string;
  reuseOpenPdfLeaf?: boolean;
}

function extOf(path: string): string {
  const m = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

function viewStatePath(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null;
  const s = state as Record<string, unknown>;
  if (typeof s.path === 'string' && s.path) return s.path;
  if (typeof s.file === 'string' && s.file) return s.file;
  return null;
}

async function tryOpenPdfInExistingLeaf(
  plugin: ReferenceList,
  relPath: string,
  page?: number
): Promise<boolean> {
  const canonical = plugin.app.vault.getAbstractFileByPath(relPath);
  if (!(canonical instanceof TFile)) return false;
  const leaves = plugin.app.workspace.getLeavesOfType('pdf');
  const target = leaves.find((leaf) => {
    const p = viewStatePath(leaf.getViewState().state);
    return p === canonical.path;
  });
  if (!target) return false;
  plugin.app.workspace.setActiveLeaf(target, { focus: true });
  await target.openFile(canonical);
  if (page && Number.isFinite(page)) {
    try {
      await plugin.app.workspace.openLinkText(
        `${canonical.path}#page=${page}`,
        '',
        false
      );
    } catch {
      // no-op: opening the file in existing leaf is already done.
    }
  }
  return true;
}

/** PDF : lecteur Obsidian (+ surcouche PandoCit). EPUB : lecteur PandoCit. */
export async function openDocumentFromPlugin(
  plugin: ReferenceList,
  pathOrUrl: string,
  opts: OpenDocumentOptions = {}
): Promise<void> {
  const raw = pathOrUrl.trim();
  if (!raw) return;

  const ext = extOf(raw);
  const kind: 'pdf' | 'epub' | null =
    ext === 'pdf' ? 'pdf' : ext === 'epub' ? 'epub' : null;

  if (!kind) {
    new Notice(t('Unsupported document type'));
    return;
  }

  if (kind === 'pdf') {
    const rel = resolveVaultRelativePdfPath(raw) ?? raw.replace(/\\/g, '/');
    if (opts.reuseOpenPdfLeaf) {
      const reused = await tryOpenPdfInExistingLeaf(plugin, rel, opts.page);
      if (reused) return;
    }
    openPdfAbsolutePathInObsidianOrExternal(
      raw,
      '',
      opts.page ?? null,
      opts.reuseOpenPdfLeaf
        ? false
        : plugin.settings.openPdfLinksInNewTab !== false
          ? 'tab'
          : false
    );
    return;
  }

  if (Platform.isMobileApp) {
    new Notice(t('EPUB reader is desktop-only'));
    return;
  }

  const rel = raw.replace(/\\/g, '/').replace(/^\/+/, '');
  const file = plugin.app.vault.getAbstractFileByPath(rel);
  if (!(file instanceof TFile)) {
    new Notice(t('EPUB not found in vault'));
    return;
  }

  if (opts.gotoCfi?.trim()) {
    await openEpubAtAnnotation(plugin, rel, opts.gotoCfi);
    return;
  }

  await openInPandocitReader(plugin, file, {
    page: opts.page,
  });
}

export async function openPdfForPlugin(
  plugin: ReferenceList,
  absPath: string,
  sourcePath: string,
  page: number | null | undefined,
  newLeaf: boolean | import('obsidian').PaneType = 'tab'
): Promise<void> {
  openPdfAbsolutePathInObsidianOrExternal(absPath, sourcePath, page, newLeaf);
}

export { registerDocumentOpenRouter as registerFileOpenRouter } from './documentRouter';
