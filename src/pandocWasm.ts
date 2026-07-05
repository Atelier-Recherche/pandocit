import {
  WASI,
  OpenFile,
  File,
  ConsoleStdout,
  PreopenDirectory,
} from '@bjorn3/browser_wasi_shim';

type PandocOptions = Record<string, unknown>;

interface ConvertResult {
  stdout: string;
  stderr: string;
  warnings: unknown[];
}

/** Forme réelle des exports du module WASM pandoc, plus précise que `WebAssembly.Exports`. */
interface PandocWasmExports {
  memory: WebAssembly.Memory;
  malloc: (size: number) => number;
  hs_init_with_rtsopts: (argcPtr: number, argvPtr: number) => void;
  convert: (optsPtr: number, optsLen: number) => void;
  __wasm_call_ctors?: () => void;
}

/** Forme minimale attendue par `WASI#initialize` (voir @bjorn3/browser_wasi_shim). */
type WasiInitInstance = { exports: { memory: WebAssembly.Memory; _initialize?: () => unknown } };

let wasi: WASI | null = null;
let instance: WebAssembly.Instance | null = null;
let fileSystem: Map<string, File> | null = null;
let initialized = false;

function getWasmExports(inst: WebAssembly.Instance): PandocWasmExports {
  return inst.exports as unknown as PandocWasmExports;
}

function getMemoryDataView() {
  if (!instance) {
    throw new Error('pandoc.wasm is not initialized');
  }
  return new DataView(getWasmExports(instance).memory.buffer);
}

async function instantiateWasm(): Promise<WebAssembly.Instance> {
  const wasmUrl = 'pandoc.wasm';

  if ('instantiateStreaming' in WebAssembly) {
    try {
      const res = await WebAssembly.instantiateStreaming(fetch(wasmUrl), {
        wasi_snapshot_preview1: wasi!.wasiImport,
      });
      return res.instance;
    } catch {
      // Fallback below
    }
  }

  const response = await fetch(wasmUrl);
  const bytes = await response.arrayBuffer();
  const res = await WebAssembly.instantiate(bytes, {
    wasi_snapshot_preview1: wasi!.wasiImport,
  });
  return res.instance;
}

async function initPandoc(): Promise<void> {
  if (initialized) return;

  const args = ['pandoc.wasm', '+RTS', '-H64m', '-RTS'];
  const env: string[] = [];

  const stdinFile = new File(new Uint8Array(), { readonly: true });

  fileSystem = new Map<string, File>();
  const fds = [
    new OpenFile(stdinFile),
    ConsoleStdout.lineBuffered((msg) => console.log(`[WASI stdout] ${msg}`)),
    ConsoleStdout.lineBuffered((msg) => console.warn(`[WASI stderr] ${msg}`)),
    new PreopenDirectory('/', fileSystem),
  ];

  const options = { debug: false };
  wasi = new WASI(args, env, fds, options);

  try {
    instance = await instantiateWasm();
  } catch (e) {
    console.error('Failed to load pandoc.wasm', e);
    throw new Error('pandoc.wasm initialization failed');
  }
  wasi!.initialize(instance as unknown as WasiInitInstance);

  const view = getMemoryDataView();

  // Set up RTS (copied and adapted from upstream wasm/pandoc.js)
  const exports = getWasmExports(instance);
  const argcPtr = exports.malloc(4);
  view.setUint32(argcPtr, args.length, true);

  const argv = exports.malloc(4 * (args.length + 1));
  for (let i = 0; i < args.length; ++i) {
    const arg = exports.malloc(args[i].length + 1);
    new TextEncoder().encodeInto(
      args[i],
      new Uint8Array(exports.memory.buffer, arg, args[i].length)
    );
    view.setUint8(arg + args[i].length, 0);
    view.setUint32(argv + 4 * i, arg, true);
  }
  view.setUint32(argv + 4 * args.length, 0, true);

  const argvPtr = exports.malloc(4);
  view.setUint32(argvPtr, argv, true);

  if (exports.__wasm_call_ctors) {
    exports.__wasm_call_ctors();
  }

  exports.hs_init_with_rtsopts(argcPtr, argvPtr);

  initialized = true;
}

async function addFileToFs(
  filename: string,
  blob: Blob,
  readonly: boolean
): Promise<void> {
  if (!fileSystem) {
    throw new Error('pandoc.wasm filesystem not initialized');
  }
  const buffer = await blob.arrayBuffer();
  const file = new File(new Uint8Array(buffer), { readonly });
  fileSystem.set(filename, file);
}

async function convertInternal(
  options: PandocOptions,
  stdin: string | null,
  files: Record<string, Blob>
): Promise<ConvertResult> {
  await initPandoc();
  if (!instance || !fileSystem || !wasi) {
    throw new Error('pandoc.wasm failed to initialize');
  }

  const exports = getWasmExports(instance);

  const optsStr = JSON.stringify(options);
  const optsPtr = exports.malloc(optsStr.length);
  new TextEncoder().encodeInto(
    optsStr,
    new Uint8Array(exports.memory.buffer, optsPtr, optsStr.length)
  );

  fileSystem.clear();

  const inFile = new File(new Uint8Array(), { readonly: true });
  const outFile = new File(new Uint8Array(), { readonly: false });
  const errFile = new File(new Uint8Array(), { readonly: false });
  const warningsFile = new File(new Uint8Array(), { readonly: false });

  fileSystem.set('stdin', inFile);
  fileSystem.set('stdout', outFile);
  fileSystem.set('stderr', errFile);
  fileSystem.set('warnings', warningsFile);

  for (const key of Object.keys(files)) {
    await addFileToFs(key, files[key], true);
  }

  if (typeof options['output-file'] === 'string') {
    await addFileToFs(options['output-file'], new Blob(), false);
  }

  if (typeof options['extract-media'] === 'string') {
    await addFileToFs(options['extract-media'], new Blob(), false);
  }

  if (stdin) {
    inFile.data = new TextEncoder().encode(stdin);
  }

  exports.convert(optsPtr, optsStr.length);

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const stdout = decoder.decode(outFile.data);
  const stderr = decoder.decode(errFile.data);
  const rawWarnings = decoder.decode(warningsFile.data);

  let warnings: unknown[] = [];
  if (rawWarnings) {
    try {
      warnings = JSON.parse(rawWarnings);
    } catch {
      warnings = [];
    }
  }

  return { stdout, stderr, warnings };
}

export async function pandocConvertToCslJson(
  fileName: string,
  contents: string
): Promise<string> {
  const files: Record<string, Blob> = {
    [fileName]: new Blob([contents], { type: 'text/plain' }),
  };

  const options: PandocOptions = {
    'input-files': [fileName],
    'output-file': null,
    to: 'csljson',
    quiet: true,
  };

  const res = await convertInternal(options, null, files);

  if (res.stderr) {
    // pandoc writes non-fatal messages to stderr too, so we only throw if stdout is empty
    if (!res.stdout.trim()) {
      throw new Error(`pandoc.wasm error: ${res.stderr}`);
    }
    console.warn('[pandoc.wasm] stderr:', res.stderr);
  }

  return res.stdout;
}

