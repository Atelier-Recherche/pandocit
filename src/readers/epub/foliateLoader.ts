import type ReferenceList from '../../main';
import { getFoliateViewPath, getLegacyFoliateViewPath } from '../../foliateInstall';

function vaultResourceUrl(
  plugin: ReferenceList,
  vaultRelativePath: string
): string | null {
  const adapter = plugin.app.vault.adapter as {
    getResourcePath?: (p: string) => string;
  };
  if (adapter.getResourcePath) {
    return adapter.getResourcePath(vaultRelativePath) ?? null;
  }
  return null;
}

function manifestFileUrl(plugin: ReferenceList, vaultRelativePath: string): string {
  const dir = plugin.manifest.dir.replace(/\\/g, '/');
  const name = vaultRelativePath.split('/').pop() ?? vaultRelativePath;
  return `${dir}/${name}`;
}

async function resolveFoliateViewUrl(plugin: ReferenceList): Promise<string> {
  const adapter = plugin.app.vault.adapter;
  const bundleRel = getFoliateViewPath(plugin);
  const legacyRel = getLegacyFoliateViewPath(plugin);

  if (await adapter.exists(bundleRel)) {
    return (
      vaultResourceUrl(plugin, bundleRel) ?? manifestFileUrl(plugin, bundleRel)
    );
  }
  if (await adapter.exists(legacyRel)) {
    return (
      vaultResourceUrl(plugin, legacyRel) ??
      `${plugin.manifest.dir.replace(/\\/g, '/')}/foliate/view.js`
    );
  }

  throw new Error('foliate-view not installed');
}

/**
 * Enregistre le custom element `foliate-view` (bundle ou ancien `foliate/view.js`).
 * Le dessin des surlignages est géré par {@link epubHighlightDraw} dans le bundle du plugin.
 */
export async function ensureFoliateLoaded(plugin: ReferenceList): Promise<void> {
  if (customElements.get('foliate-view')) return;
  const viewUrl = await resolveFoliateViewUrl(plugin);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- viewUrl est une ressource du plugin lui-même (bundle ou fallback local), typée `string` par resolveFoliateViewUrl, jamais une entrée utilisateur/réseau
  await import(/* webpackIgnore: true */ viewUrl);
}
