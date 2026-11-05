import { defineConfig, globalIgnores } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
  globalIgnores([
    'node_modules',
    'dist',
    'build',
    'main.js',
    'main-a.js',
    'main-b.js',
    'main.js.build1',
    'foliate',
    'foliate-view.mjs',
    'foliate-view-after1.js',
    'pdfjs',
    'pdf-assets',
    'pdf.worker.min.mjs',
    'scripts',
    '__mocks__',
    'esbuild.config.mjs',
    'version-bump.mjs',
    'make-csl-lang-list.mjs',
    'make-csl-list.mjs',
    'make-locator-list.mjs',
    'babel.config.js',
    'jest.setup.js',
    'prettier.config.cjs',
    '.prettierrc.js',
    '**/*.md',
    '**/*.csl',
    'src/**/tests/**',
    'src/**/*.test.ts',
    'src/assets/**',
    'src/readers/epub/vendor/**',
  ]),
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.mjs'],
        },
      },
    },
  },
]);
