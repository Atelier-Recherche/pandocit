import type ReferenceList from '../../main';

/**
 * Vérifie que le custom element `foliate-view` est enregistré (bundlé dans main.js).
 */
export async function ensureFoliateLoaded(_plugin: ReferenceList): Promise<void> {
  if (customElements.get('foliate-view')) return;
  throw new Error('foliate-view custom element not registered');
}
