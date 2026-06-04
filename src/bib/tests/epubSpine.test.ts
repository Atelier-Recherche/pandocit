import { epubjsChapterCfiBase } from '../../readers/epub/epubSpine';

describe('epubSpine', () => {
  it('matches epub.js chapter CFI base', () => {
    expect(epubjsChapterCfiBase(0, '')).toBe('/6/2');
    expect(epubjsChapterCfiBase(6, 'ch1')).toBe('/6/14[ch1]');
  });
});
