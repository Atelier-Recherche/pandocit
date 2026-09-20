jest.mock(
  'obsidian',
  () => ({
    normalizePath: (p: string) =>
      p
        .replace(/\\/g, '/')
        .replace(/\/+/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+$/, ''),
  }),
  { virtual: true }
);

import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util';

if (typeof global.TextDecoder === 'undefined') {
  (global as unknown as { TextDecoder: typeof NodeTextDecoder }).TextDecoder = NodeTextDecoder;
}
if (typeof global.TextEncoder === 'undefined') {
  (global as unknown as { TextEncoder: typeof NodeTextEncoder }).TextEncoder = NodeTextEncoder;
}
if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(this);
    });
  };
}

import type ReferenceList from './main';
import { getPandocWasmPath } from './pandocWasmInstall';
import { instantiateWasm, pandocConvertToCslJson } from './pandocWasm';

describe('pandocWasm loader', () => {
  const dummyWasmBytes = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  ]);

  let originalFetch: typeof global.fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    originalFetch = (global as unknown as { fetch: typeof global.fetch }).fetch;
    mockFetch = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = mockFetch;
  });

  afterEach(() => {
    (global as unknown as { fetch: typeof global.fetch }).fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('reads binary wasm from plugin folder via adapter.readBinary and passes bytes to WebAssembly.instantiate', async () => {
    const mockAdapter = {
      readBinary: jest.fn().mockResolvedValue(dummyWasmBytes.buffer),
    };

    const mockPlugin = {
      manifest: { id: 'pandocit' },
      app: {
        vault: {
          adapter: mockAdapter,
        },
      },
    } as unknown as ReferenceList;

    const instantiateSpy = jest
      .spyOn(WebAssembly, 'instantiate')
      .mockResolvedValueOnce({
        instance: {} as unknown as WebAssembly.Instance,
        module: {} as unknown as WebAssembly.Module,
      });

    const expectedPath = getPandocWasmPath(mockPlugin);
    expect(expectedPath).toBe('.obsidian/plugins/pandocit/pandoc.wasm');

    const instance = await instantiateWasm(mockPlugin);

    expect(mockAdapter.readBinary).toHaveBeenCalledTimes(1);
    expect(mockAdapter.readBinary).toHaveBeenCalledWith(expectedPath);
    expect(instantiateSpy).toHaveBeenCalledTimes(1);
    expect(instantiateSpy).toHaveBeenCalledWith(
      dummyWasmBytes.buffer,
      expect.any(Object)
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(instance).toBeDefined();
  });

  it('reads exactly getPandocWasmPath(plugin) for different plugin IDs without fetch', async () => {
    const mockAdapter = {
      readBinary: jest.fn().mockResolvedValue(dummyWasmBytes.buffer),
    };

    const customPlugin = {
      manifest: { id: 'custom-plugin-id' },
      app: {
        vault: {
          adapter: mockAdapter,
        },
      },
    } as unknown as ReferenceList;

    jest.spyOn(WebAssembly, 'instantiate').mockResolvedValueOnce({
      instance: {} as unknown as WebAssembly.Instance,
      module: {} as unknown as WebAssembly.Module,
    });

    const expectedPath = getPandocWasmPath(customPlugin);
    expect(expectedPath).toBe('.obsidian/plugins/custom-plugin-id/pandoc.wasm');

    await instantiateWasm(customPlugin);

    expect(mockAdapter.readBinary).toHaveBeenCalledWith(expectedPath);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws an explicit error indicating the attempted path when readBinary fails', async () => {
    const mockAdapter = {
      readBinary: jest
        .fn()
        .mockRejectedValue(new Error('ENOENT: no such file or directory')),
    };

    const mockPlugin = {
      manifest: { id: 'pandocit' },
      app: {
        vault: {
          adapter: mockAdapter,
        },
      },
    } as unknown as ReferenceList;

    const expectedPath = getPandocWasmPath(mockPlugin);

    await expect(instantiateWasm(mockPlugin)).rejects.toThrow(
      `Failed to read pandoc.wasm from "${expectedPath}": ENOENT: no such file or directory`
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws an explicit error indicating the attempted path when WebAssembly.instantiate fails', async () => {
    const mockAdapter = {
      readBinary: jest.fn().mockResolvedValue(dummyWasmBytes.buffer),
    };

    const mockPlugin = {
      manifest: { id: 'pandocit' },
      app: {
        vault: {
          adapter: mockAdapter,
        },
      },
    } as unknown as ReferenceList;

    jest
      .spyOn(WebAssembly, 'instantiate')
      .mockRejectedValueOnce(new Error('Invalid WASM magic number'));

    const expectedPath = getPandocWasmPath(mockPlugin);

    await expect(instantiateWasm(mockPlugin)).rejects.toThrow(
      `Failed to instantiate pandoc.wasm from "${expectedPath}": Invalid WASM magic number`
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not include "quiet" in pandoc options for CSL JSON conversion', async () => {
    let capturedOptions: Record<string, unknown> | null = null;

    const memory = new WebAssembly.Memory({ initial: 1 });
    let memOffset = 1024;

    const mockAdapter = {
      readBinary: jest.fn().mockResolvedValue(dummyWasmBytes.buffer),
    };

    const mockPlugin = {
      manifest: { id: 'pandocit' },
      app: {
        vault: {
          adapter: mockAdapter,
        },
      },
    } as unknown as ReferenceList;

    const mockExports = {
      memory,
      malloc: jest.fn((size: number) => {
        const ptr = memOffset;
        memOffset += size + 8;
        return ptr;
      }),
      __wasm_call_ctors: jest.fn(),
      hs_init_with_rtsopts: jest.fn(),
      convert: jest.fn((optsPtr: number, optsLen: number) => {
        const bytes = new Uint8Array(memory.buffer, optsPtr, optsLen);
        const jsonStr = new TextDecoder().decode(bytes);
        capturedOptions = JSON.parse(jsonStr);
      }),
    };

    jest.spyOn(WebAssembly, 'instantiate').mockResolvedValueOnce({
      instance: {
        exports: mockExports,
      } as unknown as WebAssembly.Instance,
      module: {} as unknown as WebAssembly.Module,
    });

    await pandocConvertToCslJson('test.bib', '@article{doe2023}', mockPlugin);

    expect(capturedOptions).toBeDefined();
    expect(capturedOptions).not.toHaveProperty('quiet');
    expect(capturedOptions).toEqual({
      'input-files': ['test.bib'],
      'output-file': null,
      to: 'csljson',
    });
  });
});
