import { GLYPH_LIMIT, annotationPrefix, applyLexiconMatches, type AnnotationKind, type compileLexicon } from './model';
import { escapeHTML, textHTML } from './dom';
type Lexicon=ReturnType<typeof compileLexicon>;
type Point={node:Text;offset:number};
export function textPoint(node:Node|null,offset:number):Point|undefined {
  if(node?.nodeType===Node.TEXT_NODE)return {node:node as Text,offset};
  if(!node)return;
  const before=node.childNodes[Math.max(0,offset-1)],after=node.childNodes[offset];
  if(before?.nodeType===Node.TEXT_NODE)return {node:before as Text,offset:before.textContent?.length??0};
  if(after?.nodeType===Node.TEXT_NODE)return {node:after as Text,offset:0};
}
export function editableTextNodes(root:Node):Text[]{
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes:Text[]=[];
  for(let node=walker.nextNode();node;node=walker.nextNode())if(!node.parentElement?.closest('[data-node-glyph]'))nodes.push(node as Text);
  return nodes;
}
const wordChar=(text:string)=>!!text&&/[\p{L}\p{M}\p{N}'’\-]/u.test(text);
const prefixGlyph=(node:Text)=>node.previousSibling instanceof HTMLElement&&node.previousSibling.matches('span[data-node-glyph]')?node.previousSibling:undefined;
/** Apply only a bounded typing window. Automatic occurrences are linked, while
 * English deletion detaches their glyph instead of deleting the translation. */
export function annotateTextNode(root:HTMLElement,node:Text,start:number,end:number,lexicon:Lexicon,glyphHTML:(id:string)=>string,kind:AnnotationKind){
  if(!root.contains(node)||node.parentElement?.closest('[data-node-glyph]'))return false;
  const text=node.data;start=Math.max(0,Math.min(start,text.length));end=Math.max(start,Math.min(end,text.length));
  const slice=text.slice(start,end),matches=lexicon.matches(slice).filter(match=>
    !(match.start===0&&start>0&&wordChar(text[start-1]))&&!(match.end===slice.length&&end<text.length&&wordChar(text[end])));
  const previous=start===0?prefixGlyph(node):undefined;
  let removePrevious=false,skipPrefix=false,changed=false;
  if(previous){
    const source=previous.getAttribute('data-node-word');
    const decision=annotationPrefix({glyph:previous.dataset.nodeGlyph!,...(previous.hasAttribute('data-node-detached')?{word:null}:source!==null?{word:source}:{})},slice,matches.find(match=>match.start===0),kind);
    removePrevious=decision.remove;skipPrefix=decision.skip;
    if(decision.word===null){previous.removeAttribute('data-node-word');previous.setAttribute('data-node-detached','true');changed=true;}
    else if(decision.word!==undefined){previous.setAttribute('data-node-word',decision.word);changed=true;}
  }
  const additions=matches.filter(match=>!(skipPrefix&&match.start===0));
  if(!additions.length&&!removePrevious)return changed;
  const count=root.querySelectorAll('span[data-node-glyph]').length+additions.length-(removePrevious?1:0);
  if(count>GLYPH_LIMIT)throw Error('Document reached 4,000 glyphs. Split the text across nodes.');
  const selection=window.getSelection(),active=document.activeElement===root;
  const caret=selection?.isCollapsed?textPoint(selection.anchorNode,selection.anchorOffset):undefined;
  const local=caret?.node===node&&caret.offset>=start&&caret.offset<=end?caret.offset-start:undefined;
  const retained=active&&selection?.rangeCount?selection.getRangeAt(0).cloneRange():undefined;
  const marker=`node-caret-${crypto.randomUUID()}`,parts=applyLexiconMatches(slice,additions).content;
  let consumed=0,marked=false;
  const html=parts.map(part=>{
    if(typeof part!=='string')return textHTML({version:1,content:[part]},glyphHTML);
    let out=escapeHTML(part);
    if(local!==undefined&&!marked&&local<=consumed+part.length){const at=Math.max(0,local-consumed);out=escapeHTML(part.slice(0,at))+`<span data-node-caret="${marker}">\u200b</span>`+escapeHTML(part.slice(at));marked=true;}
    consumed+=part.length;return out;
  }).join('');
  const range=document.createRange();range.setStart(node,start);range.setEnd(node,end);
  if(removePrevious&&previous)range.setStartBefore(previous);
  let inserted=false;
  if(active&&selection){selection.removeAllRanges();selection.addRange(range);inserted=document.execCommand('insertHTML',false,html);}
  if(!inserted){const template=document.createElement('template');template.innerHTML=html;range.deleteContents();range.insertNode(template.content);}
  const anchor=root.querySelector(`[data-node-caret="${marker}"]`);
  if(anchor&&selection){const next=document.createRange();next.setStartBefore(anchor);next.collapse(true);selection.removeAllRanges();selection.addRange(next);anchor.remove();}
  else if(retained&&selection){selection.removeAllRanges();selection.addRange(retained);}
  return true;
}
