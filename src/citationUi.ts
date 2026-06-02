import type { ReferenceListSettings } from './settings';
import { TooltipManager } from './tooltip';

/** Classes sur body pour l’apparence des citations (soulignement optionnel, infobulles). */
export function syncCitationUiClasses(settings: ReferenceListSettings): void {
  document.body.toggleClass('pwc-cite-underline', !!settings.underlineCitekeys);
  document.body.addClass('pwc-tooltips');
  TooltipManager.syncTapModeBodyClass(true);
}

export function isFormattedCitationsEnabled(
  settings: ReferenceListSettings
): boolean {
  return !!settings.renderCitations && !!settings.renderCitationsReadingMode;
}

export function setFormattedCitationsEnabled(
  settings: ReferenceListSettings,
  enabled: boolean
): void {
  settings.renderCitations = enabled;
  settings.renderCitationsReadingMode = enabled;
}
