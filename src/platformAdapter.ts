/**
 * Provides path/fs/https only on desktop; on mobile returns stubs so we never
 * require() Node modules and the plugin can load on Android/iOS.
 */
import { Platform } from 'obsidian';

export type PathLike = {
  join: (...segments: string[]) => string;
  dirname: (p: string) => string;
  parse: (p: string) => { root: string; dir: string; base: string; ext: string; name: string };
  isAbsolute: (p: string) => boolean;
};

function minimalPath(): PathLike {
  const sep = '/';
  return {
    join: (...a: string[]) =>
      a.filter(Boolean).join(sep).replace(/\\/g, sep).replace(/\/+/g, sep),
    dirname: (p: string) => {
      const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
      return i <= 0 ? '' : p.slice(0, i);
    },
    parse: (p: string) => {
      const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
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
  if (Platform.isDesktop) {
    try {
      _path = require('path') as PathLike;
      return _path;
    } catch {
      _path = minimalPath();
      return _path;
    }
  }
  _path = minimalPath();
  return _path;
}

export type FsLike = {
  existsSync: (p: string) => boolean;
  readFileSync: (p: string, encoding?: string) => Buffer | string;
  readFile: (p: string, cb: (err: NodeJS.ErrnoException | null, data: Buffer) => void) => void;
  writeFileSync: (p: string, data: string | Buffer) => void;
  mkdirSync: (p: string, opts?: { recursive?: boolean }) => void;
  watch: (p: string, cb: (event: string) => void) => { close: () => void };
};

function noopWatcher() {
  return { close: () => {} };
}

let _fs: FsLike | null = null;

export function getFs(): FsLike {
  if (_fs) return _fs;
  if (Platform.isDesktop) {
    try {
      _fs = require('fs') as FsLike;
      return _fs;
    } catch {
      _fs = null;
    }
  }
  _fs = {
    existsSync: () => false,
    readFileSync: () => '',
    readFile: (_p, cb) => cb(new Error('fs not available on mobile'), Buffer.from('')),
    writeFileSync: () => {},
    mkdirSync: () => {},
    watch: () => noopWatcher(),
  };
  return _fs;
}

let _https: typeof import('https') | null = null;
let _httpsTried = false;

export function getHttps(): typeof import('https') | null {
  if (_httpsTried) return _https;
  _httpsTried = true;
  if (!Platform.isDesktop) return null;
  try {
    _https = require('https') as typeof import('https');
    return _https;
  } catch {
    return null;
  }
}

export function isDesktop(): boolean {
  return Platform.isDesktop;
}
