import { Notice, TFile } from 'obsidian';

import type ReferenceList from '../../main';
import { t } from '../../lang/helpers';
import { readerRegistry } from '../readerRegistry';
import { epubReaderViewType } from './EpubReaderView';
import { readOrCreateSidecarAnnotations } from './epubSidecar';
import { findZoteroAttachmentKeyForVaultFile } from '../pdf/zoteroAttachmentMatch';
import { zoteroAnnotationsForEpubAttachment } from './zoteroEpubAnnotations';

/** Recharge annotations Zotero + sidecar. `syncRemote` tire d’abord l’API distante. */
export async function refreshEpubReaderAnnotations(
  plugin: ReferenceList,
  vaultPath?: string,
  opts?: { syncRemote?: boolean }
): Promise<void> {
  const reg = readerRegistry.get();
  const path = vaultPath ?? reg?.vaultPath;
  if (!path || !path.toLowerCase().endsWith('.epub')) return;

  const file = plugin.app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return;

  if (plugin.settings.pullFromZoteroApi && opts?.syncRemote) {
    const syncRes = await plugin.zoteroSync.sync();
    if (!syncRes.ok) {
      new Notice(
        t('Zotero sync failed') + (syncRes.error ? `: ${syncRes.error}` : '')
      );
    }
  }

  let annotations = await readOrCreateSidecarAnnotations(path);
  const zoteroAttachmentKey = await findZoteroAttachmentKeyForVaultFile(
    plugin,
    file,
    { fresh: true }
  );

  if (zoteroAttachmentKey && plugin.settings.pullFromZoteroApi) {
    const snap = await plugin.zoteroSync.loadSnapshot();
    const zot = zoteroAnnotationsForEpubAttachment(snap, zoteroAttachmentKey);
    const ids = new Set(annotations.map((a) => a.id));
    for (const a of zot) {
      if (!ids.has(a.id)) annotations.push(a);
    }
  }

  readerRegistry.upsert({
    kind: 'epub',
    vaultPath: path,
    annotations,
    zoteroAttachmentKey,
  });
  readerRegistry.setActive(path);
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
