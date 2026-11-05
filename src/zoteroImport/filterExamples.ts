/** Exemples documentés pour les réglages d’import PDF → Zotero. */

import type { TranslationKey } from '../lang/helpers';

/** `configDir` : `app.vault.configDir` (pas forcément `.obsidian`). */
export function exampleExcludeFolderGlobs(configDir: string): string[] {
  return [
    'Archives/**',
    '**/.trash/**',
    '**/_attachments/**',
    '**/drafts/**',
    '**/brouillons/**',
    `**/${configDir}/**`,
    '**/node_modules/**',
  ];
}

export const EXAMPLE_EXCLUDE_PATH_REGEX =
  '.*/(Archives|drafts|brouillons|\\.trash)(/|$)';

export const EXAMPLE_METADATA_REGEX_BASENAME =
  '^(?<author>.+?) - (?<title>.+?)\\.(?:pdf|epub)$';

export const EXAMPLE_METADATA_REGEX_COMMA =
  '^(?<author>.+?), (?<title>.+?)\\.(?:pdf|epub)$';

export interface FilterExampleGroup {
  id: string;
  labelKey: TranslationKey;
  introKey?: TranslationKey;
  sampleNames?: string[];
  value: string;
}

export const METADATA_REGEX_EXAMPLES: FilterExampleGroup[] = [
  {
    id: 'dash',
    labelKey: 'Filter example metadata dash',
    introKey: 'Filter example metadata intro',
    sampleNames: [
      'Dupont - Deep Learning Notes.pdf',
      'Martin - Introduction a Rust.epub',
    ],
    value: EXAMPLE_METADATA_REGEX_BASENAME,
  },
  {
    id: 'comma',
    labelKey: 'Filter example metadata comma',
    introKey: 'Filter example metadata intro',
    sampleNames: [
      'Dupont, Deep Learning Notes.pdf',
      'Martin, Rust Book.epub',
    ],
    value: EXAMPLE_METADATA_REGEX_COMMA,
  },
  {
    id: 'year-dash',
    labelKey: 'Filter example metadata year dash',
    introKey: 'Filter example metadata intro',
    sampleNames: [
      '2024 - Dupont - Machine Learning Guide.pdf',
      '2019 - Martin - Systèmes distribués.epub',
    ],
    value:
      '^(?:\\d{4})\\s*-\\s*(?<author>.+?)\\s*-\\s*(?<title>.+?)\\.(?:pdf|epub)$',
  },
  {
    id: 'brackets-author',
    labelKey: 'Filter example metadata brackets author',
    introKey: 'Filter example metadata intro',
    sampleNames: [
      '[Dupont] Deep Learning Notes.pdf',
      '[Martin] Rust Essentials.epub',
    ],
    value: '^\\[(?<author>[^\\]]+)\\]\\s*(?<title>.+?)\\.(?:pdf|epub)$',
  },
];

export function mergeLinesIntoTextarea(
  current: string,
  lines: string[]
): string {
  const existing = new Set(
    current
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
  );
  for (const line of lines) existing.add(line);
  return [...existing].join('\n');
}
