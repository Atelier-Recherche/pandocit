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

const SHADOW_DARK_STYLE_ID = 'pwc-epub-shadow-theme';

function setReaderDarkBg(
  el: HTMLElement | null | undefined,
  dark: boolean
): void {
  if (!el) return;
  el.toggleClass('pwc-reader-dark-bg', dark);
}

function ensureShadowThemeStyle(
  root: ShadowRoot,
  css: string | null
): void {
  let style = root.getElementById(
    SHADOW_DARK_STYLE_ID
  ) as HTMLStyleElement | null;
  if (!css) {
    style?.remove();
    return;
  }
  if (!style) {
    style = root.ownerDocument.createElement('style');
    style.id = SHADOW_DARK_STYLE_ID;
    root.appendChild(style);
  }
  style.textContent = css;
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
    setReaderDarkBg(el, dark);
  }
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

  setReaderDarkBg(foliateEl, dark);
  setReaderDarkBg(foliateEl.parentElement, dark);
  foliateEl.toggleClass('pwc-epub-host--dark-invert', dark && !canInvertIframe);
  foliateEl.toggleClass(
    'pwc-epub-host--dark-iframe',
    dark && canInvertIframe
  );

  for (const root of roots) {
    const colBg = dark ? (canInvertIframe ? '#ffffff' : DARK_BG) : null;
    const shadowCss = dark
      ? `
iframe { filter: ${canInvertIframe ? READER_DARK_FILTER : 'none'}; }
#background, #background > div {
  background: ${colBg} !important;
  background-color: ${colBg} !important;
}
#container, #top {
  ${!canInvertIframe ? `background: ${DARK_BG} !important; background-color: ${DARK_BG} !important;` : ''}
}
svg { filter: ${!canInvertIframe ? READER_DARK_FILTER : 'none'}; }
`
      : null;
    ensureShadowThemeStyle(root, shadowCss);

    root.querySelectorAll('iframe').forEach((el) => {
      (el as HTMLElement).toggleClass(
        'pwc-epub-iframe--dark',
        dark && canInvertIframe
      );
    });

    setReaderDarkBg(
      root.getElementById('container') as HTMLElement | null,
      dark && !canInvertIframe
    );
    setReaderDarkBg(
      root.getElementById('top') as HTMLElement | null,
      dark && !canInvertIframe
    );
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
  }

  window.requestAnimationFrame(() => {
    try {
      renderer?.setStyles?.(dark ? [css, css] : css);
    } catch {
      //
    }
  });
}
