/**
 * Provides path/fs/crypto/electron only on desktop; on mobile returns stubs so we
 * never load Node modules and the plugin can load on Android/iOS.
 */
import { Platform } from 'obsidian';

type NodeRequire = (id: string) => unknown;

/**
 * Node/Electron module loader, desktop only (Electron exposes `require` on the
 * renderer global). Returns `null` on mobile or when the module is unavailable.
 */
export function desktopRequire<T>(id: string): T | null {
  if (!Platform.isDesktop) return null;
  const req = (window as unknown as { require?: NodeRequire }).require;
  if (typeof req !== 'function') return null;
  try {
    return req(id) as T;
  } catch {
    return null;
  }
}

export type ParsedPath = {
  root: string;
  dir: string;
  base: string;
  ext: string;
  name: string;
};

export type PathLike = {
  join: (...segments: string[]) => string;
  dirname: (p: string) => string;
  basename: (p: string, ext?: string) => string;
  extname: (p: string) => string;
  normalize: (p: string) => string;
  relative: (from: string, to: string) => string;
  parse: (p: string) => ParsedPath;
  isAbsolute: (p: string) => boolean;
};

function minimalPath(): PathLike {
  const sep = '/';
  const lastSep = (p: string) => Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  const basename = (p: string, ext?: string) => {
    const i = lastSep(p);
    const base = i < 0 ? p : p.slice(i + 1);
    return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
  };
  const extname = (p: string) => {
    const base = basename(p);
    const j = base.lastIndexOf('.');
    return j <= 0 ? '' : base.slice(j);
  };
  const normalize = (p: string) => {
    const s = p.replace(/\\/g, sep);
    const abs = s.startsWith(sep);
    const out: string[] = [];
    for (const part of s.split(sep)) {
      if (!part || part === '.') continue;
      if (part === '..' && out.length && out[out.length - 1] !== '..') out.pop();
      else if (part !== '..' || !abs) out.push(part);
    }
    const joined = out.join(sep);
    return abs ? sep + joined : joined || '.';
  };
  return {
    join: (...a: string[]) =>
      a.filter(Boolean).join(sep).replace(/\\/g, sep).replace(/\/+/g, sep),
    dirname: (p: string) => {
      const i = lastSep(p);
      return i <= 0 ? '' : p.slice(0, i);
    },
    basename,
    extname,
    normalize,
    relative: (from: string, to: string) => {
      const a = normalize(from).split(sep).filter(Boolean);
      const b = normalize(to).split(sep).filter(Boolean);
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      return [...a.slice(i).map(() => '..'), ...b.slice(i)].join(sep);
    },
    parse: (p: string) => {
      const i = lastSep(p);
      const base = i < 0 ? p : p.slice(i + 1);
      const j = base.lastIndexOf('.');
      return {
        root: '',
        dir: i <= 0 ? '' : p.slice(0, i),
        base,
        ext: j < 0 ? '' : base.slice(j),
        name: j < 0 ? base : base.slice(0, j),
      };
    },
    isAbsolute: (p: string) => p.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(p),
  };
}

let _path: PathLike | null = null;

export function getPath(): PathLike {
  if (_path) return _path;
  _path = desktopRequire<PathLike>('path') ?? minimalPath();
  return _path;
}

/** Contenu binaire renvoyé par `fs` (Buffer Node sur desktop). */
export type FsData = { toString(encoding?: string): string };

export type FsLike = {
  existsSync: (p: string) => boolean;
  readFileSync: (p: string, encoding?: string) => FsData;
  readFile: (p: string, cb: (err: Error | null, data: FsData) => void) => void;
  writeFileSync: (p: string, data: string | Uint8Array) => void;
  mkdirSync: (p: string, opts?: { recursive?: boolean }) => void;
  watch: (p: string, cb: (event: string) => void) => { close: () => void };
};

function noopWatcher() {
  return { close: () => {} };
}

let _fs: FsLike | null = null;

export function getFs(): FsLike {
  if (_fs) return _fs;
  _fs = desktopRequire<FsLike>('fs') ?? {
    existsSync: () => false,
    readFileSync: () => '',
    readFile: (_p, cb) => cb(new Error('fs not available on mobile'), ''),
    writeFileSync: () => {},
    mkdirSync: () => {},
    watch: () => noopWatcher(),
  };
  return _fs;
}

type ElectronLike = {
  clipboard?: { write: (data: { html?: string; text?: string }) => void };
  remote?: {
    dialog?: {
      showOpenDialogSync: (opts: {
        defaultPath?: string;
        properties: string[];
      }) => string[] | undefined;
    };
  };
};

function getElectron(): ElectronLike | null {
  return desktopRequire<ElectronLike>('electron');
}

/** Boîte de dialogue native « ouvrir un fichier » (desktop). */
export function showOpenFileDialog(defaultPath?: string): string[] | undefined {
  return getElectron()?.remote?.dialog?.showOpenDialogSync({
    defaultPath,
    properties: ['openFile'],
  });
}

/** Presse-papiers Electron (HTML + texte) ; `false` si indisponible. */
export function writeElectronClipboard(data: { html?: string; text?: string }): boolean {
  const clipboard = getElectron()?.clipboard;
  if (!clipboard) return false;
  clipboard.write(data);
  return true;
}

export function isDesktop(): boolean {
  return Platform.isDesktop;
}
