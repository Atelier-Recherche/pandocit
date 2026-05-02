import { t } from './lang/helpers';
import type en from './lang/locale/en';

type EnKey = keyof typeof en;

/** Libellés courts pour les badges du panneau bibliothèque (types Zotero API). */
const ITEM_TYPE_I18N: Partial<Record<string, EnKey>> = {
  attachment: 'Badge PDF or file',
  note: 'Badge note',
  annotation: 'Badge annotation',
  artwork: 'Zotero type artwork',
  audioRecording: 'Zotero type audioRecording',
  bill: 'Zotero type bill',
  blogPost: 'Zotero type blogPost',
  book: 'Zotero type book',
  bookSection: 'Zotero type bookSection',
  case: 'Zotero type case',
  computerProgram: 'Zotero type computerProgram',
  conferencePaper: 'Zotero type conferencePaper',
  dictionaryEntry: 'Zotero type dictionaryEntry',
  document: 'Zotero type document',
  email: 'Zotero type email',
  encyclopediaArticle: 'Zotero type encyclopediaArticle',
  film: 'Zotero type film',
  forumPost: 'Zotero type forumPost',
  hearing: 'Zotero type hearing',
  instantMessage: 'Zotero type instantMessage',
  interview: 'Zotero type interview',
  journalArticle: 'Zotero type journalArticle',
  letter: 'Zotero type letter',
  magazineArticle: 'Zotero type magazineArticle',
  manuscript: 'Zotero type manuscript',
  map: 'Zotero type map',
  newspaperArticle: 'Zotero type newspaperArticle',
  patent: 'Zotero type patent',
  podcast: 'Zotero type podcast',
  presentation: 'Zotero type presentation',
  preprint: 'Zotero type preprint',
  radioBroadcast: 'Zotero type radioBroadcast',
  report: 'Zotero type report',
  standard: 'Zotero type standard',
  statute: 'Zotero type statute',
  thesis: 'Zotero type thesis',
  tvBroadcast: 'Zotero type tvBroadcast',
  videoRecording: 'Zotero type videoRecording',
  webpage: 'Zotero type webpage',
};

function humanizeApiItemType(it: string): string {
  const spaced = it.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Libellé traduit pour `pwc-zotero-library__badge` (type d’item Zotero). */
export function itemTypeBadgeLabel(itemType: string): string {
  const it = String(itemType ?? '').trim();
  const key = ITEM_TYPE_I18N[it];
  if (key) return t(key);
  if (!it) return t('Zotero type unknown');
  return humanizeApiItemType(it);
}
