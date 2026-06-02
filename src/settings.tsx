import {
  Notice,
  Platform,
  PluginSettingTab,
  Setting,
  TextComponent,
} from 'obsidian';

import { t } from './lang/helpers';
import ReferenceList from './main';
import ReactDOM from 'react-dom';
import React from 'react';
import { SettingItem } from './settings/SettingItem';
import { CslSearchField } from './settings/CslSearchField';
import { searchCSL, searchCSLLangs } from './settings/select.helpers';
import { cslListRaw } from './bib/cslList';
import { langListRaw } from './bib/cslLangList';
import { ZoteroApiSetting } from './settings/ZoteroApiSetting';
import {
  downloadAndInstallPandocWasm,
  isPandocWasmInstalled,
} from './pandocWasmInstall';
import {
  downloadAndInstallPdfWorker,
  isPdfWorkerInstalled,
} from './pdfWorkerInstall';
import { setPluginUiLocale } from './lang/helpers';
import {
  isFormattedCitationsEnabled,
  setFormattedCitationsEnabled,
  syncCitationUiClasses,
} from './citationUi';

export const DEFAULT_SETTINGS: ReferenceListSettings = {
  pluginUiLocale: 'en',
  zoteroGroups: [],
  renderCitations: true,
  renderCitationsReadingMode: true,
  renderLinkCitations: true,
  openPdfLinksInNewTab: true,
  showCitekeyTooltips: true,
  underlineCitekeys: false,
  zoteroApiLibraryType: 'user',
  zoteroApiMergeGroupIds: [],
};

export interface ZoteroGroup {
  id: number;
  name: string;
  lastUpdate?: number;
}

export interface ReferenceListSettings {
  /** Langue des chaînes du plugin : en | fr | de | es */
  pluginUiLocale?: 'en' | 'fr' | 'de' | 'es';

  pathToBibliography?: string;

  cslStyleURL?: string;
  cslStylePath?: string;
  cslLang?: string;

  hideLinks?: boolean;
  /** Infobulles au survol des clés / citations (toujours recommandé). */
  showCitekeyTooltips?: boolean;
  /** Soulignement pointillé des clés de citation résolues. */
  underlineCitekeys?: boolean;
  enableCiteKeyCompletion?: boolean;
  renderCitations?: boolean;
  renderCitationsReadingMode?: boolean;
  renderLinkCitations?: boolean;
  /** PDF du coffre ouverts via citekeys / panneau Zotero : nouvel onglet si true, sinon même zone (vue scindée possible). */
  openPdfLinksInNewTab?: boolean;
  hypothesisApiToken?: string;
  hypothesisGroup?: string;
  /** Derniers réglages de surlignage PDF (style, cible, couleur, opacité). */
  pdfHighlightLastStyle?: 'highlight' | 'underline' | 'strikeout' | 'squiggly';
  pdfHighlightLastTarget?: 'pdf' | 'zotero' | 'both';
  pdfHighlightLastColor?: string;
  pdfHighlightLastOpacity?: number;
  /** Derniers réglages de surlignage EPUB (cible indépendante du PDF). */
  epubHighlightLastStyle?: 'highlight' | 'underline' | 'strikeout' | 'squiggly';
  epubHighlightLastTarget?: 'pdf' | 'zotero' | 'both';
  epubHighlightLastColor?: string;
  epubHighlightLastOpacity?: number;

  pullFromZotero?: boolean;
  zoteroPort?: string;
  zoteroGroups: ZoteroGroup[];

  pullFromZoteroApi?: boolean;
  zoteroApiKey?: string;
  zoteroApiUserId?: number;
  zoteroApiLibraryType?: 'user' | 'group';
  zoteroApiGroupId?: number;
  /** Vault-relative path for optional BibTeX export (Pandoc / LaTeX / Typst) */
  zoteroApiBibExportPath?: string;
  /** IDs de groupes à fusionner avec la bib. personnelle (vue + citations) */
  zoteroApiMergeGroupIds?: number[];
  /** Noms affichés : rempli au chargement des groupes (clé = id numérique en string) */
  zoteroApiGroupNamesCache?: Record<string, string>;
  /** Libellés personnalisés par ID de groupe fusionné (priorité sur le cache API) */
  zoteroApiMergeGroupLabels?: Record<string, string>;

  vaultPdfImport?: VaultPdfImportSettings;
}

export interface VaultPdfImportMetadataRegex {
  source?: 'basename' | 'relativePath';
  pattern?: string;
  titleGroup?: string;
  authorGroup?: string;
  citekeyGroup?: string;
}

export interface VaultPdfImportSettings {
  /** Dossier du coffre scanné par défaut à l’ouverture de l’import PDF → Zotero. */
  defaultVaultFolder?: string;
  excludeFolderGlobs?: string[];
  excludePathRegex?: string;
  includeExtensions?: string[];
  shortPdfMaxPages?: number;
  metadataRegex?: VaultPdfImportMetadataRegex;
  defaultItemType?: 'book' | 'document';
  defaultAttachmentMode?: 'link' | 'upload';
}

