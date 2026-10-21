/** Stub Jest pour le package `obsidian` (types only, main vide). */
module.exports = {
  Platform: { isDesktop: true, isMobile: false },
  requestUrl: async ({ url }) => {
    const res = await fetch(url);
    const text = await res.text();
    return {
      status: res.status,
      text,
      json: (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })(),
      arrayBuffer: async () => new TextEncoder().encode(text).buffer,
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
