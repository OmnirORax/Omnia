import {markdownHTML} from './markdown.ts';
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
    if(node.hasAttribute('data-node-caret'))return;
    const glyph = node.getAttribute('data-node-glyph');
    if (glyph) { const word=node.getAttribute('data-node-word');parts.push({glyph,...(node.hasAttribute('data-node-detached')?{word:null}:word!==null?{word}:{})});return; }
    if (node.tagName === 'BR') { parts.push('\n'); return; }
    const open=node.getAttribute('data-node-md-open'),close=node.getAttribute('data-node-md-close');
    if(open!==null){parts.push(open);node.childNodes.forEach(walk);parts.push(close??'');return;}
    const block = /^(DIV|P|LI|PRE|H[1-6])$/.test(node.tagName);
    if (block) newline();
    node.childNodes.forEach(walk);
    if (block && node.nextSibling) newline();
  };
  root.childNodes.forEach(walk);
  return normalizeText(parts);
}
export function textHTML(text: NodeText, glyphHTML: (id: string) => string): string {
  return markdownHTML(text,part=>glyphHTML(part.glyph).replace('<span ',part.word===null?'<span data-node-detached="true" ':part.word!==undefined?`<span data-node-word="${escapeHTML(part.word)}" `:'<span '));
}
