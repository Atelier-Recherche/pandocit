import { CSLList, PartialCSLEntry } from './types';
import { pandocConvertToCslJson } from '../pandocWasm';
import { getPath, getFs, getHttps, isDesktop } from '../platformAdapter';

export const DEFAULT_ZOTERO_PORT = '23119';

function ensureDir(dir: string) {
  const fs = getFs();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getBibPath(bibPath: string, getVaultRoot?: () => string) {
  const path = getPath();
  const fs = getFs();

  if (fs.existsSync(bibPath)) {
    return bibPath;
  }

  const orig = bibPath;
  if (getVaultRoot) {
    const root = getVaultRoot();
    const abs = path.isAbsolute(bibPath) ? bibPath : path.join(root, bibPath);
    if (isDesktop() && !fs.existsSync(abs)) {
      throw new Error(`bibToCSL: cannot access bibliography file '${abs}'.`);
    }
    return abs;
  }

  if (isDesktop()) {
    throw new Error(`bibToCSL: cannot access bibliography file '${orig}'.`);
  }
  return orig;
}

async function readBibliographyFile(
  bibPath: string,
  getVaultRoot?: () => string
): Promise<string> {
  const path = getPath();
  const resolved = getBibPath(bibPath, getVaultRoot);

  try {
    const anyApp = app as any;
    if (anyApp?.vault?.adapter?.read && getVaultRoot) {
      const root = getVaultRoot();
      const norm = root ? resolved.replace(/\\/g, '/').replace(root.replace(/\\/g, '/'), '').replace(/^\//, '') : resolved.replace(/\\/g, '/');
      if (!root || resolved.startsWith(root) || !path.isAbsolute(resolved)) {
        const rel = root && resolved.startsWith(root)
          ? resolved.slice(root.length).replace(/^[\\/]/, '')
          : resolved.replace(/^[\\/]+/, '');
        const data = await anyApp.vault.adapter.read(rel);
        if (typeof data === 'string') return data;
      }
    }
  } catch {
    // fallback to fs on desktop
  }

  if (!isDesktop()) {
    throw new Error(`bibToCSL: cannot read file on mobile (path: ${resolved}). Use a path relative to the vault.`);
  }

  const fs = getFs();
  return await new Promise<string>((res, rej) => {
    fs.readFile(resolved, (err, data) => {
      if (err) return rej(err);
      res(data.toString());
    });
  });
}

export async function bibToCSL(
  bibPath: string,
  getVaultRoot?: () => string
): Promise<PartialCSLEntry[]> {
  const path = getPath();
  const resolvedPath = getBibPath(bibPath, getVaultRoot);

  const parsed = path.parse(resolvedPath);
  if (parsed.ext === '.json') {
    const contents = await readBibliographyFile(resolvedPath, getVaultRoot);
    return JSON.parse(contents);
  }

  const contents = await readBibliographyFile(resolvedPath, getVaultRoot);
  const virtualName = `input${parsed.ext || '.bib'}`;

  const stdout = await pandocConvertToCslJson(virtualName, contents);

  return JSON.parse(stdout);
}

async function fetchUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

export async function getCSLLocale(
  localeCache: Map<string, string>,
  cacheDir: string,
  lang: string
) {
  if (localeCache.has(lang)) {
    return localeCache.get(lang);
  }

  const url = `https://raw.githubusercontent.com/citation-style-language/locales/master/locales-${lang}.xml`;
  const path = getPath();
  const fs = getFs();
  const outpath = path.join(cacheDir, `locales-${lang}.xml`);

  if (isDesktop()) {
    ensureDir(cacheDir);
    if (fs.existsSync(outpath)) {
      const localeData = fs.readFileSync(outpath).toString();
      localeCache.set(lang, localeData);
      return localeData;
    }
  }

  const str = isDesktop() && getHttps()
    ? await new Promise<string>((res, rej) => {
        getHttps().get(url, (result: any) => {
          let output = '';
          result.setEncoding('utf8');
          result.on('data', (chunk: string) => (output += chunk));
          result.on('error', (e: Error) => rej(`Downloading locale: ${e}`));
          result.on('end', () => {
            if (/^404: Not Found/.test(output)) rej(new Error('Error downloading locale: 404'));
            else res(output);
          });
        });
      })
    : await fetchUrl(url);

  if (isDesktop()) {
    fs.writeFileSync(outpath, str);
  }
  localeCache.set(lang, str);
  return str;
}

export async function getCSLStyle(
  styleCache: Map<string, string>,
  cacheDir: string,
  url: string,
  explicitPath?: string
) {
  const path = getPath();
  const fs = getFs();

  if (explicitPath) {
    if (styleCache.has(explicitPath)) {
      return styleCache.get(explicitPath);
    }

    if (isDesktop() && !fs.existsSync(explicitPath)) {
      throw new Error(
        `Error: retrieving citation style; Cannot find file '${explicitPath}'.`
      );
    }

    if (isDesktop()) {
      const styleData = fs.readFileSync(explicitPath).toString();
      styleCache.set(explicitPath, styleData);
      return styleData;
    }

    try {
      const anyApp = app as any;
      if (anyApp?.vault?.adapter?.read) {
        const data = await anyApp.vault.adapter.read(explicitPath.replace(/^[\\/]+/, ''));
        if (typeof data === 'string') {
          styleCache.set(explicitPath, data);
          return data;
        }
      }
    } catch (e) {
      throw new Error(`Error: cannot read style file '${explicitPath}'.`);
    }
  }

  if (styleCache.has(url)) {
    return styleCache.get(url);
  }

  const fileFromURL = url.split('/').pop();
  const outpath = path.join(cacheDir, fileFromURL);

  if (isDesktop()) {
    ensureDir(cacheDir);
    if (fs.existsSync(outpath)) {
      const styleData = fs.readFileSync(outpath).toString();
      styleCache.set(url, styleData);
      return styleData;
    }
  }

  const str = isDesktop() && getHttps()
    ? await new Promise<string>((res, rej) => {
        getHttps().get(url, (result: any) => {
          let output = '';
          result.setEncoding('utf8');
          result.on('data', (chunk: string) => (output += chunk));
          result.on('error', (e: Error) => rej(`Error downloading CSL: ${e}`));
          result.on('end', () => res(output));
        });
      })
    : await fetchUrl(url);

  if (isDesktop()) {
    fs.writeFileSync(outpath, str);
  }
  styleCache.set(url, str);
  return str;
}

export const defaultHeaders = {
  'Content-Type': 'application/json',
  'User-Agent': 'obsidian/zotero',
  Accept: 'application/json',
  Connection: 'keep-alive',
};

function getGlobal() {
  if (typeof window !== 'undefined' && (window as any).activeWindow) return (window as any).activeWindow;
  if (typeof window !== 'undefined') return window;
  return typeof global !== 'undefined' ? global : ({} as any);
}

export async function getZUserGroups(
  port: string = DEFAULT_ZOTERO_PORT
): Promise<Array<{ id: number; name: string }>> {
  if (!isDesktop()) return null;
  if (!(await isZoteroRunning(port))) return null;

  const request = require('http').request;
  return new Promise((res, rej) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'user.groups',
    });

    const postRequest = request(
      {
        host: '127.0.0.1',
        port: port,
        path: '/better-bibtex/json-rpc',
        method: 'POST',
        headers: {
          ...defaultHeaders,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (result: any) => {
        let output = '';
        result.setEncoding('utf8');
        result.on('data', (chunk: string) => (output += chunk));
        result.on('error', (e: Error) => rej(`Error connecting to Zotero: ${e}`));
        result.on('end', () => {
          try {
            res(JSON.parse(output).result);
          } catch (e) {
            rej(e);
          }
        });
      }
    );
    postRequest.write(body);
    postRequest.end();
  });
}

function panNum(n: number) {
  if (n < 10) return `0${n}`;
  return n.toString();
}

function timestampToZDate(ts: number) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${panNum(d.getUTCMonth() + 1)}-${panNum(
    d.getUTCDate()
  )} ${panNum(d.getUTCHours())}:${panNum(d.getUTCMinutes())}:${panNum(
    d.getUTCSeconds()
  )}`;
}

export async function getZModified(
  port: string = DEFAULT_ZOTERO_PORT,
  groupId: number,
  since: number
): Promise<CSLList> {
  if (!isDesktop()) return null;
  if (!(await isZoteroRunning(port))) return null;

  const request = require('http').request;
  return new Promise((res, rej) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'item.search',
      params: [[['dateModified', 'isAfter', timestampToZDate(since)]], groupId],
    });

    const postRequest = request(
      {
        host: '127.0.0.1',
        port: port,
        path: '/better-bibtex/json-rpc',
        method: 'POST',
        headers: {
          ...defaultHeaders,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (result: any) => {
        let output = '';
        result.setEncoding('utf8');
        result.on('data', (chunk: string) => (output += chunk));
        result.on('error', (e: Error) => rej(`Error connecting to Zotero: ${e}`));
        result.on('end', () => {
          try {
            res(JSON.parse(output).result);
          } catch (e) {
            rej(e);
          }
        });
      }
    );
    postRequest.write(body);
    postRequest.end();
  });
}

function applyGroupID(list: CSLList, groupId: number) {
  return list.map((item) => {
    item.groupID = groupId;
    return item;
  });
}

export async function getZBib(
  port: string = DEFAULT_ZOTERO_PORT,
  cacheDir: string,
  groupId: number,
  loadCached?: boolean
) {
  if (!isDesktop()) return null;

  const path = getPath();
  const fs = getFs();
  const isRunning = await isZoteroRunning(port);
  const cached = path.join(cacheDir, `zotero-library-${groupId}.json`);

  ensureDir(cacheDir);
  if (loadCached || !isRunning) {
    if (fs.existsSync(cached)) {
      return applyGroupID(
        JSON.parse(fs.readFileSync(cached).toString()) as CSLList,
        groupId
      );
    }
    if (!isRunning) {
      return null;
    }
  }

  const download = require('download');
  const bib = await download(
    `http://127.0.0.1:${port}/better-bibtex/export/library?/${groupId}/library.json`
  );
  const str = bib.toString();

  fs.writeFileSync(cached, str);

  return applyGroupID(JSON.parse(str) as CSLList, groupId);
}

