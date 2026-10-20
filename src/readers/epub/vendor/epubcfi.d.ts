declare module './epubcfi.js' {
  export default class EpubCFI {
    constructor(
      cfiFrom?: string | Range | Node,
      base?: string | object,
      ignoreClass?: string
    );
    toString(): string;
  }
}
