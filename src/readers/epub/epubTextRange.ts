/** Recherche de plage DOM par texte (espaces normalisés). */

export function normalizeWs(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

function mapNormalizedOffsetToRaw(raw: string, normalizedOffset: number): number {
  let ni = 0;
  let ri = 0;
  while (ri < raw.length && ni < normalizedOffset) {
    if (/\s/.test(raw[ri])) {
      if (ri === 0 || !/\s/.test(raw[ri - 1])) ni++;
      ri++;
      continue;
    }
    ni++;
    ri++;
  }
  while (ri < raw.length && /\s/.test(raw[ri])) ri++;
  return ri;
}

export function findRangeForText(doc: Document, text: string): Range | null {
  const needle = normalizeWs(text);
  if (needle.length < 2) return null;
  const root = doc.body ?? doc.documentElement;
  if (!root) return null;

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let full = '';
  const spans: { node: Text; start: number; end: number }[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const node = n as Text;
    const chunk = node.data.replace(/\s+/g, ' ');
    if (!chunk) continue;
    const start = full.length;
    full += chunk;
    spans.push({ node, start, end: full.length });
  }

  const idx = full.indexOf(needle);
  if (idx < 0) return null;
  const endIdx = idx + needle.length;

  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;

  for (const s of spans) {
    if (!startNode && s.end > idx) {
      startNode = s.node;
      startOffset = mapNormalizedOffsetToRaw(s.node.data, idx - s.start);
    }
    if (!endNode && s.end >= endIdx) {
      endNode = s.node;
      endOffset = mapNormalizedOffsetToRaw(s.node.data, endIdx - s.start);
      break;
    }
  }

  if (!startNode || !endNode) return null;
  const range = doc.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}
