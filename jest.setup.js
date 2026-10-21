/** Polyfills pour jsdom / WASI (pandoc.wasm). */
const { TextEncoder, TextDecoder } = require('util');
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = async function arrayBuffer() {
    const buf = await new Response(this).arrayBuffer();
    return buf;
  };
}
if (typeof Blob !== 'undefined' && typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = async function text() {
    return new Response(this).text();
  };
}