export class ReferenceListSettingsTab extends PluginSettingTab {
  plugin: ReferenceList;

  constructor(plugin: ReferenceList) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private async mountWasmDownloadSetting(host: HTMLElement): Promise<void> {
    host.empty();
    const wasmInstalled = await isPandocWasmInstalled(this.plugin);
    new Setting(host)
      .setName(t('Download Pandoc WASM'))
      .setDesc(
        `${t(
          'Installs pandoc.wasm from Pandoc 3.9 next to main.js (official release ZIP). Reload Obsidian after install. Download works on desktop and mobile (including Android).'
        )}${wasmInstalled ? ` (${t('Installed')})` : ''}`
      )
      .addButton((btn) =>
        btn
          .setButtonText(t('Download WASM'))
          .setCta()
          .setTooltip(t('Download WASM'))
          .onClick(async () => {
            await downloadAndInstallPandocWasm(this.plugin);
            await this.mountWasmDownloadSetting(host);
          })
      );
  }

  private async mountPdfWorkerDownloadSetting(host: HTMLElement): Promise<void> {
    host.empty();
    const workerInstalled = await isPdfWorkerInstalled(this.plugin);
    new Setting(host)
      .setName(t('Download PDF.js worker'))
      .setDesc(
        `${t(
          'Installs pdf.worker.min.mjs next to main.js (optional fallback). The worker is already embedded in main.js for catalog installs. Reload Obsidian after install.'
        )}${workerInstalled ? ` (${t('Installed')})` : ''}`
      )
      .addButton((btn) =>
        btn
          .setButtonText(t('Download PDF worker'))
          .setCta()
          .setTooltip(t('Download PDF worker'))
          .onClick(async () => {
            await downloadAndInstallPdfWorker(this.plugin);
            await this.mountPdfWorkerDownloadSetting(host);
          })
      );
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName(t('Plugin interface language'))
      .setDesc(t('Display language for this plugin (settings, notices, side panel).'))
      .addDropdown((dropdown) => {
        dropdown
          .addOption('en', 'English')
          .addOption('fr', 'Français')
          .addOption('de', 'Deutsch')
          .addOption('es', 'Español')
          .setValue(this.plugin.settings.pluginUiLocale ?? 'en')
          .onChange(async (value) => {
            const v = value as 'en' | 'fr' | 'de' | 'es';
            this.plugin.settings.pluginUiLocale = v;
            setPluginUiLocale(v);
            await this.plugin.saveSettings();
            this.display();
          });
      });

    const wasmHost = containerEl.createDiv();
    void this.mountWasmDownloadSetting(wasmHost);

    const pdfWorkerHost = containerEl.createDiv();
    void this.mountPdfWorkerDownloadSetting(pdfWorkerHost);

    new Setting(containerEl)
      .setName(t('Path to bibliography file'))
      .setDesc(
        t(
          'The absolute path to your desired bibliography file. This can be overridden on a per-file basis by setting "bibliography" in the file\'s frontmatter.'
        )
      )
      .then((setting) => {
        let input: TextComponent;
        setting.addText((text) => {
          input = text;
          text
            .setValue(this.plugin.settings.pathToBibliography)
            .onChange((value) => {
              const prev = this.plugin.settings.pathToBibliography;
              this.plugin.settings.pathToBibliography = value;
              this.plugin.saveSettings(() => {
                this.plugin.bibManager.clearWatcher(prev);
                this.plugin.bibManager.reinit(true);
              });
            });
        });

        setting.addExtraButton((b) => {
          b.setIcon('folder');
          b.setTooltip(t('Select a bibliography file.'));
          b.onClick(() => {
            if (!Platform.isDesktop) {
              new Notice(
                t(
                  'File selection is only available on desktop. Please enter the path manually.'
                )
              );
              return;
            }

            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const path = require('electron').remote.dialog.showOpenDialogSync(
              {
                properties: ['openFile'],
              }
            );

            if (path && path.length) {
              input.setValue(path[0]);

              this.plugin.settings.pathToBibliography = path[0];
              this.plugin.saveSettings(() =>
                this.plugin.bibManager.reinit(true)
              );
            }
          });
        });
      });

    ReactDOM.render(
      <ZoteroApiSetting plugin={this.plugin} />,
      containerEl.createDiv('setting-item pwc-setting-item-wrapper')
    );

    const defaultStyle = cslListRaw.find(
      (item) => item.value === this.plugin.settings.cslStyleURL
    );

    ReactDOM.render(
      <SettingItem
        name={t('Citation style')}
        description={t('Type to search CSL styles (e.g. apa, chicago).')}
      >
        <CslSearchField
          initialOption={defaultStyle ?? null}
          placeholder={t('Search CSL styles…')}
          search={searchCSL}
          onSelect={(selection) => {
            this.plugin.settings.cslStyleURL = selection?.value;
            this.plugin.saveSettings(() =>
              this.plugin.bibManager.reinit(false)
            );
          }}
        />
      </SettingItem>,
      containerEl.createDiv('pwc-setting-item setting-item')
    );

    new Setting(containerEl)
      .setName(t('Custom citation style'))
      .setDesc(
        t(
          'Path to a CSL file. This can be an absolute path or one relative to your vault. This will override the style selected above. This can be overridden on a per-file basis by setting "csl" or "citation-style" in the file\'s frontmatter. A URL can be supplied when setting the style via frontmatter.'
        )
      )
      .then((setting) => {
        let input: TextComponent;
        setting.addText((text) => {
          input = text;
          text.setValue(this.plugin.settings.cslStylePath).onChange((value) => {
            this.plugin.settings.cslStylePath = value;
            this.plugin.saveSettings(() =>
              this.plugin.bibManager.reinit(false)
            );
          });
        });

        setting.addExtraButton((b) => {
          b.setIcon('folder');
          b.setTooltip(t('Select a CSL file located on your computer'));
          b.onClick(() => {
            if (!Platform.isDesktop) {
              new Notice(
                t(
                  'File selection is only available on desktop. Please enter the path manually.'
                )
              );
              return;
            }

            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const path = require('electron').remote.dialog.showOpenDialogSync(
              {
                properties: ['openFile'],
              }
            );

            if (path && path.length) {
              input.setValue(path[0]);

              this.plugin.settings.cslStylePath = path[0];
              this.plugin.saveSettings(() =>
                this.plugin.bibManager.reinit(false)
              );
            }
          });
        });
      });

    const defaultLanguage = langListRaw.find(
      (item) => item.value === this.plugin.settings.cslLang
    );

    ReactDOM.render(
      <SettingItem
        name={t('Citation style language')}
        description={
          <>
            {t(
              'This can be overridden on a per-file basis by setting "lang" or "citation-language" in the file\'s frontmatter. A language code must be used when setting the language via frontmatter.'
            )}{' '}
            <a
              href="https://github.com/citation-style-language/locales/blob/master/locales.json"
              target="_blank"
            >
              {t('See here for a list of available language codes')}
            </a>
            .
          </>
        }
      >
        <CslSearchField
          initialOption={defaultLanguage ?? null}
          placeholder={t('Search languages…')}
          search={searchCSLLangs}
          listOnEmptyFocus
          emptyNoMatch={t('No matching languages')}
          onSelect={(selection) => {
            this.plugin.settings.cslLang = selection?.value ?? '';
            this.plugin.saveSettings(() =>
              this.plugin.bibManager.reinit(false)
            );
          }}
        />
      </SettingItem>,
      containerEl.createDiv('pwc-setting-item setting-item')
    );

    new Setting(containerEl)
      .setName(t('Hide links in references'))
      .setDesc(t('Replace links with link icons to save space.'))
      .addToggle((text) =>
        text.setValue(!!this.plugin.settings.hideLinks).onChange((value) => {
          this.plugin.settings.hideLinks = value;
          this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(t('Underline citekeys'))
      .setDesc(t('Dotted underline on resolved and unresolved citekeys in the editor.'))
      .addToggle((text) =>
        text
          .setValue(!!this.plugin.settings.underlineCitekeys)
          .onChange((value) => {
            this.plugin.settings.underlineCitekeys = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('Formatted inline citations'))
      .setDesc(
        t(
          'Replace [@citekey] with author–year (or your CSL style). When off, the citekey stays visible; hover tooltips still work.'
        )
      )
      .addToggle((text) => {
        text
          .setValue(isFormattedCitationsEnabled(this.plugin.settings))
          .onChange((value) => {
            setFormattedCitationsEnabled(this.plugin.settings, value);
            this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName(t('Process citations in links'))
      .setDesc(
        t(
          'Include [[@pandoc]] citations in the reference list and format them as inline citations in live preview mode.'
        )
      )
      .addToggle((text) =>
        text
          .setValue(!!this.plugin.settings.renderLinkCitations)
          .onChange((value) => {
            this.plugin.settings.renderLinkCitations = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('Show citekey suggestions'))
      .setDesc(
        t(
          'When enabled, an autocomplete dialog will display when typing citation keys.'
        )
      )
      .addToggle((text) =>
        text
          .setValue(!!this.plugin.settings.enableCiteKeyCompletion)
          .onChange((value) => {
            this.plugin.settings.enableCiteKeyCompletion = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('Open PDF links in new tab'))
      .setDesc(
        t(
          'When enabled, vault PDFs opened from citekey tooltips or the library panel open in a new tab. When disabled, Obsidian may split the current pane instead.'
        )
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openPdfLinksInNewTab !== false)
          .onChange((value) => {
            this.plugin.settings.openPdfLinksInNewTab = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('Hypothesis API token'))
      .setDesc(t('Optional token for Hypothesis import/export'))
      .addText((text) =>
        text
          .setValue(this.plugin.settings.hypothesisApiToken ?? '')
          .onChange((v) => {
            this.plugin.settings.hypothesisApiToken = v;
            this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('Hypothesis group'))
      .addText((text) =>
        text
          .setValue(this.plugin.settings.hypothesisGroup ?? 'public')
          .onChange((v) => {
            this.plugin.settings.hypothesisGroup = v;
            this.plugin.saveSettings();
          })
      );
  }
}
