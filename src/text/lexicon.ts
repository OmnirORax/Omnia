import {EditorState,StateEffect,type Text} from '@codemirror/state';
import {compileLexicon,applyLexiconMatches,annotationPrefix,lexiconWindow,type AnnotationKind,type TextPart} from './model.ts';
import {sliceSource,sourceTransactionSpec,toSource,glyphIndexAt,type Edit} from './source.ts';
import {definitionRecipe} from '../omnic/definition.ts';
import type {World} from '../core/model.ts';
export const refreshLexicon=StateEffect.define<void>();
let priorWorld:World|undefined,priorStamp='',prior:ReturnType<typeof compileLexicon>|undefined;
export function workspaceLexicon(world:World){
 if(prior&&world===priorWorld)return prior;
 const stamp=JSON.stringify(world.nodes.filter(n=>n.invariant&&n.lexiconWords?.length).map(n=>[n.origin,n.lexiconWords,!!(n.omnic||n.omnicEdits||n.variantOf)]));priorWorld=world;
 if(prior&&stamp===priorStamp)return prior;priorStamp=stamp;
 return prior=compileLexicon(world.nodes.filter(node=>node.invariant&&node.lexiconWords?.length&&definitionRecipe(node,world)).map(node=>({id:JSON.stringify(node.origin),omnic:true,lexiconWords:node.lexiconWords})));
}
/** Read only the edit neighbourhood plus its boundary characters from the rope. */
export function lexiconTextWindow(doc:Text,offset:number,radius=256){
 const from=Math.max(0,offset-radius-1),to=Math.min(doc.length,offset+radius+1),span=lexiconWindow(doc.sliceString(from,to),offset-from,radius);return {start:from+span.start,end:from+span.end};
}
/** Re-annotate only edited neighbourhoods. Manual/detached glyphs stay intact;
 * automatic markers and their English remain independently editable siblings. */
export function lexiconEdits(state:EditorState,lexicon:ReturnType<typeof compileLexicon>,windows:readonly {from:number;to:number}[],kind:AnnotationKind='refresh'):Edit[]{
 const edits:Edit[]=[],glyphs=state.field(glyphField);
 const normalized=windows.map(window=>{const previous=glyphs[glyphIndexAt(glyphs,window.from)-1];return {from:previous&&previous.part.word&&previous.at+1+previous.part.word.length>=window.from?previous.at:window.from,to:window.to};}).sort((a,b)=>a.from-b.from),merged:Array<{from:number;to:number}>=[];
 for(const window of normalized){const last=merged.at(-1);if(last&&window.from<=last.to)last.to=Math.max(last.to,window.to);else merged.push({...window});}
 for(const {from,to} of merged){
  const source=sliceSource(state,from,to),parts:TextPart[]=[],atGlyph=new Map(source.glyphs.map(g=>[g.at,g.part]));let text='';
  const flush=()=>{if(!text)return;let matches=lexicon.matches(text);const previous=parts.at(-1);if(previous&&typeof previous!=='string'&&(previous.word!==null&&matches[0]?.start===0&&matches[0].glyph===previous.glyph))matches=matches.filter(match=>match.start!==0);parts.push(...applyLexiconMatches(text,matches).content);text='';};
  for(let at=0;at<source.text.length;at++){const glyph=atGlyph.get(at);if(glyph){let retained=glyph;if(glyph.word){const end=source.text.indexOf('\ufffc',at+1),text=source.text.slice(at+1,end<0?undefined:end),first=lexicon.matches(text).find(match=>match.start===0),decision=annotationPrefix(glyph,text,first,kind);if(decision.remove)continue;if(decision.word!==undefined)retained={...glyph,word:decision.word};}flush();parts.push(retained);}else text+=source.text[at];}flush();
  const next=toSource({version:1,content:parts});if(JSON.stringify(source)!==JSON.stringify(next))edits.push({from,to,insert:next});
 }
 return edits;
}
import {glyphField} from './source.ts';
export function lexiconAnnotations(read:()=>World){
 return EditorState.transactionFilter.of(tr=>{
  const refresh=tr.effects.some(effect=>effect.is(refreshLexicon));
  if(!refresh&&(!tr.docChanged||tr.isUserEvent('undo')||tr.isUserEvent('redo')||tr.isUserEvent('select')))return tr;
  const windows:Array<{from:number;to:number}>=[];
  if(refresh)windows.push({from:0,to:tr.state.doc.length});else tr.changes.iterChangedRanges((_a,_b,from,to)=>{const span=lexiconTextWindow(tr.state.doc,from);windows.push({from:span.start,to:Math.max(span.end,to)});});
  const edits=lexiconEdits(tr.state,workspaceLexicon(read()),windows,refresh?'refresh':tr.isUserEvent('delete')?'delete':'insert');if(!edits.length)return tr;
  return [tr,{...sourceTransactionSpec(tr.state,edits),sequential:true}];
 });
}
