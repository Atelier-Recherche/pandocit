import type { PdfHighlightStyle } from './pdf/pdfHighlightPrefs';

export type AnnotationBlendMode = 'multiply' | 'screen' | 'normal' | 'plus-lighter';

/** Styles d’affichage restyle (pas forcément stockés Zotero). */
export type AnnotationRestyleStyle = 'underline' | 'squiggly' | 'dotted';

export type AnnotationDisplayStyle = PdfHighlightStyle | 'dotted';

export interface AnnotationDisplayInput {
  color?: string;
  markupStyle?: PdfHighlightStyle | string;
  opacity?: number;
  restyleEnabled: boolean;
  readerDarkMode: boolean;
  /** Couleur d’affichage du restyle. */
  restyleColor?: string;
  /** Style d’affichage du restyle (ligne / vague / pointillé). */
  restyleStyle?: AnnotationRestyleStyle;
}

export interface AnnotationDisplayAppearance {
  displayColor: string;
  displayStyle: AnnotationDisplayStyle;
  blendMode: AnnotationBlendMode;
  opacity: number;
  /** true si restyle appliqué. */
  restyled: boolean;
}

const DEFAULT_COLOR = '#ffd400';
const DEFAULT_RESTYLE_COLOR = '#ffd400';
const DEFAULT_RESTYLE_STYLE: AnnotationRestyleStyle = 'squiggly';
const DEFAULT_OPACITY = 0.35;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Parse #rgb / #rrggbb / rgb() → [r,g,b] 0–255. */
export function parseCssColorRgb(
  color: string | undefined
): [number, number, number] | null {
  if (!color?.trim()) return null;
  const s = color.trim();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) {
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    }
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = s.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)$/i
  );
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  return null;
}

export function isNearBlackColor(color: string | undefined): boolean {
  const rgb = parseCssColorRgb(color);
  if (!rgb) return false;
  const [r, g, b] = rgb;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum < 0.12;
}

function normalizeStoredStyle(style?: string): PdfHighlightStyle {
  switch (String(style ?? 'highlight').toLowerCase()) {
    case 'underline':
      return 'underline';
    case 'strikeout':
    case 'strikethrough':
      return 'strikeout';
    case 'squiggly':
      return 'squiggly';
    default:
      return 'highlight';
  }
}

export function normalizeRestyleStyle(
  style?: string
): AnnotationRestyleStyle {
  switch (String(style ?? '').toLowerCase()) {
    case 'underline':
      return 'underline';
    case 'dotted':
      return 'dotted';
    case 'squiggly':
    default:
      return 'squiggly';
  }
}

function toCssHex(color: string | undefined, fallback: string): string {
  const rgb = parseCssColorRgb(color);
  if (!rgb) {
    const s = (color ?? '').trim();
    return s.startsWith('#') ? s : fallback;
  }
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function resolveAnnotationDisplayAppearance(
  input: AnnotationDisplayInput
): AnnotationDisplayAppearance {
  const storedStyle = normalizeStoredStyle(input.markupStyle);
  const restyleColor = toCssHex(input.restyleColor, DEFAULT_RESTYLE_COLOR);
  const restyleStyle = normalizeRestyleStyle(
    input.restyleStyle ?? DEFAULT_RESTYLE_STYLE
  );

  let displayColor = toCssHex(input.color, DEFAULT_COLOR);
  let displayStyle: AnnotationDisplayStyle = storedStyle;
  let restyled = false;

  if (input.restyleEnabled) {
    // Restyle actif → style + couleur de restyle pour toutes les annotations.
    displayColor = restyleColor;
    displayStyle = restyleStyle;
    restyled = true;
    // En mode sombre, un restyle noir (#000) est illisible → inverser en blanc.
    if (input.readerDarkMode && isNearBlackColor(displayColor)) {
      displayColor = '#ffffff';
    }
  }
  // Restyle off : couleurs / styles stockés tels quels (pas de remap jaune).

  let opacity = clamp01(
    typeof input.opacity === 'number' ? input.opacity : DEFAULT_OPACITY
  );
  let blendMode: AnnotationBlendMode = 'multiply';

  if (displayStyle !== 'highlight') {
    blendMode = 'normal';
    opacity = Math.max(opacity, 0.95);
  } else if (input.readerDarkMode) {
    blendMode = 'normal';
    opacity = Math.max(opacity, 0.5);
  }

  return {
    displayColor,
    displayStyle,
    blendMode,
    opacity,
    restyled,
  };
}

/** SVG data-URI pour vague PDF, stroke = couleur d’affichage. */
export function squigglyBackgroundImage(displayColor: string): string {
  const stroke = encodeURIComponent(displayColor || DEFAULT_COLOR);
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M0 3 Q2 0 4 3 T8 3' fill='none' stroke='${stroke}' stroke-width='1.2'/%3E%3C/svg%3E")`;
}

/** SVG data-URI pour pointillé PDF. */
export function dottedBackgroundImage(displayColor: string): string {
  const stroke = encodeURIComponent(displayColor || DEFAULT_COLOR);
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='4' viewBox='0 0 6 4'%3E%3Ccircle cx='1.5' cy='3' r='1' fill='${stroke}'/%3E%3C/svg%3E")`;
}
