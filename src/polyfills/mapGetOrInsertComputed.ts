/**
 * pdf.js 5.7+ uses Map.prototype.getOrInsertComputed (ES2026).
 * Obsidian/Electron may not expose it yet — polyfill before loading pdf.js.
 */
export function ensureMapGetOrInsertComputed(): void {
  const proto = Map.prototype as Map<unknown, unknown> & {
    getOrInsertComputed?: (
      key: unknown,
      callback: (key: unknown) => unknown
    ) => unknown;
  };
  if (typeof proto.getOrInsertComputed === 'function') return;
  proto.getOrInsertComputed = function getOrInsertComputed(
    this: Map<unknown, unknown>,
    key: unknown,
    callback: (key: unknown) => unknown
  ) {
    if (this.has(key)) {
      return this.get(key);
    }
    const value = callback(key);
    this.set(key, value);
    return value;
  };
}

ensureMapGetOrInsertComputed();
