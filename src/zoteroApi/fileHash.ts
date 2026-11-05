import { desktopRequire } from '../platformAdapter';

type CryptoLike = {
  createHash: (algo: string) => {
    update: (data: Uint8Array) => { digest: (enc: 'hex') => string };
  };
};

/** MD5 hex pour l’API d’upload Zotero (desktop / Electron). */
export function md5Hex(bytes: Uint8Array): string {
  const crypto = desktopRequire<CryptoLike>('crypto');
  if (!crypto) return '';
  try {
    return crypto.createHash('md5').update(bytes).digest('hex');
  } catch {
    return '';
  }
}

export function fileMtimeMs(file: { stat: { mtime: number } }): number {
  return Math.round(file.stat.mtime);
}
