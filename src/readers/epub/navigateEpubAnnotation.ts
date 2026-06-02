import { TFile } from 'obsidian';

import type { DocumentAnnotation } from '../../annotations/types';
import type ReferenceList from '../../main';
import { vaultPathFromViewState } from '../documentRouter';
import { cfiFromZoteroAnnotationPosition, lengthenEpubCfi } from './epubCfiBridge';
import { foliateCfiForAnnotation } from './epubFoliateCfi';
import { EpubReaderView, epubReaderViewType } from './EpubReaderView';
import { openInPandocitReader } from '../documentRouter';

function normalizeGotoCfi(cfi: string | undefined): string | undefined {
  if (!cfi?.trim()) return undefined;
  const parsed = cfiFromZoteroAnnotationPosition(cfi) ?? cfi.trim();
  return lengthenEpubCfi(parsed);
}

function gotoCfiForAnn(
  view: EpubReaderView | null,
  ann: DocumentAnnotation | undefined,
  cfi: string | undefined
): string | undefined {
  if (ann && view) {
    const foliate = foliateCfiForAnnotation(view.getFoliateEl(), ann);
    if (foliate) return foliate;
  }
  return normalizeGotoCfi(cfi);
}

/** Navigue vers une annotation dans un lecteur EPUB déjà ouvert pour ce fichier. */
export async function goToEpubAnnotationInOpenReader(
  plugin: ReferenceList,
  vaultPath: string,
  cfi: string | undefined,
  ann?: DocumentAnnotation
): Promise<boolean> {
  const rel = vaultPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const file = plugin.app.vault.getAbstractFileByPath(rel);
  if (!(file instanceof TFile)) return false;

  const leaves = plugin.app.workspace.getLeavesOfType(epubReaderViewType);
  const leaf = leaves.find((l) => {
    const p = vaultPathFromViewState(l.getViewState().state);
    return p === file.path;
  });
  if (!leaf) return false;

  plugin.app.workspace.setActiveLeaf(leaf, { focus: true });
  const view = leaf.view;
  if (!(view instanceof EpubReaderView)) return false;
  const goto = gotoCfiForAnn(view, ann, cfi);
  if (goto) await view.goToAnnotation(goto, ann);
  return true;
}

export async function openEpubAtAnnotation(
  plugin: ReferenceList,
  vaultPath: string,
  cfi: string | undefined,
  ann?: DocumentAnnotation
): Promise<void> {
  const reused = await goToEpubAnnotationInOpenReader(
    plugin,
    vaultPath,
    cfi,
    ann
  );
  if (reused) return;

  const rel = vaultPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const file = plugin.app.vault.getAbstractFileByPath(rel);
  if (!(file instanceof TFile)) return;

  await openInPandocitReader(plugin, file, {
    gotoCfi: normalizeGotoCfi(cfi),
  });
}
