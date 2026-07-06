import { Notice, normalizePath, requestUrl } from 'obsidian';

import type ReferenceList from './main';
import { t } from './lang/helpers';
import { getPluginFolder } from './pandocWasmInstall';

/** @deprecated Lecteur EPUB bundlé dans main.js ; conservé pour compatibilité chemins legacy. */
export const FOLIATE_VIEW_FILENAME = 'foliate-view.mjs';

export const FOLIATE_VIEW_DOWNLOAD_URL =
  'https://github.com/Atelier-Recherche/pandocit/releases/latest/download/foliate-view.mjs';

export function getFoliateViewPath(plugin: ReferenceList): string {
  return normalizePath(`${getPluginFolder(plugin)}/${FOLIATE_VIEW_FILENAME}`);
}

/** Ancienne install : dossier `foliate/` (déprécié). */
export function getLegacyFoliateViewPath(plugin: ReferenceList): string {
  return normalizePath(`${getPluginFolder(plugin)}/foliate/view.js`);
}

/** Le lecteur EPUB est bundlé dans main.js au build. */
export async function isFoliateViewInstalled(
  _plugin: ReferenceList
): Promise<boolean> {
  return customElements.get('foliate-view') != null;
}

/**
 * @deprecated Le lecteur EPUB est inclus dans main.js ; téléchargement séparé obsolète.
 */
export async function downloadAndInstallFoliateView(
  plugin: ReferenceList,
  _opts?: { force?: boolean }
): Promise<boolean> {
  if (await isFoliateViewInstalled(plugin)) {
    new Notice(t('EPUB reader is bundled in main.js.'));
    return true;
  }
  new Notice(t('EPUB reader unavailable — reload Obsidian or reinstall the plugin.'));
  return false;
}
