import {
  FileSystemAdapter,
  Notice,
  Platform,
  requestUrl,
} from 'obsidian';
import { unzipSync } from 'fflate';
import { join } from 'path';

import type ReferenceList from './main';
import { t } from './lang/helpers';

export const PANDOC_WASM_ZIP_URL =
  'https://github.com/jgm/pandoc/releases/download/3.9.0.2/pandoc.wasm.zip';

export function getPluginFolder(plugin: ReferenceList): string | null {
  const adapter = plugin.app.vault.adapter;
  if (!(adapter instanceof FileSystemAdapter)) return null;
  const base = adapter.getBasePath();
  return join(base, '.obsidian', 'plugins', plugin.manifest.id);
}

export function getPandocWasmPath(plugin: ReferenceList): string | null {
  const dir = getPluginFolder(plugin);
  return dir ? join(dir, 'pandoc.wasm') : null;
}

export function isPandocWasmInstalled(plugin: ReferenceList): boolean {
  const p = getPandocWasmPath(plugin);
  if (!p || !Platform.isDesktop) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs');
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

/**
 * Télécharge l’archive officielle, extrait `pandoc.wasm` à côté de `main.js`.
 */
export async function downloadAndInstallPandocWasm(
  plugin: ReferenceList,
  opts?: { force?: boolean }
): Promise<boolean> {
  if (!Platform.isDesktop) {
    new Notice(t('Pandoc WASM can only be installed on desktop.'));
    return false;
  }

  const wasmPath = getPandocWasmPath(plugin);
  const pluginDir = getPluginFolder(plugin);
  if (!wasmPath || !pluginDir) {
    new Notice(t('Pandoc WASM download failed.'));
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs');
    if (fs.existsSync(wasmPath) && !opts?.force) {
      new Notice(t('pandoc.wasm is already in the plugin folder.'));
      return true;
    }

    new Notice(t('Downloading Pandoc WASM…'));

    const res = await requestUrl({ url: PANDOC_WASM_ZIP_URL });
    if (res.status !== 200 || !res.arrayBuffer) {
      throw new Error(`HTTP ${res.status}`);
    }

    const extracted = unzipSync(new Uint8Array(res.arrayBuffer));
    const wasmKey = Object.keys(extracted).find((k) =>
      /(^|\/)pandoc\.wasm$/i.test(k)
    );
    if (!wasmKey || !extracted[wasmKey]?.length) {
      throw new Error('pandoc.wasm not found in zip');
    }

    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(wasmPath, extracted[wasmKey]);

    new Notice(t('Pandoc WASM installed. Reload Obsidian to apply.'));
    return true;
  } catch (e) {
    console.error('[pandoc wasm install]', e);
    new Notice(t('Pandoc WASM download failed.'));
    return false;
  }
}
