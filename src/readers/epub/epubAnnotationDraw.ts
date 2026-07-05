import type { PdfHighlightStyle } from '../pdf/pdfHighlightPrefs';
import type { EpubOverlayRect } from './epubHighlightDraw';

const SVG_NS = 'http://www.w3.org/2000/svg';

function highlightGroup(
  rects: EpubOverlayRect[],
  color: string,
  opacity: number,
  padding = 0
): SVGGElement {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('fill', color);
  g.setCssStyles({ opacity: String(opacity), mixBlendMode: 'multiply' });
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

function underlineGroup(rects: EpubOverlayRect[], color: string): SVGGElement {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('fill', color);
  const strokeWidth = 2;
  for (const { left, bottom, width } of rects) {
    const el = document.createElementNS(SVG_NS, 'rect');
    el.setAttribute('x', String(left));
    el.setAttribute('y', String(bottom - strokeWidth / 2));
    el.setAttribute('height', String(strokeWidth));
    el.setAttribute('width', String(width));
    g.appendChild(el);
  }
  return g;
}

function strikeoutGroup(rects: EpubOverlayRect[], color: string): SVGGElement {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('fill', color);
  const strokeWidth = 2;
  for (const { left, top, bottom, width } of rects) {
    const el = document.createElementNS(SVG_NS, 'rect');
    el.setAttribute('x', String(left));
    el.setAttribute('y', String((top + bottom) / 2));
    el.setAttribute('height', String(strokeWidth));
    el.setAttribute('width', String(width));
    g.appendChild(el);
  }
  return g;
}

function squigglyGroup(rects: EpubOverlayRect[], color: string): SVGGElement {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('fill', 'none');
  g.setAttribute('stroke', color);
  g.setAttribute('stroke-width', '2');
  const block = 3;
  for (const { left, bottom, width } of rects) {
    const el = document.createElementNS(SVG_NS, 'path');
    const n = Math.max(2, Math.round(width / block / 1.5));
    const inline = width / n;
    const ls = Array.from({ length: n }, (_, i) =>
      `l${inline} ${i % 2 ? block : -block}`
    ).join('');
    el.setAttribute('d', `M${left} ${bottom + 1}${ls}`);
    g.appendChild(el);
  }
  return g;
}

export function epubAnnotationDraw(
  rects: EpubOverlayRect[],
  options: { color?: string; opacity?: number; style?: PdfHighlightStyle } = {}
): SVGGElement {
  const {
    color = '#ffd400',
    opacity = 0.35,
    style = 'highlight',
  } = options;
  switch (style) {
    case 'underline':
      return underlineGroup(rects, color);
    case 'strikeout':
      return strikeoutGroup(rects, color);
    case 'squiggly':
      return squigglyGroup(rects, color);
    default:
      return highlightGroup(rects, color, opacity);
  }
}
