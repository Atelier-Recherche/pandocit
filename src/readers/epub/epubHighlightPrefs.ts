import { t } from '../../lang/helpers';
import type ReferenceList from '../../main';

import type {

  PdfHighlightPrefs,

  PdfHighlightStyle,

  PdfHighlightTarget,

} from '../pdf/pdfHighlightPrefs';



const DEFAULT_EPUB_HIGHLIGHT_PREFS: PdfHighlightPrefs = {

  style: 'highlight',

  target: 'both',

  color: '#ffd400',

  opacity: 0.35,

};



/** Réglages de surlignage EPUB (séparés du PDF). */

export function getEpubHighlightPrefs(plugin: ReferenceList): PdfHighlightPrefs {

  const s = plugin.settings;

  return {

    style:

      s.epubHighlightLastStyle ??

      s.pdfHighlightLastStyle ??

      DEFAULT_EPUB_HIGHLIGHT_PREFS.style,

    target:

      s.epubHighlightLastTarget ?? DEFAULT_EPUB_HIGHLIGHT_PREFS.target,

    color:

      s.epubHighlightLastColor ??

      s.pdfHighlightLastColor ??

      DEFAULT_EPUB_HIGHLIGHT_PREFS.color,

    opacity:

      typeof s.epubHighlightLastOpacity === 'number'

        ? s.epubHighlightLastOpacity

        : typeof s.pdfHighlightLastOpacity === 'number'

          ? s.pdfHighlightLastOpacity

          : DEFAULT_EPUB_HIGHLIGHT_PREFS.opacity,

  };

}



export async function saveEpubHighlightPrefs(

  plugin: ReferenceList,

  prefs: PdfHighlightPrefs

): Promise<void> {

  plugin.settings.epubHighlightLastStyle = prefs.style;

  plugin.settings.epubHighlightLastTarget = prefs.target;

  plugin.settings.epubHighlightLastColor = prefs.color;

  plugin.settings.epubHighlightLastOpacity = prefs.opacity;

  await plugin.saveSettings();

}



export function epubTargetLabel(target: PdfHighlightTarget): string {

  switch (target) {

    case 'zotero':

      return 'Highlight target zotero';

    case 'pdf':

      return 'Highlight target sidecar';

    default:

      return 'Highlight target both epub';

  }

}



export function epubStyleLabel(style: PdfHighlightStyle): string {

  switch (style) {

    case 'underline':

      return 'Highlight style underline';

    case 'strikeout':

      return 'Highlight style strikeout';

    case 'squiggly':

      return 'Highlight style squiggly';

    default:

      return 'Highlight style highlight';

  }

}



export function epubPrefsSummaryLabel(prefs: PdfHighlightPrefs): string {
  return `${t(epubStyleLabel(prefs.style))} · ${t(epubTargetLabel(prefs.target))}`;
}


