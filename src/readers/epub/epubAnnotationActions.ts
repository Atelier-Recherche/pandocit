import { Notice, TFile } from 'obsidian';

import type { DocumentAnnotation } from '../../annotations/types';
import { t } from '../../lang/helpers';
import type ReferenceList from '../../main';
import { findZoteroAttachmentKeyForVaultFile } from '../pdf/zoteroAttachmentMatch';
import { askPdfConvertConfirm } from '../pdf/pdfConvertConfirm';
import { pushEpubAnnotationToZotero } from './zoteroEpubAnnotations';
import {
  resolveZoteroEpubPosition,
  sectionIndexFromEpubCfi,
} from './epubZoteroPosition';
import { getActiveEpubReaderForPlugin } from './epubReaderUi';
import { readOrCreateSidecarAnnotations, saveEpubSidecar } from './epubSidecar';
import { refreshEpubReaderAnnotations } from './epubReaderRefresh';
export async function convertEpubAnnotationTarget(
  plugin: ReferenceList,
  vaultPath: string,
  ann: DocumentAnnotation,
  target: 'pdf' | 'zotero'
): Promise<void> {
  const choice = await askPdfConvertConfirm(plugin.app, target);
  if (!choice) return;

  const file = plugin.app.vault.getAbstractFileByPath(vaultPath);
  if (!(file instanceof TFile) || file.extension.toLowerCase() !== 'epub') {
    new Notice(t('EPUB not found in vault'));
    return;
  }
  if (!ann.cfi?.trim()) {
    new Notice(t('Annotation has no position data'));
    return;
  }

  if (target === 'zotero') {
    if (ann.source !== 'sidecar') {
      new Notice(t('Annotation already in Zotero'));
      return;
    }
    const attachmentKey = await findZoteroAttachmentKeyForVaultFile(plugin, file);
    if (!attachmentKey) {
      new Notice(t('No Zotero attachment match for this EPUB'));
      return;
    }
    let toPush = ann;
    const sectionIndex =
      ann.sectionIndex ?? sectionIndexFromEpubCfi(ann.cfi ?? '');
    const view = getActiveEpubReaderForPlugin(plugin);
    if (!ann.zoteroCfi?.trim()) {
      const zoteroPos = await resolveZoteroEpubPosition(
        plugin,
        file,
        {
          text: ann.text,
          cfi: ann.cfi ?? '',
          sectionIndex,
        },
        view?.getFoliateEl() ?? null
      );
      if (zoteroPos) {
        toPush = { ...ann, ...zoteroPos, sectionIndex };
      } else {
        new Notice(t('EPUB Zotero position could not be computed'));
        return;
      }
    }
    const res = await pushEpubAnnotationToZotero(plugin, attachmentKey, toPush);
    if (!res.ok) {
      new Notice(`${t('Zotero save failed')}: ${res.error ?? ''}`);
      return;
    }
    if (choice.deleteSource) {
      const remaining = (await readOrCreateSidecarAnnotations(vaultPath)).filter(
        (a) => a.id !== ann.id
      );
      await saveEpubSidecar(vaultPath, remaining);
      await refreshEpubReaderAnnotations(plugin, vaultPath);
      new Notice(t('Annotation deleted'));
      return;
    }
    await refreshEpubReaderAnnotations(plugin, vaultPath);
    new Notice(t('Annotation copied to Zotero'));
    return;
  }

  if (ann.source !== 'zotero') {
    new Notice(t('Annotation already in sidecar'));
    return;
  }
  const sidecar = await readOrCreateSidecarAnnotations(vaultPath);
  const copy: DocumentAnnotation = {
    ...ann,
    id: `epub-${Date.now()}`,
    source: 'sidecar',
    zoteroKey: undefined,
  };
  sidecar.push(copy);
  await saveEpubSidecar(vaultPath, sidecar);
  if (choice.deleteSource && ann.zoteroKey) {
    const res = await plugin.zoteroSync.deleteLibraryItem(ann.zoteroKey);
    if (!res.ok) {
      new Notice(`${t('Delete failed')}: ${res.error ?? 'zotero'}`);
      return;
    }
    await plugin.zoteroSync.sync();
    plugin.emitter.trigger('pwc-zotero-synced');
    await refreshEpubReaderAnnotations(plugin, vaultPath);
    new Notice(t('Annotation deleted'));
    return;
  }
  await refreshEpubReaderAnnotations(plugin, vaultPath);
  new Notice(t('Annotation copied to sidecar'));
}
