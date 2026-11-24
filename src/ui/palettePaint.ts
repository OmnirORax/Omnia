import {isFocusPalette,focusPaletteCSS,focusPeriod} from '../properties/focusPalette.ts';
import {generatedTextPaletteCSS} from '../properties/generatedTextPalette.ts';
import {textPaletteCSS,paletteInk} from '../properties/textPalette.ts';
import {textGlowLayers,TEXT_EMISSION_THRESHOLD,hasTextEmission} from '../properties/textGlow.ts';
import type {Paint} from '../properties/visual.ts';
let sequence=0;
/** One filter per document, updated on paint changes, with the existing neon profile. */
export function createPalettePaint(host:HTMLElement){
 const id=`document-palette-${++sequence}`;let svg:SVGSVGElement|undefined,filter:SVGElement|undefined,key='',enabled=false;
 const element=(name:string,attributes:Record<string,string|number>)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,String(value));return node;};
 return {render(paint:Paint){const active=paint.palette?.mode==='text'&&paint.palette.colors.length>1,changed=active!==enabled;enabled=active;
  if(active){const focus=isFocusPalette(paint.palette!);if(focus)host.setAttribute('data-focus-theme','');else host.toggleAttribute('data-focus-theme',false);host.style.setProperty('--document-palette-size',focus?`${focusPeriod(paint.palette!)}px 100%`:'100% 100%');host.style.setProperty('--document-palette-repeat',focus?'repeat-x':'no-repeat');host.style.setProperty('--document-palette-gradient',focus?focusPaletteCSS(paint.palette!):paint.palette?.pattern==='generated'?generatedTextPaletteCSS(paint.palette):textPaletteCSS(paint.palette!));const layers=textGlowLayers(paint.glow??0,paint.glowSpread),strength=paletteInk(paint.palette!),black=paint.palette!.colors.some(c=>!hasTextEmission(c)),next=JSON.stringify([layers,strength,black]);
   if(next!==key&&layers.length){key=next;if(!svg){svg=element('svg',{width:0,height:0,'aria-hidden':'true'}) as SVGSVGElement;svg.style.position='absolute';svg.style.pointerEvents='none';filter=element('filter',{id,x:'-50%',y:'-200%',width:'200%',height:'500%','color-interpolation-filters':'sRGB'});svg.append(filter);document.body.append(svg);}
    filter!.replaceChildren();const transfer=element('feComponentTransfer',{in:'SourceGraphic',result:'glowColor'});for(const channel of ['R','G','B'])transfer.append(element(`feFunc${channel}`,{type:'linear',slope:1/strength,intercept:-(1-strength)/strength}));filter!.append(transfer);
    if(black){filter!.append(element('feColorMatrix',{in:'glowColor',type:'matrix',values:`1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 ${1/TEXT_EMISSION_THRESHOLD} ${1/TEXT_EMISSION_THRESHOLD} ${1/TEXT_EMISSION_THRESHOLD} 0 0`,result:'glowEnergy'}));filter!.append(element('feComposite',{in:'glowEnergy',in2:'glowColor',operator:'in',result:'luminousGlow'}));}
    const merge=element('feMerge',{});for(const [i,layer]of layers.entries()){filter!.append(element('feGaussianBlur',{in:black?'luminousGlow':'glowColor',stdDeviation:layer.blur/2,result:`blur${i}`}));const opacity=element('feComponentTransfer',{in:`blur${i}`,result:`halo${i}`});opacity.append(element('feFuncA',{type:'linear',slope:layer.opacity}));filter!.append(opacity);merge.append(element('feMergeNode',{in:`halo${i}`}));}merge.append(element('feMergeNode',{in:'SourceGraphic'}));filter!.append(merge);
   }
   host.style.setProperty('--document-palette-filter',layers.length?`url(#${id})`:'none');
  }else{host.toggleAttribute('data-focus-theme',false);host.style.removeProperty('--document-palette-gradient');host.style.removeProperty('--document-palette-filter');}
  return changed;
 },dispose(){svg?.remove();}};
}
