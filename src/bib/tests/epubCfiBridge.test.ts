import {
  cfiFromZoteroAnnotationPosition,
  shortenEpubCfi,
  zoteroPositionFromEpubCfi,
  zoteroSortIndexFromEpubCfi,
} from '../../readers/epub/epubCfiBridge';
import { epubjsCfiBaseFromFoliateCfi } from '../../readers/epub/epubCfiBridge';

const SAMPLE_CFI =
  'epubcfi(/6/4!/4/2,/1:1,/1:5)';

describe('epubCfiBridge', () => {
  it('returns raw CFI strings', () => {
    expect(cfiFromZoteroAnnotationPosition(SAMPLE_CFI)).toBe(SAMPLE_CFI);
  });

  it('parses Zotero FragmentSelector JSON (shortened CFI)', () => {
    const raw = JSON.stringify({
      type: 'FragmentSelector',
      conformsTo: 'http://www.idpf.org/epub/linking/cfi/epub-cfi.html',
      value: shortenEpubCfi(SAMPLE_CFI),
    });
    expect(cfiFromZoteroAnnotationPosition(raw)).toBe(SAMPLE_CFI);
  });

  it('serializes shortened CFI for Zotero', () => {
    const pos = zoteroPositionFromEpubCfi(SAMPLE_CFI);
    const parsed = JSON.parse(pos) as { value: string };
    expect(parsed.value).toBe('/6/4!/4/2,/1:1,/1:5');
    expect(cfiFromZoteroAnnotationPosition(pos)).toBe(SAMPLE_CFI);
  });

  it('extracts epub.js cfi base from foliate CFI', () => {
    expect(epubjsCfiBaseFromFoliateCfi(SAMPLE_CFI)).toBe('/6/4');
  });

  it('builds Zotero EPUB sortIndex (5|8 digits)', () => {
    const idx = zoteroSortIndexFromEpubCfi(SAMPLE_CFI);
    expect(idx).toMatch(/^\d{5}\|\d{8}$/);
    expect(idx).toBe('00004|00000001');
  });

  it('sortIndex from long range CFI', () => {
    const idx = zoteroSortIndexFromEpubCfi(
      'epubcfi(/6/14!/4/2/2/6/4,/5:104,/5:239)'
    );
    expect(idx).toBe('00014|00000104');
  });
});
