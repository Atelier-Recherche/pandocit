/* eslint-disable @typescript-eslint/ban-ts-comment */

import path from 'path';
import {
  bibToCSL,
  getCSLLocale,
  getCSLStyle,
  // getZBib,
  getZUserGroups,
  isZoteroRunning,
} from '../helpers';
import { setPandocWasmBytesLoader } from '../../pandocWasm';

// @ts-ignore
import testCSL from './test.json';
// @ts-ignore
import testBIBCSL from './test.bib.json';
// @ts-ignore
import testBIB2CSL from './test2.bib.json';
// @ts-ignore
import testYAMLCSL from './test.yaml.json';
// @ts-ignore
// import library from './My Library.json';
import { existsSync, readFileSync, rmSync } from 'fs';

const wasmCandidates = [
  path.join(__dirname, '../../../pandoc.wasm'),
  path.join(process.cwd(), 'pandoc.wasm'),
];
const wasmPath = wasmCandidates.find((p) => existsSync(p));
if (wasmPath) {
  setPandocWasmBytesLoader(async () => {
    const buf = readFileSync(wasmPath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  });
}

describe('bibToCSL()', () => {
  it('returns json from json', async () => {
    expect(await bibToCSL(path.join(__dirname, 'test.json'))).toEqual(testCSL);
  });

  (wasmPath ? it : it.skip)('returns json from bib', async () => {
    expect(await bibToCSL(path.join(__dirname, 'test.bib'))).toEqual(
      testBIBCSL
    );
  });

  (wasmPath ? it : it.skip)('returns json from bib2', async () => {
    expect(await bibToCSL(path.join(__dirname, 'test2.bib'))).toEqual(
      testBIB2CSL
    );
  });

  (wasmPath ? it : it.skip)('returns json from yaml', async () => {
    expect(await bibToCSL(path.join(__dirname, 'test.yaml'))).toEqual(
      testYAMLCSL
    );
  });
});

// @ts-ignore
global.setImmediate =
  // @ts-ignore
  global.setImmediate || ((fn, ...args) => global.setTimeout(fn, 0, ...args));

describe('getLocale()', () => {
  it('fetches a locale', async () => {
    const cache = new Map<string, string>();
    jest.spyOn(navigator, 'onLine', 'get').mockReturnValueOnce(true);
    const locale = await getCSLLocale(cache, __dirname, 'bg-BG');
    expect(typeof locale).toBe('string');
    expect(existsSync(path.join(__dirname, 'locales-bg-BG.xml'))).toBe(true);
    await getCSLLocale(cache, __dirname, 'bg-BG');
    rmSync(path.join(__dirname, 'locales-bg-BG.xml'));
  });
});

describe('getStyle()', () => {
  it('fetches a style', async () => {
    const cache = new Map<string, string>();
    jest.spyOn(navigator, 'onLine', 'get').mockReturnValueOnce(true);
    const style = await getCSLStyle(
      cache,
      __dirname,
      'https://www.zotero.org/styles/australian-guide-to-legal-citation-3rd-edition'
    );
    expect(typeof style).toBe('string');
    expect(
      existsSync(
        path.join(__dirname, 'australian-guide-to-legal-citation-3rd-edition')
      )
    ).toBe(true);
    await getCSLStyle(
      cache,
      __dirname,
      'australian-guide-to-legal-citation-3rd-edition'
    );
    rmSync(
      path.join(__dirname, 'australian-guide-to-legal-citation-3rd-edition')
    );
  });
});

describe('getZUserGroups()', () => {
  it('retrieves user groups when BBT is available', async () => {
    const groups = await getZUserGroups('23119');
    if (!groups) return;
    expect(Array.isArray(groups)).toBe(true);
    expect(groups.length).toBeGreaterThan(0);
  });
});

// describe('getZBib()', () => {
//   it('retrieves bib', async () => {
//     expect(await getZBib(new Map(), '23119', 1, 'My Library')).toEqual(library);
//   });
// });

describe('isZoteroRunning()', () => {
  it('probes BBT without throwing', async () => {
    const running = await isZoteroRunning('23119');
    expect(typeof running).toBe('boolean');
  });
});
