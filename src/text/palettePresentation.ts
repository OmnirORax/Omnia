import {createDocumentPixelPainter} from './imagePixelPresentation.ts';
import {createDocumentFieldPainter} from './fieldPresentation.ts';
import {isImageField} from '../properties/focusPalette.ts';
import {createStartEndPainter} from './startEndProgression.ts';
import {createInkTextPainter,readInkRows} from './inkProgression.ts';
import type {TextPalette} from '../properties/textPalette.ts';
import {StateEffect} from '@codemirror/state';
import {Decoration,ViewPlugin,type EditorView,type ViewUpdate,type DecorationSet} from '@codemirror/view';
import {glyphField,glyphIndexAt} from './source.ts';
const usesPixelCoordinates=(p?:TextPalette)=>p?.distribution==='pixels'&&!['ink-serpentine','start-end'].includes(p.progression??'');
const setFieldCuts=StateEffect.define<readonly number[]>();
export const setDocumentInkTypography=StateEffect.define<string>();
export const setDocumentPalette=StateEffect.define<TextPalette|undefined>();
export const showDocumentPalette=StateEffect.define<boolean>();
/** Only visible text runs are decorated; glyph widgets and native emoji keep their own paint. */
const emojiPattern=(()=>{try{return new RegExp('\\p{RGI_Emoji}','gv');}catch{return /(?:[#*0-9]\uFE0F?\u20E3|\p{Regional_Indicator}{2}|\p{Extended_Pictographic}[\uFE0E\uFE0F]?\p{Emoji_Modifier}?(?:[\u{E0020}-\u{E007E}]+\u{E007F})?(?:\u200D\p{Extended_Pictographic}[\uFE0E\uFE0F]?\p{Emoji_Modifier}?)*)/gu;}})();
const gradientMark=Decoration.mark({class:'cm-image-palette'}),emojiMark=Decoration.mark({class:'cm-native-emoji'});
export const documentPalette=ViewPlugin.fromClass(class{
 enabled=false;palette:TextPalette|undefined;ink=createInkTextPainter();stream=createStartEndPainter();field=createDocumentFieldPainter();pixels=createDocumentPixelPainter();cuts:readonly number[]=[];queued=false;closed=false;dirty=true;typography='';rows:ReturnType<typeof readInkRows>=[];fontSet:FontFaceSet|undefined;onFont=()=>{};decorations:DecorationSet=Decoration.none;
 constructor(view:EditorView){this.fontSet=typeof document==='undefined'?undefined:document.fonts;this.onFont=()=>{this.ink.invalidate();this.stream.invalidate();this.field.invalidate();this.measure(view,true);};this.fontSet?.addEventListener('loadingdone',this.onFont);}
 measure(view:EditorView,rebuild:boolean){this.dirty ||= rebuild;const progression=this.palette?.progression;if(this.closed||!usesPixelCoordinates(this.palette)&&!isImageField(this.palette)&&!['ink-serpentine','start-end'].includes(progression??'')||!this.enabled||this.queued||typeof view.requestMeasure!=='function')return;this.queued=true;
  if(this.palette?.distribution==='pixels')this.pixels.watch(view,()=>this.measure(view,true));
  if(usesPixelCoordinates(this.palette)){
   this.pixels.watch(view);
   view.requestMeasure({key:this,read:view=>this.closed?undefined:this.pixels.read(view),write:layout=>{
    this.queued=false;
    if(this.closed||!this.enabled||!layout)return;
    if(!usesPixelCoordinates(this.palette)){this.measure(view,true);return;}
    const cuts=[...new Set([...this.cuts,...layout.cuts])].sort((a,b)=>a-b);
    if(cuts.length!==this.cuts.length){
     const doc=view.state.doc;
     queueMicrotask(()=>{if(this.closed||!this.enabled)return;if(doc===view.state.doc&&usesPixelCoordinates(this.palette))view.dispatch({effects:setFieldCuts.of(cuts)});else this.measure(view,true);});
     return;
    }
    this.pixels.render(view,layout);
   }});
   return;
  }
  if(isImageField(this.palette)){view.requestMeasure({key:this,read:view=>this.closed?[]:this.field.read(view),write:slices=>{this.queued=false;if(this.closed||!this.enabled)return;if(!isImageField(this.palette)){this.measure(view,true);return;}const cuts=[...new Set(slices.flatMap(s=>[s.from,s.to]))].sort((a,b)=>a-b);if(JSON.stringify(cuts)!==JSON.stringify(this.cuts)){const doc=view.state.doc;queueMicrotask(()=>{if(this.closed||!this.enabled)return;if(doc===view.state.doc&&isImageField(this.palette))view.dispatch({effects:setFieldCuts.of(cuts)});else this.measure(view,true);});return;}this.ink.clear();this.stream.clear();this.field.render(slices,this.palette!);}});return;}
  if(progression==='start-end'){view.requestMeasure({key:this,read:view=>this.closed?undefined:this.stream.read(view),write:data=>{this.queued=false;if(data&&!this.closed&&this.palette?.progression==='start-end'&&!isImageField(this.palette)){this.field.clear();this.ink.clear();this.stream.render(data,this.palette);}else if(!this.closed)this.measure(view,true);}});return;}
  view.requestMeasure({key:this,read:view=>{if(this.closed)return [];if(this.dirty){this.rows=readInkRows(view.dom);this.dirty=false;}return this.rows;},write:rows=>{this.queued=false;if(!this.closed&&this.palette?.progression==='ink-serpentine'&&!isImageField(this.palette)){this.field.clear();this.stream.clear();this.ink.render(rows,this.palette);}else if(!this.closed)this.measure(view,true);}});}

 update(update:ViewUpdate){let changed=false,paintChanged=false;if(update.docChanged)this.cuts=[];for(const tr of update.transactions)for(const effect of tr.effects)if(effect.is(setFieldCuts)){this.cuts=effect.value;changed=true;}for(const tr of update.transactions)for(const effect of tr.effects)if(effect.is(setDocumentInkTypography)&&this.typography!==effect.value){this.typography=effect.value;this.dirty=true;paintChanged=true;}for(const tr of update.transactions)for(const effect of tr.effects)if(effect.is(setDocumentPalette)){if(isImageField(this.palette)!==isImageField(effect.value))changed=true;if(usesPixelCoordinates(this.palette)!==usesPixelCoordinates(effect.value)){changed=true;this.cuts=[];}this.palette=effect.value;paintChanged=true;}for(const tr of update.transactions)for(const effect of tr.effects)if(effect.is(showDocumentPalette)){this.enabled=effect.value;changed=true;}
  if(changed||update.docChanged||update.viewportChanged)this.decorations=this.build(update.view);
  if(!this.enabled||this.palette?.distribution!=='pixels')this.pixels.clear();
  else if(!usesPixelCoordinates(this.palette))this.pixels.clearPositions();
  if(usesPixelCoordinates(this.palette)){this.field.clear();this.ink.clear();this.stream.clear();}
  // Selection-dependent formatting can replace spans without changing document geometry.
  // Rebind the painters to the mounted DOM after that redraw; keep their raster caches.
  const redraw=changed||update.docChanged||update.viewportChanged||update.geometryChanged||update.selectionSet||update.focusChanged;
  if((usesPixelCoordinates(this.palette)||isImageField(this.palette)||['ink-serpentine','start-end'].includes(this.palette?.progression??''))&&this.enabled){if(paintChanged||redraw)this.measure(update.view,!!redraw);}else{this.field.clear();this.ink.clear();this.stream.clear();this.rows=[];this.dirty=true;}
 }
 destroy(){this.closed=true;this.pixels.clear();this.field.clear();this.ink.clear();this.stream.clear();this.rows=[];this.fontSet?.removeEventListener('loadingdone',this.onFont);}
 build(view:EditorView){if(!this.enabled)return Decoration.none;const ranges:ReturnType<typeof gradientMark.range>[]=[],glyphs=view.state.field(glyphField);
  const gradient=(from:number,to:number)=>{if(!isImageField(this.palette)&&!usesPixelCoordinates(this.palette)){ranges.push(gradientMark.range(from,to));return;}let at=from;for(const cut of this.cuts){if(cut<=at||cut>=to)continue;ranges.push(Decoration.mark({class:'cm-image-palette',attributes:{'data-field-fragment':String(at)}}).range(at,cut));at=cut;}if(at<to)ranges.push(Decoration.mark({class:'cm-image-palette',attributes:{'data-field-fragment':String(at)}}).range(at,to));};
  const textRun=(from:number,to:number)=>{let start=from;for(const match of view.state.sliceDoc(from,to).matchAll(emojiPattern)){const at=from+match.index;if(start<at)gradient(start,at);start=at+match[0].length;ranges.push(emojiMark.range(at,start));}if(start<to)gradient(start,to);};
  for(const visible of view.visibleRanges){let at=visible.from;while(at<visible.to){const line=view.state.doc.lineAt(at),end=Math.min(line.to,visible.to);let start=at;for(let i=glyphIndexAt(glyphs,at);i<glyphs.length&&glyphs[i].at<end;i++){if(glyphs[i].at>start)textRun(start,glyphs[i].at);start=glyphs[i].at+1;}if(start<end)textRun(start,end);at=line.to+1;}}
  return Decoration.set(ranges,true);
 }
},{decorations:plugin=>plugin.decorations});

export {createPalettePaint as createDocumentPalettePaint} from '../ui/palettePaint.ts';
