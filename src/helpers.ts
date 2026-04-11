import { FileSystemAdapter, Platform, htmlToMarkdown } from 'obsidian';

export function getVaultRoot(): string {
  if (!Platform.isDesktop) return '';
  try {
    return (app.vault.adapter as FileSystemAdapter).getBasePath();
  } catch {
    return '';
  }
}

export function copyElToClipboard(el: HTMLElement) {
  const html = el.outerHTML;
  const text = htmlToMarkdown(el.outerHTML);

  if (Platform.isDesktop) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { clipboard } = require('electron');
      clipboard.write({ html, text });
      return;
    } catch (e) {
      console.error('Failed to access electron clipboard', e);
    }
  }

  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch((e) => {
      console.error('Failed to write to clipboard', e);
    });
  }
}

export class PromiseCapability<T> {
  settled = false;
  promise: Promise<T>;
  resolve: (data: T) => void;
  reject: (reason?: any) => void;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = (data) => {
        resolve(data);
        this.settled = true;
      };

      this.reject = (reason) => {
        reject(reason);
        this.settled = true;
      };
    });
  }
}

export function areSetsEqual<T>(as: Set<T>, bs: Set<T>) {
  if (as.size !== bs.size) return false;
  for (const a of as) if (!bs.has(a)) return false;
  return true;
}
