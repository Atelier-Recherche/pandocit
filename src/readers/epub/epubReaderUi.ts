import type ReferenceList from '../../main';
import { epubReaderViewType } from './EpubReaderView';
import type { EpubReaderView } from './EpubReaderView';

export function getActiveEpubReaderForPlugin(
  plugin: ReferenceList
): EpubReaderView | null {
  const leaf = plugin.app.workspace.activeLeaf;
  if (!leaf || leaf.view.getViewType() !== epubReaderViewType) return null;
  return leaf.view as EpubReaderView;
}

/** Lecteur EPUB avec sélection en attente (y compris si le focus est dans l’iframe). */
export function findEpubReaderWithSelection(
  plugin: ReferenceList
): EpubReaderView | null {
  const active = getActiveEpubReaderForPlugin(plugin);
  if (active?.getPendingSelection()) return active;
  for (const leaf of plugin.app.workspace.getLeavesOfType(epubReaderViewType)) {
    const view = leaf.view as EpubReaderView;
    if (view.getPendingSelection()) return view;
  }
  return null;
}

/**
 * Le menu contextuel est géré dans l’iframe du lecteur (EpubReaderView).
 * Pas de handler document global : il montrait le menu hors lecteur et
 * empêchait la fermeture correcte.
 */
export function registerEpubReaderUi(_plugin: ReferenceList): void {
  // réservé (hotkeys / UI hors iframe si besoin)
}
