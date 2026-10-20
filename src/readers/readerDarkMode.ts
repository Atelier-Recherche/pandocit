/** Invert contenu (canvas PDF / iframe EPUB). */
export const READER_DARK_FILTER = 'invert(0.92) hue-rotate(180deg)';
const DARK_BG = '#1a1a1a';

/** Vue PDF native Obsidian ou lecteur PandoCit — jamais le shell / autres panneaux. */
export function isPdfReaderDarkTarget(
  el: HTMLElement | null | undefined
): boolean {
  if (!el) return false;
  if (el.classList.contains('pwc-shell')) return false;
  if (el.closest?.('.pwc-shell')) return false;
  if (el.classList.contains('pwc-pdf-reader')) return true;
  return !!el.querySelector(
    '.pdf-page-numbers, .pdf-container, .pdfViewer, .pdf-viewer, [data-page-number]'
  );
}

/** Styles quand on NE peut PAS inverser l’iframe (shadow closed). */
const EPUB_DARK_STYLES_NO_INVERT = `
html {
  color-scheme: dark !important;
  --theme-bg-color: ${DARK_BG} !important;
  background: ${DARK_BG} !important;
  background-color: ${DARK_BG} !important;
  color: #e8e8e8 !important;
}
body {
  background: none !important;
  background-color: transparent !important;
  color: #e8e8e8 !important;
}
body, body *:not(img):not(svg):not(video):not(canvas) {
  color: #e8e8e8 !important;
}
a, a * { color: #8ab4f8 !important; }
`;

/** Styles avec invert iframe : seulement le fond Foliate (--theme-bg-color). */
const EPUB_DARK_STYLES_WITH_INVERT = `
html {
  color-scheme: light !important;
  --theme-bg-color: #ffffff !important;
  background-color: #ffffff !important;
}
body {
  background: none !important;
}
`;

const EPUB_LIGHT_STYLES = `
html {
  color-scheme: light !important;
  --theme-bg-color: transparent !important;
  background: transparent !important;
  background-color: transparent !important;
}
body {
  background: none !important;
  color: inherit !important;
}
`;

function setBg(el: HTMLElement | null | undefined, dark: boolean): void {
  if (!el) return;
  if (dark) {
    el.style.setProperty('background', DARK_BG, 'important');
    el.style.setProperty('background-color', DARK_BG, 'important');
  } else {
    el.style.removeProperty('background');
    el.style.removeProperty('background-color');
  }
}

/** Retire un mode sombre PDF posé par erreur hors d’un lecteur PDF. */
export function clearStrayPdfReaderDarkMode(): void {
  document
    .querySelectorAll<HTMLElement>('.pwc-pdf-reader--dark')
    .forEach((el) => {
      if (isPdfReaderDarkTarget(el)) return;
      applyPdfNativeDarkMode(el, false);
    });
}

/** Applique / retire le mode sombre sur le viewer PDF Obsidian natif. */
export function applyPdfNativeDarkMode(
  container: HTMLElement | null | undefined,
  dark: boolean
): void {
  if (!container) return;
  // Ne jamais peindre le panneau PandoCit / autres vues non-PDF.
  if (dark && !isPdfReaderDarkTarget(container)) return;
  if (
    !dark &&
    !container.classList.contains('pwc-pdf-reader--dark') &&
    !isPdfReaderDarkTarget(container)
  ) {
    return;
  }

  container.toggleClass('pwc-pdf-reader--dark', dark);

  let pdfRoots = [
    container,
    ...Array.from(
      container.querySelectorAll<HTMLElement>(
        '.pdf-container, .pdf-viewer-container, .pdf-scroll-container, .pdfViewer, .pdf-viewer, .view-content'
      )
    ),
  ];
  // En activation : ignorer le shell. En désactivation : tout nettoyer (y compris fuites).
  if (dark) {
    pdfRoots = pdfRoots.filter(
      (el) => !el.classList.contains('pwc-shell') && !el.closest('.pwc-shell')
    );
  }

  for (const el of pdfRoots) {
    if (dark) {
      el.style.setProperty('--pdf-background', DARK_BG, 'important');
      el.style.setProperty('--pdf-page-background', DARK_BG, 'important');
      el.style.setProperty('--pdf-sidebar-background', DARK_BG, 'important');
    } else {
      el.style.removeProperty('--pdf-background');
      el.style.removeProperty('--pdf-page-background');
      el.style.removeProperty('--pdf-sidebar-background');
    }
    setBg(el, dark);
  }

  const filter = dark ? READER_DARK_FILTER : '';
  container
    .querySelectorAll<HTMLElement>(
      '.page .canvasWrapper, .pdfViewer .canvasWrapper, .thumbnailImage'
    )
    .forEach((el) => {
      if (filter) el.style.setProperty('filter', filter);
      else el.style.removeProperty('filter');
    });

  const viewer =
    container.querySelector<HTMLElement>('.pdfViewer') ??
    container.querySelector<HTMLElement>('.pdf-viewer');
  if (viewer) viewer.style.removeProperty('filter');

  container
    .querySelectorAll<HTMLElement>(
      '.pwc-zotero-overlay-layer, .pwc-zotero-popup-wrapper'
    )
    .forEach((el) => {
      el.style.removeProperty('filter');
    });
}

type FoliateRenderer = HTMLElement & {
  setStyles?: (css: string | [string, string]) => void;
  getContents?: () => Array<{ index?: number; doc?: Document }>;
};

