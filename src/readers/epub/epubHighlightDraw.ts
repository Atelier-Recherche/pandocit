/** Dessin SVG des surlignages EPUB (équivalent à foliate Overlayer.highlight, bundlé dans main.js). */
export type EpubOverlayRect = {
  left: number;
  top: number;
  height: number;
  width: number;
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export function epubHighlightDraw(
  rects: EpubOverlayRect[],
  options: { color?: string; padding?: number } = {}
): SVGGElement {
  const { color = '#ffd400', padding = 0 } = options;
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('fill', color);
  g.style.opacity = '0.35';
  g.style.mixBlendMode = 'multiply';

  for (const { left, top, height, width } of rects) {
    const el = document.createElementNS(SVG_NS, 'rect');
    el.setAttribute('x', String(left - padding));
    el.setAttribute('y', String(top - padding));
    el.setAttribute('height', String(height + padding * 2));
    el.setAttribute('width', String(width + padding * 2));
    g.appendChild(el);
  }
  return g;
}
