import {countColumn,StateEffect,type EditorState} from '@codemirror/state';
import {Decoration,ViewPlugin,type DecorationSet,type EditorView,type ViewUpdate} from '@codemirror/view';

type Prefix={from:number;to:number;text:string};
type ListLine={from:number;prefix:Prefix};
const refreshWidths=StateEffect.define<void>();
function listLines(state:EditorState,visible:readonly {from:number;to:number}[]):ListLine[]{
 const result:ListLine[]=[],seen=new Set<number>();
 for(const range of visible)for(let pos=state.doc.lineAt(range.from).from;pos<=range.to;){
  const line=state.doc.lineAt(pos);pos=line.to+1;
  if(seen.has(line.from))continue;seen.add(line.from);
  const text=/^[ \t\u00a0]*(?:[-+*•‣◦⁃∙·–—−]|\d+[.)])[ \t\u00a0]+(?:\[[ xX]\][ \t\u00a0]+)?/.exec(line.text)?.[0];
  // A physical newline starts an independent row. Only this row's own list
  // prefix controls its soft wraps, regardless of Markdown's lazy continuation.
  if(text)result.push({from:line.from,prefix:{from:line.from,to:line.from+text.length,text}});
 }
 return result;
}

/** One measured hanging-indent owner for Markdown and pasted list prefixes. */
export const documentListLayout=ViewPlugin.fromClass(class {
 decorations:DecorationSet=Decoration.none;
 private lines:ListLine[]=[];
 private widths=new Map<string,number>();
 private fontKey='';
 private pending=false;
 private alive=true;
 constructor(view:EditorView){this.build(view);this.measure(view);}
 destroy(){this.alive=false;}
 update(update:ViewUpdate){
  const refresh=update.transactions.some(tr=>tr.effects.some(effect=>effect.is(refreshWidths)));
  if(update.docChanged||update.viewportChanged||refresh)this.build(update.view);
  if(update.docChanged||update.viewportChanged||update.geometryChanged)this.measure(update.view);
 }
 private build(view:EditorView){
  this.lines=listLines(view.state,view.visibleRanges);
  const needed=new Set(this.lines.map(line=>line.prefix.text));
  this.widths=new Map([...this.widths].filter(([key])=>needed.has(key)));
  const width=(prefix:Prefix)=>this.widths.get(prefix.text)??countColumn(prefix.text,view.state.tabSize)*view.defaultCharacterWidth;
  this.decorations=Decoration.set(this.lines.map(line=>{
   const indent=width(line.prefix);
   const offset=indent;
   // Match CodeMirror's native 6px line inset. Offset only the first visual row;
   // all subsequent rows begin at the measured content column.
   return Decoration.line({attributes:{style:`padding-left:calc(6px + ${indent}px);text-indent:-${offset}px`}}).range(line.from);
  }));
 }
 private measure(view:EditorView){
  if(!this.lines.length)return;
  view.requestMeasure({key:this,read:current=>{
   const style=current.contentDOM?.ownerDocument.defaultView?.getComputedStyle(current.contentDOM);
   const fontKey=[style?.font,style?.letterSpacing,style?.wordSpacing,style?.tabSize,style?.fontFeatureSettings,style?.fontVariationSettings,current.defaultCharacterWidth,current.defaultLineHeight,current.scaleX].join('|');
   const reset=fontKey!==this.fontKey,widths=new Map<string,number>();
   for(const {prefix} of this.lines){
    if(widths.has(prefix.text)||!reset&&this.widths.has(prefix.text))continue;
    if(!prefix.text){widths.set('',0);continue;}
    const start=current.coordsAtPos(prefix.from,1),end=current.coordsAtPos(prefix.to,1);
    if(start&&end&&Math.abs(start.top-end.top)<1){
     widths.set(prefix.text,Math.abs(end.left-start.left)/current.scaleX);
    }
   }
   return {doc:current.state.doc,widths,fontKey,reset};
  },write:result=>{
   if(result.doc!==view.state.doc)return;
   let changed=false;
   if(result.reset){this.widths.clear();this.fontKey=result.fontKey;changed=true;}
   for(const [key,width]of result.widths){if(Math.abs((this.widths.get(key)??-1)-width)>.01){this.widths.set(key,width);changed=true;}}
   if(changed&&!this.pending){
    this.pending=true;
    // Measurement writes run inside CodeMirror's update. Dispatch only after
    // that phase ends; coalesce multiple measured prefixes into one refresh.
    queueMicrotask(()=>{this.pending=false;if(this.alive&&view.state.doc===result.doc)view.dispatch({effects:refreshWidths.of()});});
   }
  }});
 }
},{decorations:value=>value.decorations});
