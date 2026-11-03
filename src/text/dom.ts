import { normalizeText, type NodeText, type TextPart } from './model.ts';
export const TEXT_CLIPBOARD = 'application/x-omnium-node-text';
export const escapeHTML = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** Only our object references and plain text enter storage; pasted HTML is never trusted. */
export function readTextDOM(root: Node): NodeText {
  const parts: TextPart[] = [];
  const newline = () => { if (parts.length && !String(parts.at(-1)).endsWith('\n')) parts.push('\n'); };
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) { parts.push(node.textContent ?? ''); return; }
    if (!(node instanceof Element)) { node.childNodes.forEach(walk); return; }
    const glyph = node.getAttribute('data-node-glyph');
    if (glyph) { parts.push({ glyph }); return; }
    if (node.tagName === 'BR') { parts.push('\n'); return; }
    const block = /^(DIV|P|LI|PRE|H[1-6])$/.test(node.tagName);
    if (block) newline();
    node.childNodes.forEach(walk);
    if (block && node.nextSibling) newline();
  };
  root.childNodes.forEach(walk);
  return normalizeText(parts);
}
export function textHTML(text: NodeText, glyphHTML: (id: string) => string): string {
  return text.content.map(part => typeof part === 'string' ? escapeHTML(part) : glyphHTML(part.glyph)).join('');
}
