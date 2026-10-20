import type { DocumentAnnotation } from '../annotations/types';

export type ActiveReaderKind = 'pdf' | 'epub' | null;

export interface ActiveReaderState {
  kind: ActiveReaderKind;
  vaultPath: string;
  annotations: DocumentAnnotation[];
  zoteroAttachmentKey?: string;
  citekey?: string;
}

/**
 * Multi-document registry: one entry per open PDF/EPUB path,
 * plus an "active" path for the panel / toolbar actions.
 */
export class ReaderRegistry {
  private byPath = new Map<string, ActiveReaderState>();
  private activePath: string | null = null;
  private listeners = new Set<() => void>();

  /** Without path: active document. With path: that entry (or null). */
  get(path?: string): ActiveReaderState | null {
    if (path != null) return this.byPath.get(path) ?? null;
    if (!this.activePath) return null;
    return this.byPath.get(this.activePath) ?? null;
  }

  has(path: string): boolean {
    return this.byPath.has(path);
  }

  paths(): string[] {
    return [...this.byPath.keys()];
  }

  upsert(state: ActiveReaderState): void {
    this.byPath.set(state.vaultPath, state);
    if (!this.activePath) this.activePath = state.vaultPath;
    this.notify();
  }

  /** Remove one document; if it was active, pick another open path. */
  remove(vaultPath: string): void {
    if (!this.byPath.has(vaultPath)) return;
    this.byPath.delete(vaultPath);
    if (this.activePath === vaultPath) {
      const next = this.byPath.keys().next();
      this.activePath = next.done ? null : next.value;
    }
    this.notify();
  }

  setActive(vaultPath: string | null): void {
    if (vaultPath === this.activePath) return;
    if (vaultPath != null && !this.byPath.has(vaultPath)) return;
    this.activePath = vaultPath;
    this.notify();
  }

  updateAnnotations(
    pathOrAnnotations: string | DocumentAnnotation[],
    annotations?: DocumentAnnotation[]
  ): void {
    let path: string;
    let anns: DocumentAnnotation[];
    if (typeof pathOrAnnotations === 'string') {
      path = pathOrAnnotations;
      anns = annotations ?? [];
    } else {
      if (!this.activePath) return;
      path = this.activePath;
      anns = pathOrAnnotations;
    }
    const prev = this.byPath.get(path);
    if (!prev) return;
    this.byPath.set(path, { ...prev, annotations: anns });
    this.notify();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}

export const readerRegistry = new ReaderRegistry();
