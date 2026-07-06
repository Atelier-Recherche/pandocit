/**
 * Enregistre le custom element `foliate-view` au chargement du plugin (bundlé dans main.js).
 * Évite tout import/script dynamique à runtime, requis par le scanner de revue Obsidian.
 */
import '../../../foliate/view.js';
