import {markdownHTML,listSourcePrefix} from './markdown.ts';
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
    if (node.tagName === 'BR') {
      if(node.parentElement?.tagName==='LI'&&node.parentElement.childNodes.length===1)return;
      parts.push('\n');const li=node.closest('li');
      if(li&&!node.hasAttribute('data-node-md-continuation')){let depth=0;for(let parent:Element|null=li.parentElement;parent&&parent!==root;parent=parent.parentElement)if(parent.tagName==='OL'||parent.tagName==='UL')depth++;parts.push('    '.repeat(depth));}return;
    }
    if(node.tagName==='LI'){
      const parent=node.parentElement,ordered=parent?.tagName==='OL',items=parent?Array.from(parent.children).filter(child=>child.tagName==='LI'):[],index=items.indexOf(node);let depth=-1;
      for(let cursor:Element|null=node.parentElement;cursor&&cursor!==root;cursor=cursor.parentElement)if(cursor.tagName==='OL'||cursor.tagName==='UL')depth++;
      const prefix=index<0?node.getAttribute('data-node-md-open')??'- ':listSourcePrefix({source:node.getAttribute('data-node-md-open'),index,originalIndex:Number(node.getAttribute('data-node-md-index')??NaN),depth:Math.max(0,depth),originalDepth:Number(node.getAttribute('data-node-md-depth')??NaN),start:Number(parent?.getAttribute('start')??1),ordered});
      newline();parts.push(prefix);node.childNodes.forEach(walk);if(node.nextSibling)newline();return;
    }
    if(node.tagName==='OL'||node.tagName==='UL'){newline();node.childNodes.forEach(walk);if(node.nextSibling)newline();return;}
    const nativeMark=({B:'**',STRONG:'**',I:'*',EM:'*',S:'~~',STRIKE:'~~',DEL:'~~'} as Record<string,string>)[node.tagName];
    if(nativeMark&&!node.hasAttribute('data-node-md-open')){parts.push(nativeMark);node.childNodes.forEach(walk);parts.push(nativeMark);return;}
    const open=node.getAttribute('data-node-md-open'),close=node.getAttribute('data-node-md-close');
    if(open!==null){
      // Native formatting removes semantic tags but can retain our source attrs
      // on a plain span. Do not resurrect a style the user explicitly turned off.
      const removed=(open==='**'||open==='__')&&!/^(B|STRONG)$/.test(node.tagName)||(open==='*'||open==='_')&&!/^(I|EM)$/.test(node.tagName)||open==='~~'&&!/^(S|STRIKE|DEL)$/.test(node.tagName);
      if(!removed)parts.push(open);node.childNodes.forEach(walk);if(!removed)parts.push(close??'');return;
    }
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
