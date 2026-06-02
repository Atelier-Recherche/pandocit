import type { DocumentAnnotation } from '../../annotations/types';
import type { ZoteroStoreSnapshot } from '../../zoteroApi/types';
import type ReferenceList from '../../main';
import {
  colorToZoteroHex,
  zoteroAnnotationTypeFromStyle,
  zoteroAnnotationTypeToMarkupStyle,
} from '../pdf/pdfAnnotationBridge';
import { annotationBelongsToAttachment } from '../pdf/zoteroAttachmentMatch';
import {
  cfiFromZoteroAnnotationPosition,
  lengthenEpubCfi,
  normalizeEpubHighlightColor,
  shortenEpubCfi,
  zoteroPositionFromCfiValue,
  zoteroSortIndexFromEpubCfi,
} from './epubCfiBridge';
import { sectionIndexFromEpubCfi } from './epubZoteroPosition';

export function zoteroAnnotationsForEpubAttachment(
  snap: ZoteroStoreSnapshot,
  attachmentKey: string
): DocumentAnnotation[] {
  const out: DocumentAnnotation[] = [];
  for (const st of Object.values(snap.items)) {
    if (String(st.data.itemType ?? '').toLowerCase() !== 'annotation') continue;
    const d = st.data as Record<string, unknown>;
    if (
      !annotationBelongsToAttachment(
        snap,
        String(d.parentItem ?? ''),
        attachmentKey
      )
    ) {
      continue;
    }
    const rawPos = String(d.annotationPosition ?? '');
    const cfi = cfiFromZoteroAnnotationPosition(rawPos);
    if (!cfi) continue;
    let zoteroCfiShort: string | undefined;
    try {
      const parsed = JSON.parse(rawPos) as { value?: string };
      if (typeof parsed.value === 'string') {
        zoteroCfiShort = shortenEpubCfi(parsed.value);
      }
    } catch {
      zoteroCfiShort = shortenEpubCfi(cfi);
    }
    out.push({
      id: `zotero-${st.key}`,
      source: 'zotero',
      text: String(d.annotationText ?? ''),
      comment: String(d.annotationComment ?? ''),
      color: normalizeEpubHighlightColor(String(d.annotationColor ?? '')),
      cfi,
      zoteroCfi: zoteroCfiShort,
      zoteroSortIndex: String(d.annotationSortIndex ?? ''),
      sectionIndex: sectionIndexFromEpubCfi(cfi),
      zoteroKey: st.key,
      markupStyle: zoteroAnnotationTypeToMarkupStyle(
        String(d.annotationType ?? 'highlight')
      ),
    });
  }
  return out;
}

export async function pushEpubAnnotationToZotero(
  plugin: ReferenceList,
  attachmentKey: string,
  ann: DocumentAnnotation
): Promise<{ ok: boolean; error?: string; key?: string }> {
  if (!plugin.settings.pullFromZoteroApi) {
    return { ok: false, error: 'zotero_api_disabled' };
  }
  const cfi = ann.cfi?.trim();
  if (!cfi) return { ok: false, error: 'missing_cfi' };

  const zoteroCfiValue = ann.zoteroCfi?.trim() || null;
  if (!zoteroCfiValue) {
    return {
      ok: false,
      error: 'missing_zotero_cfi',
    };
  }
  const position = zoteroPositionFromCfiValue(zoteroCfiValue);
  const sortIndex =
    ann.zoteroSortIndex?.trim() ||
    zoteroSortIndexFromEpubCfi(lengthenEpubCfi(zoteroCfiValue));

  const res = await plugin.zoteroSync.createAnnotation(attachmentKey, {
    annotationType: zoteroAnnotationTypeFromStyle(ann.markupStyle ?? 'highlight'),
    annotationText: ann.text,
    annotationComment: ann.comment,
    annotationColor: colorToZoteroHex(ann.color ?? '#ffd400'),
    annotationSortIndex: sortIndex,
    annotationPosition: position,
  });
  if (res.ok) await plugin.zoteroSync.sync();
  return res;
}
