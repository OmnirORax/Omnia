import {StateField,type EditorState,type Text} from '@codemirror/state';
import {ViewPlugin,type ViewUpdate} from '@codemirror/view';

/** Shared counting rule for both the document and selected fragments. */
export function countWords(text:string):number {
 let count=0;
 for(const _ of text.matchAll(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’\-][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu))count++;
 return count;
}
type Range={from:number;to:number};
function countLines(doc:Text,ranges:Range[]):number {
 let count=0,end=-1;
 for(const range of ranges){
  const from=Math.max(end+1,doc.lineAt(range.from).from),to=doc.lineAt(range.to).to;
  if(from<=to)count+=countWords(doc.sliceString(from,to));
  end=to;
 }
 return count;
}
export const documentWordTotal=StateField.define<number>({
 create:state=>countLines(state.doc,[{from:0,to:state.doc.length}]),
 update(total,tr){
  if(!tr.docChanged)return total;
  const before:Range[]=[],after:Range[]=[];
  tr.changes.iterChangedRanges((fromA,toA,fromB,toB)=>{before.push({from:fromA,to:toA});after.push({from:fromB,to:toB});});
  return total-countLines(tr.startState.doc,before)+countLines(tr.newDoc,after);
 },
});
export function documentWordCount(state:EditorState):{count:number;selected:boolean} {
 const ranges=state.selection.ranges.filter(range=>!range.empty);
 return ranges.length?{count:ranges.reduce((sum,range)=>sum+countWords(state.sliceDoc(range.from,range.to)),0),selected:true}:{count:state.field(documentWordTotal),selected:false};
}
export function documentWordCounter(display:(text:string)=>void){
 return [documentWordTotal,ViewPlugin.define(view=>{
  const render=()=>display(`${documentWordCount(view.state).count}w`);
  render();
  return {update(update:ViewUpdate){if(update.docChanged||update.selectionSet)render();}};
 })];
}
