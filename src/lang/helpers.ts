import ar from './locale/ar';
import cz from './locale/cz';
import da from './locale/da';
import de from './locale/de';
import en from './locale/en';
import es from './locale/es';
import fr from './locale/fr';
import hi from './locale/hi';
import id from './locale/id';
import it from './locale/it';
import ja from './locale/ja';
import ko from './locale/ko';
import nl from './locale/nl';
import no from './locale/no';
import pl from './locale/pl';
import pt from './locale/pt';
import ptBR from './locale/pt-br';
import ro from './locale/ro';
import ru from './locale/ru';
import sq from './locale/sq';
import tr from './locale/tr';
import uk from './locale/tr';
import zhCN from './locale/zh-cn';
import zhTW from './locale/zh-tw';

const localeMap: { [k: string]: Partial<typeof en> } = {
  ar,
  cz,
  da,
  de,
  en,
  es,
  fr,
  hi,
  id,
  it,
  ja,
  ko,
  nl,
  no,
  pl,
  'pt-BR': ptBR,
  pt,
  ro,
  ru,
  sq,
  tr,
  uk,
  'zh-TW': zhTW,
  zh: zhCN,
};

/** Langues avec traduction complète des chaînes du plugin (réglage dédié). */
export const PLUGIN_UI_LOCALES = ['en', 'fr', 'de', 'es'] as const;
export type PluginUiLocale = (typeof PLUGIN_UI_LOCALES)[number];

let pluginUiLocale: string = 'en';

/** À appeler au chargement des réglages et quand l’utilisateur change la langue. */
export function setPluginUiLocale(code: string | undefined): void {
  const c = (code || 'en').toLowerCase();
  pluginUiLocale = PLUGIN_UI_LOCALES.includes(c as PluginUiLocale)
    ? c
    : 'en';
}

export function getPluginUiLocale(): string {
  return pluginUiLocale;
}

export function t(str: keyof typeof en): string {
  const locale = localeMap[pluginUiLocale];
  return (locale && locale[str]) || en[str];
}