export async function refreshZBib(
  port: string = DEFAULT_ZOTERO_PORT,
  cacheDir: string,
  groupId: number,
  since: number
) {
  if (!isDesktop()) return null;
  if (!(await isZoteroRunning(port))) return null;

  const path = getPath();
  const fs = getFs();
  const cached = path.join(cacheDir, `zotero-library-${groupId}.json`);
  ensureDir(cacheDir);
  if (!fs.existsSync(cached)) return null;

  const mList = (await getZModified(port, groupId, since)) as CSLList;
  if (!mList?.length) return null;

  const modified: Map<string, PartialCSLEntry> = new Map();
  const newKeys: Set<string> = new Set();

  for (const mod of mList) {
    mod.id = (mod as any).citekey || (mod as any)['citation-key'];
    if (!mod.id) continue;
    modified.set(mod.id, mod);
    newKeys.add(mod.id);
  }

  const list = JSON.parse(fs.readFileSync(cached).toString()) as CSLList;

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (modified.has(item.id)) {
      newKeys.delete(item.id);
      list[i] = modified.get(item.id);
    }
  }

  for (const key of newKeys) {
    list.push(modified.get(key));
  }

  fs.writeFileSync(cached, JSON.stringify(list));

  return {
    list: applyGroupID(list, groupId),
    modified,
  };
}