function collectShadowRoots(foliateEl: HTMLElement, renderer?: HTMLElement): ShadowRoot[] {
  const roots: ShadowRoot[] = [];
  if (foliateEl.shadowRoot) roots.push(foliateEl.shadowRoot);
  if (renderer?.shadowRoot) roots.push(renderer.shadowRoot);
  foliateEl.shadowRoot
    ?.querySelectorAll('foliate-paginator, foliate-fxl')
    .forEach((el) => {
      if (el.shadowRoot) roots.push(el.shadowRoot);
    });
  return roots;
}

/**
 * Mode sombre EPUB.
 * - Si iframes accessibles : invert iframe + fond colonnes sombre
 * - Sinon : CSS forcé (texte clair / fond sombre) sans invert
 */
export function applyFoliateDarkMode(
  foliateEl: HTMLElement | null | undefined,
  dark: boolean
): void {
  if (!foliateEl) return;

  try {
    foliateEl.setAttribute('exportparts', 'filter');
  } catch {
    //
  }

  const renderer = (foliateEl as HTMLElement & { renderer?: FoliateRenderer })
    .renderer;
  const roots = collectShadowRoots(foliateEl, renderer);

  let iframeCount = 0;
  for (const root of roots) {
    iframeCount += root.querySelectorAll('iframe').length;
  }
  const canInvertIframe = iframeCount > 0;
  const filter = dark ? READER_DARK_FILTER : '';
  const css = !dark
    ? EPUB_LIGHT_STYLES
    : canInvertIframe
      ? EPUB_DARK_STYLES_WITH_INVERT
      : EPUB_DARK_STYLES_NO_INVERT;

  try {
    renderer?.setStyles?.(dark ? [css, css] : css);
  } catch {
    try {
      renderer?.setStyles?.(css);
    } catch (e) {
      console.warn('[PandoCit EPUB] setStyles', e);
    }
  }

  setBg(foliateEl, dark);
  setBg(foliateEl.parentElement, dark);

  for (const root of roots) {
    root.querySelectorAll('iframe').forEach((el) => {
      const h = el as HTMLElement;
      if (dark && canInvertIframe) h.style.setProperty('filter', filter);
      else h.style.removeProperty('filter');
    });

    const bg = root.getElementById('background');
    if (bg) {
      // Avec invert iframe : fond blanc (→ sombre après invert du part filter).
      // Sans invert : fond directement sombre.
      const colBg = dark ? (canInvertIframe ? '#ffffff' : DARK_BG) : '';
      if (dark) {
        bg.style.setProperty('background', colBg, 'important');
        bg.style.setProperty('background-color', colBg, 'important');
      } else {
        bg.style.removeProperty('background');
        bg.style.removeProperty('background-color');
      }
      bg.querySelectorAll<HTMLElement>('div').forEach((col) => {
        if (dark) {
          col.style.setProperty('background', colBg, 'important');
          col.style.setProperty('background-color', colBg, 'important');
        } else {
          col.style.removeProperty('background');
          col.style.removeProperty('background-color');
        }
      });
    }
    setBg(root.getElementById('container'), dark && !canInvertIframe);
    setBg(root.getElementById('top'), dark && !canInvertIframe);
  }

  // Fallback shadow closed : invert host + contre-invert SVG overlays.
  if (dark && !canInvertIframe) {
    foliateEl.style.setProperty('filter', filter);
    const svgs: Element[] = [];
    for (const root of roots) {
      root.querySelectorAll('svg').forEach((s) => svgs.push(s));
    }
    foliateEl.querySelectorAll('svg').forEach((s) => svgs.push(s));
    for (const svg of svgs) {
      (svg as HTMLElement).style.setProperty('filter', filter);
    }
  } else {
    foliateEl.style.removeProperty('filter');
    for (const root of roots) {
      root.querySelectorAll('svg').forEach((s) => {
        (s as HTMLElement).style.removeProperty('filter');
      });
    }
  }

  const contents = renderer?.getContents?.() ?? [];
  for (const { doc } of contents) {
    if (!doc?.documentElement) continue;
    const head = doc.head ?? doc.documentElement;
    let style = doc.getElementById('pwc-epub-theme') as HTMLStyleElement | null;
    if (!style) {
      style = doc.createElement('style');
      style.id = 'pwc-epub-theme';
      head.appendChild(style);
    }
    style.textContent = css;

    if (dark && !canInvertIframe) {
      doc.documentElement.style.setProperty('--theme-bg-color', DARK_BG);
      doc.documentElement.style.setProperty('background', DARK_BG, 'important');
      doc.documentElement.style.setProperty('color', '#e8e8e8', 'important');
      if (doc.body) {
        doc.body.style.setProperty('color', '#e8e8e8', 'important');
        doc.body.style.setProperty('background', 'none', 'important');
      }
    } else {
      doc.documentElement.style.removeProperty('--theme-bg-color');
      doc.documentElement.style.removeProperty('background');
      doc.documentElement.style.removeProperty('color');
      if (doc.body) {
        doc.body.style.removeProperty('color');
        doc.body.style.removeProperty('background');
      }
    }
  }

  window.requestAnimationFrame(() => {
    try {
      renderer?.setStyles?.(dark ? [css, css] : css);
    } catch {
      //
    }
  });
}
