import {
  WASI,
  OpenFile,
  File,
  ConsoleStdout,
  PreopenDirectory,
} from '@bjorn3/browser_wasi_shim';

type PandocOptions = Record<string, any>;

interface ConvertResult {
  stdout: string;
  stderr: string;
  warnings: unknown[];
}

let wasi: WASI | null = null;
let instance: WebAssembly.Instance | null = null;
let fileSystem: Map<string, File> | null = null;
let initialized = false;

function getMemoryDataView() {
  if (!instance) {
    throw new Error('pandoc.wasm is not initialized');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mem = (instance.exports as any).memory as WebAssembly.Memory;
  return new DataView(mem.buffer);
}

async function instantiateWasm(): Promise<WebAssembly.Instance> {
  const wasmUrl = 'pandoc.wasm';

  if ('instantiateStreaming' in WebAssembly) {
    try {
      const res = await WebAssembly.instantiateStreaming(
        fetch(wasmUrl),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { wasi_snapshot_preview1: (wasi as any).wasiImport }
      );
      return res.instance;
    } catch {
      // Fallback below
    }
  }

  const response = await fetch(wasmUrl);
  const bytes = await response.arrayBuffer();
  const res = await WebAssembly.instantiate(bytes, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wasi_snapshot_preview1: (wasi as any).wasiImport,
  });
  return res.instance;
}

async function initPandoc(): Promise<void> {
  if (initialized) return;

  const args = ['pandoc.wasm', '+RTS', '-H64m', '-RTS'];
  const env: string[] = [];

  const stdinFile = new File(new Uint8Array(), { readonly: true });
  const stdoutFile = new File(new Uint8Array(), { readonly: false });
  const stderrFile = new File(new Uint8Array(), { readonly: false });

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (wasi as any).initialize(instance);

  const view = getMemoryDataView();

  // Set up RTS (copied and adapted from upstream wasm/pandoc.js)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exports = instance.exports as any;
  const argcPtr = exports.malloc(4);
  view.setUint32(argcPtr, args.length, true);

  const argv = exports.malloc(4 * (args.length + 1));
  for (let i = 0; i < args.length; ++i) {
    const arg = exports.malloc(args[i].length + 1);
    new TextEncoder().encodeInto(
      args[i],
      new Uint8Array(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (exports.memory as WebAssembly.Memory).buffer,
        arg,
        args[i].length
      )
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exports = instance.exports as any;
  const view = getMemoryDataView();

  const optsStr = JSON.stringify(options);
  const optsPtr = exports.malloc(optsStr.length);
  new TextEncoder().encodeInto(
    optsStr,
    new Uint8Array(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (exports.memory as WebAssembly.Memory).buffer,
      optsPtr,
      optsStr.length
    )
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

  if (options['output-file']) {
    await addFileToFs(options['output-file'], new Blob(), false);
  }

  if (options['extract-media']) {
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

