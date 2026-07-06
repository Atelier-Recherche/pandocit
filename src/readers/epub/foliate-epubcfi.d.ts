declare module '../../../foliate/epubcfi.js' {
  export function fromRange(range: Range, filter?: unknown): string;
  export function joinIndir(...parts: string[]): string;
}

declare module '../../../foliate/view.js' {
  // side-effect : enregistre le custom element foliate-view
}
