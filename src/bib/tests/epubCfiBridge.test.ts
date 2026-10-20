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

  it('serializes CFI for Zotero with epubcfi() wrapper, no ID assertions', () => {
    const pos = zoteroPositionFromEpubCfi(
      'epubcfi(/6/8[couv]!/4/2/4/2,/1:0,/1:53)'
    );
    const parsed = JSON.parse(pos) as { value: string };
    expect(parsed.value).toBe('epubcfi(/6/8!/4/2/4/2,/1:0,/1:53)');
    expect(cfiFromZoteroAnnotationPosition(pos)).toBe(
      'epubcfi(/6/8!/4/2/4/2,/1:0,/1:53)'
    );
  });

  it('extracts epub.js cfi base from foliate CFI', () => {
    expect(epubjsCfiBaseFromFoliateCfi(SAMPLE_CFI)).toBe('/6/4');
  });

  it('builds Zotero EPUB sortIndex from section index (not /6/N)', () => {
    // /6/4 → sectionIndex 1
    const idx = zoteroSortIndexFromEpubCfi(SAMPLE_CFI);
    expect(idx).toMatch(/^\d{5}\|\d{8}$/);
    expect(idx).toBe('00001|00000001');
  });

  it('sortIndex from long range CFI', () => {
    // /6/14 → sectionIndex 6
    const idx = zoteroSortIndexFromEpubCfi(
      'epubcfi(/6/14!/4/2/2/6/4,/5:104,/5:239)'
    );
    expect(idx).toBe('00006|00000104');
  });

  it('sortIndex ignores CFI ID assertions', () => {
    // /6/6[couv] → sectionIndex 2 (comme les annotations Zotero mobile page 3)
    expect(
      zoteroSortIndexFromEpubCfi('epubcfi(/6/6[couv]!/4/2/4,/1:0,/1:18)')
    ).toBe('00002|00000000');
  });

  it('strips CFI ID assertions from Zotero FragmentSelector', () => {
    const raw = JSON.stringify({
      type: 'FragmentSelector',
      conformsTo: 'http://www.idpf.org/epub/linking/cfi/epub-cfi.html',
      value: '/6/8[couv]!/4/2/2/6,/1:15,/1:36',
    });
    expect(cfiFromZoteroAnnotationPosition(raw)).toBe(
      'epubcfi(/6/8!/4/2/2/6,/1:15,/1:36)'
    );
  });
});
