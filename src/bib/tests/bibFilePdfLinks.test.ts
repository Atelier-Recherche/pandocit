import {
  extractFileFieldsFromBibEntry,
  parseBibTeXFilePaths,
  splitBibFileFieldValue,
} from '../bibFilePdfLinks';

describe('splitBibFileFieldValue', () => {
  it('keeps a single Windows path with spaces', () => {
    expect(
      splitBibFileFieldValue(
        'D:\\Notes\\Lectures\\Hans Blumenberg\\arbeit-am-mythos de.pdf'
      )
    ).toEqual(['D:\\Notes\\Lectures\\Hans Blumenberg\\arbeit-am-mythos de.pdf']);
  });

  it('splits multiple drive-letter paths', () => {
    expect(
      splitBibFileFieldValue('D:\\a.pdf:D:\\b.pdf')
    ).toEqual(['D:\\a.pdf', 'D:\\b.pdf']);
  });
});

describe('parseBibTeXFilePaths', () => {
  it('maps citekey to file path from BBT-style entry', () => {
    const bib = `
@book{blumenbergAM,
  title = {Arbeit am Mythos},
  file = {D:\\Notes\\Lectures\\Hans Blumenberg\\arbeit-am-mythos de.pdf}
}`;
    const map = parseBibTeXFilePaths(bib);
    expect(map.get('blumenbergAM')).toEqual([
      'D:\\Notes\\Lectures\\Hans Blumenberg\\arbeit-am-mythos de.pdf',
    ]);
  });

  it('ignores entries without pdf/epub', () => {
    const bib = `@misc{x, file = {D:\\readme.txt}}`;
    expect(parseBibTeXFilePaths(bib).size).toBe(0);
  });
});

describe('extractFileFieldsFromBibEntry', () => {
  it('reads quoted file field', () => {
    const block = `@article{a, file = "C:/vault/paper.pdf"}`;
    expect(extractFileFieldsFromBibEntry(block)).toEqual(['C:/vault/paper.pdf']);
  });
});
