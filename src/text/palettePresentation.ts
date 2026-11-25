import {createStartEndPainter} from './startEndProgression.ts';
import {createInkTextPainter,readInkRows} from './inkProgression.ts';
import type {TextPalette} from '../properties/textPalette.ts';
import {StateEffect} from '@codemirror/state';
import {Decoration,ViewPlugin,type EditorView,type ViewUpdate,type DecorationSet} from '@codemirror/view';
import {glyphField,glyphIndexAt} from './source.ts';
export const setDocumentInkTypography=StateEffect.define<string>();
export const setDocumentPalette=StateEffect.define<TextPalette|undefined>();
export const showDocumentPalette=StateEffect.define<boolean>();
/** Only visible text runs are decorated; glyph widgets and native emoji keep their own paint. */
const emojiPattern=(()=>{try{return new RegExp('\\p{RGI_Emoji}','gv');}catch{return /(?:[#*0-9]\uFE0F?\u20E3|\p{Regional_Indicator}{2}|\p{Extended_Pictographic}[\uFE0E\uFE0F]?\p{Emoji_Modifier}?(?:[\u{E0020}-\u{E007E}]+\u{E007F})?(?:\u200D\p{Extended_Pictographic}[\uFE0E\uFE0F]?\p{Emoji_Modifier}?)*)/gu;}})();
const gradientMark=Decoration.mark({class:'cm-image-palette'}),emojiMark=Decoration.mark({class:'cm-native-emoji'});
export const documentPalette=ViewPlugin.fromClass(class{
 enabled=false;palette:TextPalette|undefined;ink=createInkTextPainter();stream=createStartEndPainter();queued=false;closed=false;dirty=true;typography='';rows:ReturnType<typeof readInkRows>=[];fontSet:FontFaceSet|undefined;onFont=()=>{};decorations:DecorationSet=Decoration.none;
 constructor(view:EditorView){this.fontSet=typeof document==='undefined'?undefined:document.fonts;this.onFont=()=>{this.ink.invalidate();this.stream.invalidate();this.measure(view,true);};this.fontSet?.addEventListener('loadingdone',this.onFont);}
 measure(view:EditorView,rebuild:boolean){this.dirty ||= rebuild;const progression=this.palette?.progression;if(this.closed||!['ink-serpentine','start-end'].includes(progression??'')||!this.enabled||this.queued||typeof view.requestMeasure!=='function')return;this.queued=true;
  if(progression==='start-end'){view.requestMeasure({key:this,read:view=>this.closed?undefined:this.stream.read(view),write:data=>{this.queued=false;if(data&&!this.closed&&this.palette?.progression==='start-end'){this.ink.clear();this.stream.render(data,this.palette);}else if(!this.closed)this.measure(view,true);}});return;}
  view.requestMeasure({key:this,read:view=>{if(this.closed)return [];if(this.dirty){this.rows=readInkRows(view.dom);this.dirty=false;}return this.rows;},write:rows=>{this.queued=false;if(!this.closed&&this.palette?.progression==='ink-serpentine'){this.stream.clear();this.ink.render(rows,this.palette);}else if(!this.closed)this.measure(view,true);}});}

 update(update:ViewUpdate){let changed=false,paintChanged=false;for(const tr of update.transactions)for(const effect of tr.effects)if(effect.is(setDocumentInkTypography)&&this.typography!==effect.value){this.typography=effect.value;this.dirty=true;paintChanged=true;}for(const tr of update.transactions)for(const effect of tr.effects)if(effect.is(setDocumentPalette)){this.palette=effect.value;paintChanged=true;}for(const tr of update.transactions)for(const effect of tr.effects)if(effect.is(showDocumentPalette)){this.enabled=effect.value;changed=true;}
  if(changed||update.docChanged||update.viewportChanged)this.decorations=this.build(update.view);
  if(['ink-serpentine','start-end'].includes(this.palette?.progression??'')&&this.enabled){if(paintChanged||changed||update.docChanged||update.viewportChanged||update.geometryChanged)this.measure(update.view,changed||update.docChanged||update.viewportChanged||update.geometryChanged);}else{this.ink.clear();this.stream.clear();this.rows=[];this.dirty=true;}
 }
 destroy(){this.closed=true;this.ink.clear();this.stream.clear();this.rows=[];this.fontSet?.removeEventListener('loadingdone',this.onFont);}
 build(view:EditorView){if(!this.enabled)return Decoration.none;const ranges:ReturnType<typeof gradientMark.range>[]=[],glyphs=view.state.field(glyphField);
  const textRun=(from:number,to:number)=>{let start=from;for(const match of view.state.sliceDoc(from,to).matchAll(emojiPattern)){const at=from+match.index;if(start<at)ranges.push(gradientMark.range(start,at));start=at+match[0].length;ranges.push(emojiMark.range(at,start));}if(start<to)ranges.push(gradientMark.range(start,to));};
  for(const visible of view.visibleRanges){let at=visible.from;while(at<visible.to){const line=view.state.doc.lineAt(at),end=Math.min(line.to,visible.to);let start=at;for(let i=glyphIndexAt(glyphs,at);i<glyphs.length&&glyphs[i].at<end;i++){if(glyphs[i].at>start)textRun(start,glyphs[i].at);start=glyphs[i].at+1;}if(start<end)textRun(start,end);at=line.to+1;}}
  return Decoration.set(ranges,true);
 }
},{decorations:plugin=>plugin.decorations});

export {createPalettePaint as createDocumentPalettePaint} from '../ui/palettePaint.ts';
