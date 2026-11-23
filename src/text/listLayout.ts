import {countColumn,StateEffect,type EditorState} from '@codemirror/state';
import {Decoration,ViewPlugin,type DecorationSet,type EditorView,type ViewUpdate} from '@codemirror/view';
import {syntaxTree} from '@codemirror/language';

type Prefix={from:number;to:number;text:string};
type ListLine={from:number;prefixes:Prefix[];leading:Prefix;hanging:boolean};
const refreshWidths=StateEffect.define<void>();
function listLines(state:EditorState,visible:readonly {from:number;to:number}[]):ListLine[]{
 const result:ListLine[]=[],seen=new Set<number>(),tree=syntaxTree(state);
 const prefix=(from:number,to:number):Prefix=>({from,to,text:state.sliceDoc(from,to)});
 for(const range of visible)for(let pos=state.doc.lineAt(range.from).from;pos<=range.to;){
  const line=state.doc.lineAt(pos);pos=line.to+1;
  if(seen.has(line.from))continue;seen.add(line.from);
  const leading=/^[ \t\u00a0]*/.exec(line.text)![0];
  const visiblePrefix=/^[ \t\u00a0]*(?:[-+*•‣◦⁃∙·–—−]|\d+[.)])[ \t\u00a0]+(?:\[[ xX]\][ \t\u00a0]+)?/.exec(line.text)?.[0];
  let item=tree.resolveInner(line.from+leading.length,1);
  while(item&&item.name!=='ListItem')item=item.parent!;
  const marker=item?.getChild('ListMark'),prefixes:Prefix[]=[];
  if(!marker&&!visiblePrefix)continue;
  if(marker){
   const first=state.doc.lineAt(marker.from);
   const separator=/^[ \t]+(?:\[[ xX]\][ \t]+)?/.exec(state.sliceDoc(marker.to,first.to))?.[0]??'';
   prefixes.push(prefix(first.from,marker.to+separator.length));
  }
  if(visiblePrefix)prefixes.push(prefix(line.from,line.from+visiblePrefix.length));
  result.push({from:line.from,prefixes,leading:prefix(line.from,line.from+leading.length),hanging:!!visiblePrefix||!!marker&&state.doc.lineAt(marker.from).from===line.from});
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
  if(update.docChanged||update.viewportChanged||refresh||syntaxTree(update.startState)!==syntaxTree(update.state))this.build(update.view);
  if(update.docChanged||update.viewportChanged||update.geometryChanged||syntaxTree(update.startState)!==syntaxTree(update.state))this.measure(update.view);
 }
 private build(view:EditorView){
  this.lines=listLines(view.state,view.visibleRanges);
  const needed=new Set(this.lines.flatMap(line=>[...line.prefixes,line.leading].map(prefix=>prefix.text)));
  this.widths=new Map([...this.widths].filter(([key])=>needed.has(key)));
  const width=(prefix:Prefix)=>this.widths.get(prefix.text)??countColumn(prefix.text,view.state.tabSize)*view.defaultCharacterWidth;
  this.decorations=Decoration.set(this.lines.map(line=>{
   const indent=Math.max(...line.prefixes.map(width),line.hanging?0:width(line.leading));
   const offset=line.hanging?indent:width(line.leading);
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
   for(const line of this.lines)for(const prefix of [...line.prefixes,line.leading]){
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
