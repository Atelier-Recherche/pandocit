import esbuild from 'esbuild';
import { readFileSync, cpSync, existsSync, writeFileSync } from 'fs';
import { gzipSync } from 'fflate';
import { builtinModules } from 'node:module';
import { createHash } from 'node:crypto';

const builtins = [
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];

const pdfWorkerBytes = readFileSync(
  'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'
);
const pdfWorkerGzB64 = Buffer.from(
  gzipSync(pdfWorkerBytes, { level: 9, mtime: 0 })
).toString('base64');

function copyFoliate() {
  if (!existsSync('node_modules/foliate-js')) return;
  cpSync('node_modules/foliate-js', 'foliate', { recursive: true });
  const viewPath = 'foliate/view.js';
  let src = readFileSync(viewPath, 'utf8');
  const bare = "customElements.define('foliate-view', View)";
  const guarded =
    "if (!customElements.get('foliate-view')) customElements.define('foliate-view', View)";
  if (src.includes(bare) && !src.includes(guarded)) {
    writeFileSync(viewPath, src.replace(bare, guarded));
  }
}

const opts = {
  banner: { js: '/* esbuild */' },
  entryPoints: ['./src/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/closebrackets',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/comment',
    '@codemirror/fold',
    '@codemirror/gutter',
    '@codemirror/highlight',
    '@codemirror/history',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/matchbrackets',
    '@codemirror/panel',
    '@codemirror/rangeset',
    '@codemirror/rectangular-selection',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/stream-parser',
    '@codemirror/text',
    '@codemirror/tooltip',
    '@codemirror/view',
    'node:*',
    ...builtins,
  ],
  format: 'cjs',
  target: 'es2020',
  logLevel: 'silent',
  treeShaking: true,
  outfile: 'main.js',
  minify: true,
  legalComments: 'none',
  charset: 'utf8',
  define: {
    __PDF_WORKER_GZ_B64__: JSON.stringify(pdfWorkerGzB64),
    __PDF_WORKER_CODE__: '""',
  },
};

async function hashAfterBuild() {
  await esbuild.build(opts);
  return createHash('sha256').update(readFileSync('main.js')).digest('hex');
}

copyFoliate();
const h1 = await hashAfterBuild();
const h2 = await hashAfterBuild();
const h3 = await hashAfterBuild();
console.log('no recopy between builds:', h1 === h2 && h2 === h3);
console.log('h1', h1);
console.log('h2', h2);

copyFoliate();
const h4 = await hashAfterBuild();
console.log('after foliate recopy:', h1 === h4);
console.log('h4', h4);
