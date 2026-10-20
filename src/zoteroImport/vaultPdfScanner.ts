import { TFile, TFolder } from 'obsidian';

import type ReferenceList from '../main';
import { getVaultPdfImportSettings, shouldExcludeVaultPath } from './importExclusions';
import { parsePdfMetadataFromPath } from './metadataParser';
import { suggestCitekey } from './citekeySuggest';
import { countPdfPages } from './pdfPageCount';
import type { VaultPdfImportRow, VaultPdfImportScanResult } from './types';
import { findZoteroAttachmentKeyForVaultFile } from '../readers/pdf/zoteroAttachmentMatch';

function normalizeExtList(exts: string[]): Set<string> {
  const out = new Set<string>();
  for (const e of exts) {
    const x = (e.startsWith('.') ? e.slice(1) : e).toLowerCase();
    if (x) out.add(x);
  }
  return out;
}

function collectImportFiles(
  folder: TFolder,
  allowedExt: Set<string>,
  out: TFile[]
): void {
  for (const child of folder.children) {
    if (child instanceof TFolder) {
      collectImportFiles(child, allowedExt, out);
    } else if (
      child instanceof TFile &&
      allowedExt.has(child.extension.toLowerCase())
    ) {
      out.push(child);
    }
  }
}

export async function scanVaultFolderForPdfImport(
  plugin: ReferenceList,
  folderPath: string,
  onProgress?: (done: number, total: number) => void
): Promise<VaultPdfImportScanResult> {
  const folder = plugin.app.vault.getAbstractFileByPath(folderPath);
  if (!(folder instanceof TFolder)) {
    return { rows: [], excludedCount: 0, folderPath };
  }

  const rules = getVaultPdfImportSettings(plugin.settings.vaultPdfImport);
  const allowedExt = normalizeExtList(rules.includeExtensions);
  const raw: TFile[] = [];
  collectImportFiles(folder, allowedExt, raw);

  const candidates: TFile[] = [];
  let excludedCount = 0;
  for (const f of raw) {
    if (shouldExcludeVaultPath(f.path, rules)) {
      excludedCount++;
      continue;
    }
    candidates.push(f);
  }

  const rows: VaultPdfImportRow[] = [];
  const total = candidates.length;
  let done = 0;

  for (const file of candidates) {
    onProgress?.(done, total);
    const kind = file.extension.toLowerCase();
    try {
      let pageCount = 0;
      if (kind === 'pdf') {
        const bytes = await plugin.app.vault.readBinary(file);
        pageCount = await countPdfPages(plugin, bytes);
      }
      const meta = parsePdfMetadataFromPath(file.path, rules.metadataRegex);
      const existingKey = plugin.settings.pullFromZoteroApi
        ? await findZoteroAttachmentKeyForVaultFile(plugin, file, {
            fresh: true,
          })
        : undefined;
      const status = existingKey ? 'duplicate' : 'new';
      const citekey = suggestCitekey(
        meta.author,
        meta.title,
        file.stat.mtime,
        meta.citekey
      );
      rows.push({
        file,
        vaultPath: file.path,
        kind,
        pageCount,
        title: meta.title,
        author: meta.author,
        citekey,
        selected: status === 'new',
        status,
      });
    } catch (e) {
      rows.push({
        file,
        vaultPath: file.path,
        kind,
        pageCount: 0,
        title: file.basename,
        author: '',
        citekey: '',
        selected: false,
        status: 'error',
        errorMessage: String((e as Error)?.message ?? e),
      });
    }
    done++;
    onProgress?.(done, total);
  }

  return { rows, excludedCount, folderPath };
}
