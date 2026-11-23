import {syntaxTree} from '@codemirror/language';
import {EditorView} from '@codemirror/view';
import type {EditorState} from '@codemirror/state';
import {parser} from '@lezer/markdown';
const codeBlock=(name:string)=>name==='FencedCode'||name==='CodeBlock';
const blankLine=/^[\t \u00a0\u200b\ufeff]*$/;
/** External clipboard prose lands compactly. Code and the internal glyph format
 * retain their authored whitespace; this never rewrites the rest of the document. */
export function compactClipboardText(input:string){
 const text=input.replace(/\r\n?/g,'\n');
 if(!/\n[\t \u00a0\u200b\ufeff]*\n/.test(text))return text;
 const protectedRanges:{from:number;to:number}[]=[];
 if(/`{3}|~{3}|^ {4}|^[ \t]*\t|^ {0,3}>/m.test(text))parser.parse(text).iterate({enter(node){if(codeBlock(node.name)){
  let from=node.from;
  if(node.name==='CodeBlock'){
   const lineStart=text.lastIndexOf('\n',from-1)+1,previousStart=lineStart?text.lastIndexOf('\n',lineStart-2)+1:0;
   if(lineStart&&blankLine.test(text.slice(previousStart,lineStart-1)))from=previousStart;
  }
  protectedRanges.push({from,to:node.to});return false;
 }}});
 const lines=text.split('\n'),result:string[]=[];let offset=0,block=0;
 for(let i=0;i<lines.length;i++){
  const line=lines[i];while(block<protectedRanges.length&&protectedRanges[block].to<offset)block++;
  const protectedLine=block<protectedRanges.length&&protectedRanges[block].from<=offset&&offset<=protectedRanges[block].to;
  // Keep first/last line boundaries so pasting between existing text cannot join words.
  if(i===0||i===lines.length-1||!blankLine.test(line)||protectedLine)result.push(line);
  offset+=line.length+1;
 }
 return result.join('\n');
}
function inCode(state:EditorState,position:number){
 for(let node=syntaxTree(state).resolveInner(position,-1);node;node=node.parent!)if(codeBlock(node.name))return true;
 return false;
}
/** Use CodeMirror's normal paste transaction, selection handling and undo grouping. */
export const compactDocumentPaste=EditorView.clipboardInputFilter.of((text,state)=>state.selection.ranges.some(range=>inCode(state,range.from)||inCode(state,range.to))?text:compactClipboardText(text));
