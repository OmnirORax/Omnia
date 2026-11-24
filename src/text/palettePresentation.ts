import {StateEffect} from '@codemirror/state';
import {Decoration,ViewPlugin,type EditorView,type ViewUpdate,type DecorationSet} from '@codemirror/view';
import {glyphField,glyphIndexAt} from './source.ts';
export const showDocumentPalette=StateEffect.define<boolean>();
/** Only visible text runs are decorated; glyph widgets and native emoji keep their own paint. */
const emojiPattern=(()=>{try{return new RegExp('\\p{RGI_Emoji}','gv');}catch{return /(?:[#*0-9]\uFE0F?\u20E3|\p{Regional_Indicator}{2}|\p{Extended_Pictographic}[\uFE0E\uFE0F]?\p{Emoji_Modifier}?(?:[\u{E0020}-\u{E007E}]+\u{E007F})?(?:\u200D\p{Extended_Pictographic}[\uFE0E\uFE0F]?\p{Emoji_Modifier}?)*)/gu;}})();
const gradientMark=Decoration.mark({class:'cm-image-palette'}),emojiMark=Decoration.mark({class:'cm-native-emoji'});
export const documentPalette=ViewPlugin.fromClass(class{
 enabled=false;decorations:DecorationSet=Decoration.none;
 update(update:ViewUpdate){let changed=false;for(const tr of update.transactions)for(const effect of tr.effects)if(effect.is(showDocumentPalette)){this.enabled=effect.value;changed=true;}
  if(changed||update.docChanged||update.viewportChanged)this.decorations=this.build(update.view);
 }
 build(view:EditorView){if(!this.enabled)return Decoration.none;const ranges:ReturnType<typeof gradientMark.range>[]=[],glyphs=view.state.field(glyphField);
  const textRun=(from:number,to:number)=>{let start=from;for(const match of view.state.sliceDoc(from,to).matchAll(emojiPattern)){const at=from+match.index;if(start<at)ranges.push(gradientMark.range(start,at));start=at+match[0].length;ranges.push(emojiMark.range(at,start));}if(start<to)ranges.push(gradientMark.range(start,to));};
  for(const visible of view.visibleRanges){let at=visible.from;while(at<visible.to){const line=view.state.doc.lineAt(at),end=Math.min(line.to,visible.to);let start=at;for(let i=glyphIndexAt(glyphs,at);i<glyphs.length&&glyphs[i].at<end;i++){if(glyphs[i].at>start)textRun(start,glyphs[i].at);start=glyphs[i].at+1;}if(start<end)textRun(start,end);at=line.to+1;}}
  return Decoration.set(ranges,true);
 }
},{decorations:plugin=>plugin.decorations});

export {createPalettePaint as createDocumentPalettePaint} from '../ui/palettePaint.ts';
