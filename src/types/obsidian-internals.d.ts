import type { EditorView } from '@codemirror/view';
import type { NodeProp } from '@lezer/common';

declare global {
  interface HTMLElementTagNameMap {
    /** Élément personnalisé du lecteur EPUB foliate-js. */
    'foliate-view': HTMLElement;
  }
}

declare module '@codemirror/language' {
  /** Classes de jetons du parseur Markdown d’Obsidian (`hmd-internal-link`, …). */
  export const tokenClassNodeProp: NodeProp<string>;
}

declare module 'obsidian' {
  interface App {
    commands: {
      commands: Record<string, unknown>;
      executeCommandById(id: string): boolean;
    };
    hotkeyManager?: {
      getHotkeys?: (id: string) => Hotkey[] | undefined;
      getDefaultHotkeys?: (id: string) => Hotkey[] | undefined;
    };
  }

  interface Menu {
    addSections(sections: string[]): this;
  }

  interface PopoverSuggest<T> {
    suggestEl: HTMLElement;
    suggestions: { values?: T[]; useSelectedItem(evt: KeyboardEvent): void };
  }

  interface MarkdownPreviewView {
    renderer?: {
      lastText: string | null;
      sections: { el: HTMLElement; rendered: boolean }[];
      queueRender(): void;
    };
  }

  interface Editor {
    cm?: EditorView;
  }
}
