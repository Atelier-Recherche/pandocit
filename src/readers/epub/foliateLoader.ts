import type ReferenceList from '../../main';

function pluginFoliateViewUrl(plugin: ReferenceList): string {
  const adapter = plugin.app.vault.adapter as {
    getResourcePath?: (p: string) => string;
  };
  const rel = `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}/foliate/view.js`;
  if (adapter.getResourcePath) {
    const url = adapter.getResourcePath(rel);
    if (url) return url;
  }
  const dir = plugin.manifest.dir.replace(/\\/g, '/');
  return `${dir}/foliate/view.js`;
}

/**
 * Enregistre le custom element `foliate-view` (view.js charge ses deps, dont overlayer.js).
 * Le dessin des surlignages est géré par {@link epubHighlightDraw} dans le bundle du plugin.
 */
export async function ensureFoliateLoaded(plugin: ReferenceList): Promise<void> {
  if (customElements.get('foliate-view')) return;
  const viewUrl = pluginFoliateViewUrl(plugin);
  await import(/* webpackIgnore: true */ viewUrl);
}
