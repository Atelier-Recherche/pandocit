import { Notice, normalizePath, requestUrl } from 'obsidian';

import type ReferenceList from './main';
import { t } from './lang/helpers';
import { getPluginFolder } from './pandocWasmInstall';

/** Fichier unique à côté de `main.js` (bundle foliate-js, généré au build). */
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

async function ensureParentDirs(
  plugin: ReferenceList,
  normalizedFilePath: string
): Promise<void> {
  const adapter = plugin.app.vault.adapter;
  const norm = normalizePath(normalizedFilePath);
  const i = norm.lastIndexOf('/');
  if (i <= 0) return;
  const dirPath = norm.slice(0, i);
  const segments = dirPath.split('/').filter(Boolean);
  let cur = '';
  for (const seg of segments) {
    cur = cur ? normalizePath(`${cur}/${seg}`) : seg;
    if (!(await adapter.exists(cur))) {
      await adapter.mkdir(cur);
    }
  }
}

export async function isFoliateViewInstalled(
  plugin: ReferenceList
): Promise<boolean> {
  const adapter = plugin.app.vault.adapter;
  try {
    if (await adapter.exists(getFoliateViewPath(plugin))) return true;
    return await adapter.exists(getLegacyFoliateViewPath(plugin));
  } catch {
    return false;
  }
}

/**
 * Télécharge `foliate-view.mjs` dans le dossier du plugin (requis pour le lecteur EPUB).
 */
export async function downloadAndInstallFoliateView(
  plugin: ReferenceList,
  opts?: { force?: boolean }
): Promise<boolean> {
  const adapter = plugin.app.vault.adapter;
  const outPath = getFoliateViewPath(plugin);

  try {
    if ((await adapter.exists(outPath)) && !opts?.force) {
      new Notice(t('foliate-view.mjs is already in the plugin folder.'));
      return true;
    }

    new Notice(t('Downloading EPUB reader (foliate)…'));

    const res = await requestUrl({ url: FOLIATE_VIEW_DOWNLOAD_URL });
    if (res.status !== 200 || !res.arrayBuffer) {
      throw new Error(`HTTP ${res.status}`);
    }

    const buf = res.arrayBuffer;
    if (!buf.byteLength) {
      throw new Error('empty foliate bundle');
    }

    await ensureParentDirs(plugin, outPath);
    await adapter.writeBinary(outPath, buf);

    new Notice(t('EPUB reader installed. Reload Obsidian to apply.'));
    return true;
  } catch (e) {
    console.error('[PandoCit foliate install]', e);
    new Notice(t('EPUB reader download failed.'));
    return false;
  }
}
