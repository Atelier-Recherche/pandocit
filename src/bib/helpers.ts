import type { App } from 'obsidian';
import { Platform, requestUrl } from 'obsidian';

import { CSLList, PartialCSLEntry } from './types';
import { pandocConvertToCslJson } from '../pandocWasm';
import { getVaultRoot } from '../helpers';
import { getFs, getPath, isDesktop } from '../platformAdapter';

export const DEFAULT_ZOTERO_PORT = '23119';

function ensureDir(dir: string) {
  const fs = getFs();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getBibPath(bibPath: string, app?: App) {
  const path = getPath();
  const fs = getFs();

  if (fs.existsSync(bibPath)) {
    return bibPath;
  }

  const orig = bibPath;
  if (app) {
    const root = getVaultRoot(app);
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

export async function readBibliographyFile(
  bibPath: string,
  app?: App
): Promise<string> {
  const path = getPath();
  const resolved = getBibPath(bibPath, app);

  try {
    if (app?.vault?.adapter?.read) {
      const root = app ? getVaultRoot(app) : '';
      if (!root || resolved.startsWith(root) || !path.isAbsolute(resolved)) {
        const rel = root && resolved.startsWith(root)
          ? resolved.slice(root.length).replace(/^[\\/]/, '')
          : resolved.replace(/^[\\/]+/, '');
        const data = await app.vault.adapter.read(rel);
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
  app?: App
): Promise<PartialCSLEntry[]> {
  const path = getPath();
  const resolvedPath = getBibPath(bibPath, app);

  const parsed = path.parse(resolvedPath);
  if (parsed.ext === '.json') {
    const contents = await readBibliographyFile(resolvedPath, app);
    return JSON.parse(contents) as PartialCSLEntry[];
  }

  const contents = await readBibliographyFile(resolvedPath, app);
  const virtualName = `input${parsed.ext || '.bib'}`;

  const stdout = await pandocConvertToCslJson(virtualName, contents);

  return JSON.parse(stdout) as PartialCSLEntry[];
}

async function fetchUrl(url: string): Promise<string> {
  const res = await requestUrl({ url });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status}: ${url}`);
  }
  return res.text;
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

  const str = await fetchUrl(url);

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
  explicitPath?: string,
  app?: App
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
      if (app?.vault?.adapter?.read) {
        const data = await app.vault.adapter.read(
          explicitPath.replace(/^[\\/]+/, '')
        );
        if (typeof data === 'string') {
          styleCache.set(explicitPath, data);
          return data;
        }
      }
    } catch {
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

  const str = await fetchUrl(url);

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
};

type JsonRpcResponse<T> = {
  result?: T;
  error?: { message?: string };
};

/** Requête JSON-RPC Better BibTeX (`/better-bibtex/json-rpc`, desktop). */
async function zoteroJsonRpc<T>(
  port: string,
  payload: { method: string; params?: unknown[] }
): Promise<JsonRpcResponse<T>> {
  const res = await requestUrl({
    url: `http://127.0.0.1:${port}/better-bibtex/json-rpc`,
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({ jsonrpc: '2.0', ...payload }),
    throw: false,
  });
  return JSON.parse(res.text) as JsonRpcResponse<T>;
}

export async function getZUserGroups(
  port: string = DEFAULT_ZOTERO_PORT
): Promise<Array<{ id: number; name: string }>> {
  if (!Platform.isDesktop) return null;
  if (!(await isZoteroRunning(port))) return null;

  const res = await zoteroJsonRpc<Array<{ id: number; name: string }>>(port, {
    method: 'user.groups',
  });
  return res.result;
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
  if (!Platform.isDesktop) return null;
  if (!(await isZoteroRunning(port))) return null;

  const res = await zoteroJsonRpc<CSLList>(port, {
    method: 'item.search',
    params: [[['dateModified', 'isAfter', timestampToZDate(since)]], groupId],
  });
  return res.result;
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
  if (!Platform.isDesktop) return null;

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

  const bib = await requestUrl({
    url: `http://127.0.0.1:${port}/better-bibtex/export/library?/${groupId}/library.json`,
  });
  const str = bib.text;

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

  const mList = (await getZModified(port, groupId, since));
  if (!mList?.length) return null;

  const modified: Map<string, PartialCSLEntry> = new Map();
  const newKeys: Set<string> = new Set();

  for (const mod of mList) {
    const keyed = mod as PartialCSLEntry & {
      citekey?: string;
      'citation-key'?: string;
    };
    mod.id = keyed.citekey || keyed['citation-key'];
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
  if (!Platform.isDesktop) return false;

  const probe = (async (): Promise<string | null> => {
    try {
      const r = await requestUrl({
        url: `http://127.0.0.1:${port}/better-bibtex/cayw?probe=true`,
      });
      return r.text;
    } catch {
      return null;
    }
  })();
  const timer = typeof activeWindow !== 'undefined' ? activeWindow : window;
  const res = await Promise.race([
    probe,
    new Promise<null>((resolve) => {
      timer.setTimeout(() => resolve(null), 150);
    }),
  ]);

  return res === 'ready';
}

export async function getItemJSONFromCiteKeys(
  port: string = DEFAULT_ZOTERO_PORT,
  citeKeys: string[],
  libraryID: number
) {
  if (!Platform.isDesktop) return null;
  if (!(await isZoteroRunning(port))) return null;

  let res: JsonRpcResponse<string | string[]>;
  try {
    res = await zoteroJsonRpc<string | string[]>(port, {
      method: 'item.export',
      params: [citeKeys, '36a3b0b5-bad0-4a04-b79b-441c7cef77db', libraryID],
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

    const raw = Array.isArray(res.result) ? res.result[2] : res.result;
    return (JSON.parse(raw) as { items: unknown[] }).items;
  } catch (e) {
    console.error(e);
    return null;
  }
}
