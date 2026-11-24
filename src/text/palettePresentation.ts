import {generatedTextPaletteCSS} from '../properties/generatedTextPalette.ts';
import {StateEffect} from '@codemirror/state';
import {Decoration,ViewPlugin,type EditorView,type ViewUpdate,type DecorationSet} from '@codemirror/view';
import {glyphField,glyphIndexAt} from './source.ts';
import {textPaletteCSS,paletteInk} from '../properties/textPalette.ts';
import {textGlowLayers,TEXT_EMISSION_THRESHOLD,hasTextEmission} from '../properties/textGlow.ts';
import type {Paint} from '../properties/visual.ts';
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
let sequence=0;
/** One filter per document, updated on paint changes, with the existing neon profile. */
export function createDocumentPalettePaint(host:HTMLElement){
 const id=`document-palette-${++sequence}`;let svg:SVGSVGElement|undefined,filter:SVGElement|undefined,key='',enabled=false;
 const element=(name:string,attributes:Record<string,string|number>)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,String(value));return node;};
 return {render(paint:Paint){const active=paint.palette?.mode==='text'&&paint.palette.colors.length>1,changed=active!==enabled;enabled=active;
  if(active){host.style.setProperty('--document-palette-gradient',paint.palette?.pattern==='generated'?generatedTextPaletteCSS(paint.palette):textPaletteCSS(paint.palette!));const layers=textGlowLayers(paint.glow??0,paint.glowSpread),strength=paletteInk(paint.palette!),black=paint.palette!.colors.some(c=>!hasTextEmission(c)),next=JSON.stringify([layers,strength,black]);
   if(next!==key&&layers.length){key=next;if(!svg){svg=element('svg',{width:0,height:0,'aria-hidden':'true'}) as SVGSVGElement;svg.style.position='absolute';svg.style.pointerEvents='none';filter=element('filter',{id,x:'-50%',y:'-200%',width:'200%',height:'500%','color-interpolation-filters':'sRGB'});svg.append(filter);document.body.append(svg);}
    filter!.replaceChildren();const transfer=element('feComponentTransfer',{in:'SourceGraphic',result:'glowColor'});for(const channel of ['R','G','B'])transfer.append(element(`feFunc${channel}`,{type:'linear',slope:1/strength,intercept:-(1-strength)/strength}));filter!.append(transfer);
    if(black){filter!.append(element('feColorMatrix',{in:'glowColor',type:'matrix',values:`1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 ${1/TEXT_EMISSION_THRESHOLD} ${1/TEXT_EMISSION_THRESHOLD} ${1/TEXT_EMISSION_THRESHOLD} 0 0`,result:'glowEnergy'}));filter!.append(element('feComposite',{in:'glowEnergy',in2:'glowColor',operator:'in',result:'luminousGlow'}));}
    const merge=element('feMerge',{});for(const [i,layer]of layers.entries()){filter!.append(element('feGaussianBlur',{in:black?'luminousGlow':'glowColor',stdDeviation:layer.blur/2,result:`blur${i}`}));const opacity=element('feComponentTransfer',{in:`blur${i}`,result:`halo${i}`});opacity.append(element('feFuncA',{type:'linear',slope:layer.opacity}));filter!.append(opacity);merge.append(element('feMergeNode',{in:`halo${i}`}));}merge.append(element('feMergeNode',{in:'SourceGraphic'}));filter!.append(merge);
   }
   host.style.setProperty('--document-palette-filter',layers.length?`url(#${id})`:'none');
  }else{host.style.removeProperty('--document-palette-gradient');host.style.removeProperty('--document-palette-filter');}
  return changed;
 },dispose(){svg?.remove();}};
}
