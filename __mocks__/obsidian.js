/** Stub Jest pour le package `obsidian` (types only, main vide). */

/** Équivalent Node de `requestUrl` : suit les redirections, lève si status >= 400 (sauf `throw: false`). */
function nodeRequest({ url, method = 'GET', headers = {}, body }, redirects = 5) {
  const mod = url.startsWith('https:') ? require('https') : require('http');
  return new Promise((resolve, reject) => {
    const req = mod.request(url, { method, headers }, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location &&
        redirects > 0
      ) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        resolve(nodeRequest({ url: next, method, headers, body }, redirects - 1));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('error', reject);
      res.on('end', () =>
        resolve({ status: res.statusCode, buf: Buffer.concat(chunks) })
      );
    });
    req.on('error', reject);
    if (body != null) req.write(body);
    req.end();
  });
}

module.exports = {
  Platform: { isDesktop: true, isMobile: false },
  requestUrl: async (req) => {
    const opts = typeof req === 'string' ? { url: req } : req;
    const { status, buf } = await nodeRequest(opts);
    if (opts.throw !== false && status >= 400) {
      throw new Error(`Request failed, status ${status}`);
    }
    const text = buf.toString('utf8');
    return {
      status,
      text,
      json: (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })(),
      arrayBuffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    };
  },
  Notice: class Notice {},
  Modal: class Modal {},
  Plugin: class Plugin {},
  PluginSettingTab: class PluginSettingTab {},
  Setting: class Setting {},
  TFile: class TFile {},
  TFolder: class TFolder {},
  MarkdownView: class MarkdownView {},
  normalizePath: (p) => p,
  setIcon: () => {},
  debounce: (fn) => fn,
  htmlToMarkdown: (s) => s,
};