export async function isZoteroRunning(port: string = DEFAULT_ZOTERO_PORT) {
  if (!isDesktop()) return false;

  const download = require('download');
  const p = download(`http://127.0.0.1:${port}/better-bibtex/cayw?probe=true`);
  const res = await Promise.race([
    p,
    new Promise((res) => {
      getGlobal().setTimeout(() => {
        res(null);
        p.destroy();
      }, 150);
    }),
  ]);

  return res?.toString() === 'ready';
}

export async function getItemJSONFromCiteKeys(
  port: string = DEFAULT_ZOTERO_PORT,
  citeKeys: string[],
  libraryID: number
) {
  if (!isDesktop()) return null;
  if (!(await isZoteroRunning(port))) return null;

  const request = require('http').request;
  let res: any;
  try {
    res = await new Promise((res, rej) => {
      const body = JSON.stringify({
        jsonrpc: '2.0',
        method: 'item.export',
        params: [citeKeys, '36a3b0b5-bad0-4a04-b79b-441c7cef77db', libraryID],
      });

      const postRequest = request(
        {
          host: '127.0.0.1',
          port: port,
          path: '/better-bibtex/json-rpc',
          method: 'POST',
          headers: {
            ...defaultHeaders,
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (result: any) => {
          let output = '';
          result.setEncoding('utf8');
          result.on('data', (chunk: string) => (output += chunk));
          result.on('error', (e: Error) => rej(`Error connecting to Zotero: ${e}`));
          result.on('end', () => {
            try {
              res(JSON.parse(output));
            } catch (e) {
              rej(e);
            }
          });
        }
      );

      postRequest.write(body);
      postRequest.end();
    });
  } catch (e) {
    console.error(e);
    return null;
  }

  try {
    if (res.error?.message) {
      console.error(new Error(res.error.message));
      return null;
    }

    return Array.isArray(res.result)
      ? JSON.parse(res.result[2]).items
      : JSON.parse(res.result).items;
  } catch (e) {
    console.error(e);
    return null;
  }
}
