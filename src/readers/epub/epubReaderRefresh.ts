import { TFile } from 'obsidian';

import type ReferenceList from '../../main';
import { readerRegistry } from '../readerRegistry';
import { epubReaderViewType } from './EpubReaderView';
import { readOrCreateSidecarAnnotations } from './epubSidecar';
import { findZoteroAttachmentKeyForVaultFile } from '../pdf/zoteroAttachmentMatch';
import { zoteroAnnotationsForEpubAttachment } from './zoteroEpubAnnotations';

/** Recharge annotations Zotero + sidecar pour le lecteur EPUB actif. */
export async function refreshEpubReaderAnnotations(
  plugin: ReferenceList,
  vaultPath?: string
): Promise<void> {
  const reg = readerRegistry.get();
  const path = vaultPath ?? reg?.vaultPath;
  if (!path || !path.toLowerCase().endsWith('.epub')) return;

  const file = plugin.app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return;

  let annotations = await readOrCreateSidecarAnnotations(path);
  const zoteroAttachmentKey = await findZoteroAttachmentKeyForVaultFile(
    plugin,
    file
  );

  if (zoteroAttachmentKey && plugin.settings.pullFromZoteroApi) {
    const snap = await plugin.zoteroSync.loadSnapshot();
    const zot = zoteroAnnotationsForEpubAttachment(snap, zoteroAttachmentKey);
    const ids = new Set(annotations.map((a) => a.id));
    for (const a of zot) {
      if (!ids.has(a.id)) annotations.push(a);
    }
  }

  readerRegistry.set({
    kind: 'epub',
    vaultPath: path,
    annotations,
    zoteroAttachmentKey,
  });
  plugin.emitter.trigger('pwc-document-annotations-changed');

  const leaf = plugin.app.workspace
    .getLeavesOfType(epubReaderViewType)
    .find((l) => {
      const st = l.getViewState().state as { path?: string; file?: string };
      return st?.path === path || st?.file === path;
    });
  const view = leaf?.view as { reloadAnnotationsFromRegistry?: () => void } | undefined;
  view?.reloadAnnotationsFromRegistry?.();
}
