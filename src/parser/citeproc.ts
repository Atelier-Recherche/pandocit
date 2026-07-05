import { Citation, CitationGroup, RenderedCitation } from './parser';

export type CiteMode = 'suppress-author' | 'composite' | 'author-only';
export interface CiteProps {
  noteIndex: number;
  mode?: CiteMode;
  infix?: string;
  makeOnly?: boolean;
}

export interface CiteprocCite {
  citationID: string;
  citationItems: Citation[];
  properties: CiteProps;
}

function genUid(length: number): string {
  const array = [];
  for (let i = 0; i < length; i++) {
    array.push(((Math.random() * 16) | 0).toString(16));
  }
  return `${Date.now()}-${array.join('')}`;
}

export function getCiteprocCites(
  groups: CitationGroup[],
  style: 'note' | 'in-text',
  ids: string[] = []
) {
  const output: CiteprocCite[] = [];
  const idToGroup: Record<string, number> = {};
  let noteIndex = 1;

  groups.forEach((group, gIdx) => {
    let mode: CiteMode;
    let infix: string;
    const id = ids[gIdx] ?? genUid(6);
    const citationItems: Citation[] = [];

    const pushMakeAuthorOnly = (cite: Citation, i: number) => {
      const cid = id + i.toString();
      idToGroup[cid] = gIdx;
      output.push({
        citationID: cid,
        citationItems: [
          {
            ...cite,
            ['author-only']: true,
          },
        ],
        properties: {
          noteIndex: 0,
          makeOnly: true,
        },
      });
    };

    const transferProps = (from: Citation, to: Citation) => {
      if (from.label) to.label = from.label;
      if (from.locator) to.locator = from.locator;
      if (from.prefix) to.prefix = from.prefix;
      if (from.suffix) to.suffix = from.suffix;
    };

    group.citations.forEach((g, i) => {
      const cite: Citation = {
        id: g.id,
      };

      const next = group.citations[i + 1];
      if (i === 0 && g.composite) {
        if (g.suffix) {
          const nextCite = {
            ...cite,
            ['suppress-author']: style !== 'note',
          };
          pushMakeAuthorOnly(cite, i);
          transferProps(g, nextCite);
          citationItems.push(nextCite);
          return;
        } else if (style === 'note' && g.composite) {
          const nextCite = {
            ...cite,
          };
          pushMakeAuthorOnly(cite, i);
          transferProps(g, nextCite);
          citationItems.push(nextCite);
          return;
        } else {
          if (g.composite) mode = 'composite';
          if (g.infix) infix = g.infix;
        }
      } else if (
        i === 0 &&
        (g['author-only'] || g.composite) &&
        next &&
        next['suppress-author']
      ) {
        pushMakeAuthorOnly(cite, i);
        return;
      } else {
        if (g['suppress-author']) cite['suppress-author'] = style !== 'note';
        else if (g['author-only']) cite['author-only'] = true;
      }

      transferProps(g, cite);
      citationItems.push(cite);
    });

    const properties: CiteProps = {
      noteIndex: noteIndex++,
    };

    if (mode) properties.mode = mode;
    if (infix) properties.infix = infix;

    idToGroup[id] = gIdx;
    output.push({
      citationID: id,
      citationItems,
      properties,
    });
  });

  return { output, idToGroup };
}

/**
 * citeproc-js échappe le texte en XML/HTML de base (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`,
 * ainsi que des références numériques `&#123;`/`&#x1F;`) tout en laissant ses propres balises de
 * mise en forme (`<i>`, `<b>`, ...) littérales. On décode donc uniquement ces entités via une
 * substitution de chaînes, sans jamais faire analyser la chaîne comme du HTML par le DOM
 * (contrairement à l'ancien tour de passe-passe `textarea.innerHTML`), afin de préserver les
 * balises de mise en forme telles quelles pour le rendu ultérieur (DOMParser côté appelant).
 */
const HTML_NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
};

function decodeHtml(str: string) {
  return str.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const code = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return HTML_NAMED_ENTITIES[entity] ?? match;
  });
}

function sanitize(val: string) {
  return decodeHtml(val.replace(/\[NO_PRINTED_FORM\] */g, ''));
}

export function cite(engine: any, group: CitationGroup[]) {
  const { output, idToGroup } = getCiteprocCites(group, engine.opt.xclass);

  const makeCites: CiteprocCite[] = [];
  const realCites: CiteprocCite[] = [];

  output.forEach((o) => {
    if (o.properties.makeOnly) {
      makeCites.push(o);
    } else {
      realCites.push(o);
    }
  });

  const bakedCites = engine.rebuildProcessorState(realCites, 'html');
  const cites: Record<string, RenderedCitation> = {};
  const makes: Record<string, RenderedCitation> = {};

  makeCites.forEach((cite) => {
    const cluster = engine.makeCitationCluster(cite.citationItems);
    const gid = idToGroup[cite.citationID];
    makes[gid] = {
      ...group[gid],
      val: sanitize(cluster),
    };
  });

  realCites.forEach((cite, i) => {
    const [id, noteIndex, str] = bakedCites[i];
    const gid = idToGroup[id];
    cites[gid] = {
      ...group[gid],
      val: sanitize(str),
      noteIndex,
    };
  });

  const out: RenderedCitation[] = [];
  const keys = Object.keys(cites);

  keys.sort();
  keys.forEach((k) => {
    const cite = cites[k];
    const isNoteStyle = engine.opt.xclass === 'note';
    if (makes[k]) {
      if (isNoteStyle) {
        cite.note = cite.val;
        cite.val = `${makes[k].val}<sup>${cite.noteIndex}</sup>`;
      } else {
        cite.val = `${makes[k].val} ${cite.val}`;
      }
    } else if (isNoteStyle) {
      cite.note = cite.val;
      cite.val = `<sup>${cite.noteIndex}</sup>`;
    }
    out.push(cite);
  });

  return out;
}
