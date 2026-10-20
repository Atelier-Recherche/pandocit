/**
 * Minimal stub of epubjs `utils/core` — only what EpubCFI needs.
 * Avoids bundling @xmldom/xmldom + the rest of epubjs (~hundreds of KB).
 */

export function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

export function extend(target) {
  const sources = [].slice.call(arguments, 1);
  sources.forEach(function (source) {
    if (!source) return;
    Object.getOwnPropertyNames(source).forEach(function (propName) {
      Object.defineProperty(
        target,
        propName,
        Object.getOwnPropertyDescriptor(source, propName)
      );
    });
  });
  return target;
}

export function type(obj) {
  return Object.prototype.toString.call(obj).slice(8, -1);
}

export function findChildren(el) {
  const result = [];
  const childNodes = el.childNodes;
  for (let i = 0; i < childNodes.length; i++) {
    const node = childNodes[i];
    if (node.nodeType === 1) result.push(node);
  }
  return result;
}

function parents(node) {
  const nodes = [node];
  for (; node; node = node.parentNode) {
    nodes.unshift(node);
  }
  return nodes;
}

/** Fallback Range when `document.createRange` is unavailable (not used in Obsidian). */
export class RangeObject {
  constructor() {
    this.collapsed = false;
    this.commonAncestorContainer = undefined;
    this.endContainer = undefined;
    this.endOffset = undefined;
    this.startContainer = undefined;
    this.startOffset = undefined;
  }

  setStart(startNode, startOffset) {
    this.startContainer = startNode;
    this.startOffset = startOffset;
    if (!this.endContainer) this.collapse(true);
    else {
      this.commonAncestorContainer = this._commonAncestorContainer();
    }
    this._checkCollapsed();
  }

  setEnd(endNode, endOffset) {
    this.endContainer = endNode;
    this.endOffset = endOffset;
    if (!this.startContainer) this.collapse(false);
    else {
      this.collapsed = false;
      this.commonAncestorContainer = this._commonAncestorContainer();
    }
    this._checkCollapsed();
  }

  collapse(toStart) {
    this.collapsed = true;
    if (toStart) {
      this.endContainer = this.startContainer;
      this.endOffset = this.startOffset;
      this.commonAncestorContainer = this.startContainer?.parentNode;
    } else {
      this.startContainer = this.endContainer;
      this.startOffset = this.endOffset;
      this.commonAncestorContainer = this.endContainer?.parentNode;
    }
  }

  selectNode(referenceNode) {
    const parent = referenceNode.parentNode;
    const index = Array.prototype.indexOf.call(parent.childNodes, referenceNode);
    this.setStart(parent, index);
    this.setEnd(parent, index + 1);
  }

  selectNodeContents(referenceNode) {
    const endIndex =
      referenceNode.nodeType === 3
        ? referenceNode.textContent.length
        : referenceNode.childNodes.length;
    this.setStart(referenceNode, 0);
    this.setEnd(referenceNode, endIndex);
  }

  _commonAncestorContainer(startContainer, endContainer) {
    const startParents = parents(startContainer || this.startContainer);
    const endParents = parents(endContainer || this.endContainer);
    if (startParents[0] != endParents[0]) return undefined;
    for (let i = 0; i < startParents.length; i++) {
      if (startParents[i] != endParents[i]) {
        return startParents[i - 1];
      }
    }
  }

  _checkCollapsed() {
    this.collapsed =
      this.startContainer === this.endContainer &&
      this.startOffset === this.endOffset;
  }

  toString() {
    return '';
  }
}
