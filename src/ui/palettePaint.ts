import {useDocumentWallpaper} from '../scene/documentWallpaper.ts';
import {isFocusPalette,focusPaletteCSS,focusPaletteGeometry,isImageField} from '../properties/focusPalette.ts';
import {generatedTextPaletteCSS} from '../properties/generatedTextPalette.ts';
import {textPaletteCSS,paletteInk,paletteFillOpacity} from '../properties/textPalette.ts';
import {paletteRGB} from '../scene/palette.ts';
import {textGlowLayers,TEXT_EMISSION_THRESHOLD,hasTextEmission} from '../properties/textGlow.ts';
import type {Paint} from '../properties/visual.ts';
let sequence=0;
const opaqueRGB='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 1';
const element=(name:string,attributes:Record<string,string|number>)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,String(value));return node;};
/** The same filter profile handles ordinary ink and a discrete palette-index image. */
function paletteFilter(){const id=`document-palette-${++sequence}`;let svg:SVGSVGElement|undefined,filter:SVGElement|undefined,key='';return {
 render(paint:Paint,indexed=false,fill=1){const p=paint.palette!,layers=textGlowLayers(paint.glow??0,paint.glowSpread),strength=paletteInk(p),black=p.distribution==='pixels'||p.colors.some(c=>!hasTextEmission(c)),outlined=fill<1,solidOutline=p.colors.length===1&&p.distribution!=='pixels'?paint.color??p.colors[0]:undefined,next=JSON.stringify([layers,strength,black,indexed,indexed?p.colors:undefined,fill,outlined?solidOutline:undefined]);if(!layers.length&&!indexed&&!outlined)return 'none';
  if(next!==key){key=next;if(!svg){svg=element('svg',{width:0,height:0,'aria-hidden':'true'}) as SVGSVGElement;svg.style.position='absolute';svg.style.pointerEvents='none';filter=element('filter',{id,x:'-50%',y:'-200%',width:'200%',height:'500%','color-interpolation-filters':'sRGB'});svg.append(filter);document.body.append(svg);}filter!.replaceChildren();let source='SourceGraphic';
   if(indexed){const colors=p.colors.map(paletteRGB),lookup=element('feComponentTransfer',{in:source,result:'paletteInk'});for(const [k,channel]of ['R','G','B'].entries())lookup.append(element(`feFunc${channel}`,{type:'discrete',tableValues:colors.map(c=>1-strength+c[k]/255*strength).join(' ')}));filter!.append(lookup);
    // Smooth the resolved colors, then restore the original glyph alpha exactly.
    // Interpolating index IDs would pick unrelated colors from larger palettes.
    filter!.append(element('feGaussianBlur',{in:'paletteInk',stdDeviation:.5,result:'softPaletteInk'}));
    filter!.append(element('feColorMatrix',{in:'softPaletteInk',type:'matrix',values:opaqueRGB,result:'opaquePaletteInk'}));
    filter!.append(element('feComposite',{in:'opaquePaletteInk',in2:'SourceGraphic',operator:'in',result:'smoothPaletteInk'}));source='smoothPaletteInk';}
   const merge=element('feMerge',{});
   if(layers.length){const transfer=element('feComponentTransfer',{in:source,result:'glowColor'});for(const channel of ['R','G','B'])transfer.append(element(`feFunc${channel}`,{type:'linear',slope:1/strength,intercept:-(1-strength)/strength}));filter!.append(transfer);
    if(black){filter!.append(element('feColorMatrix',{in:'glowColor',type:'matrix',values:`1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 ${1/TEXT_EMISSION_THRESHOLD} ${1/TEXT_EMISSION_THRESHOLD} ${1/TEXT_EMISSION_THRESHOLD} 0 0`,result:'glowEnergy'}));filter!.append(element('feComposite',{in:'glowEnergy',in2:'glowColor',operator:'in',result:'luminousGlow'}));}
    for(const [i,layer]of layers.entries()){
     filter!.append(element('feGaussianBlur',{in:black?'luminousGlow':'glowColor',stdDeviation:layer.blur/2,result:`blur${i}`}));
     const opacity=element('feComponentTransfer',{in:`blur${i}`,result:`halo${i}`});opacity.append(element('feFuncA',{type:'linear',slope:layer.opacity}));filter!.append(opacity);merge.append(element('feMergeNode',{in:`halo${i}`}));
    }
   }
   if(outlined){
    if(layers.length){
     merge.setAttribute('result','textHalo');
     filter!.append(merge,element('feComposite',{in:'textHalo',in2:'SourceAlpha',operator:'out',result:'outerHalo'}));
    }
    filter!.append(
     element('feMorphology',{in:'SourceAlpha',operator:'dilate',radius:1,result:'expanded'}),
     element('feComposite',{in:'expanded',in2:'SourceAlpha',operator:'arithmetic',k2:1,k3:-1,result:'outlineMask'}),
    );
    if(solidOutline!==undefined){
     filter!.append(element('feFlood',{'flood-color':solidOutline,result:'outlineColor'}));
    }else{
     // Carry the neighboring ink colors across the edge before applying the stroke alpha.
     filter!.append(
      element('feGaussianBlur',{in:source,stdDeviation:1,result:'edgeInk'}),
      element('feColorMatrix',{in:'edgeInk',type:'matrix',values:opaqueRGB,result:'outlineColor'}),
     );
    }
    filter!.append(element('feComposite',{in:'outlineColor',in2:'outlineMask',operator:'in',result:'outline'}));
    const result=element('feMerge',{});if(layers.length)result.append(element('feMergeNode',{in:'outerHalo'}));
    if(fill>0){
     const interior=element('feComponentTransfer',{in:source,result:'interior'});interior.append(element('feFuncA',{type:'linear',slope:fill}));filter!.append(interior);
     result.append(element('feMergeNode',{in:'interior'}));
    }
    result.append(element('feMergeNode',{in:'outline'}));filter!.append(result);
   }else if(layers.length){merge.append(element('feMergeNode',{in:source}));filter!.append(merge);}
  }return `url(#${id})`;
 },dispose(){svg?.remove();}};}
/** Palette tiles and glow filters update only when their owning paint changes. */
export function createPalettePaint(host:HTMLElement,inkEnabled=false){const normal=paletteFilter(),ink=paletteFilter();let enabled=false;return {
 get enabled(){return enabled;},
 render(paint:Paint){
  const p=paint.palette,patterned=!!p&&p.colors.length>1;
  const pixels=inkEnabled&&p?.distribution==='pixels',debug=patterned&&!pixels&&!!p.debugPattern;
  const pale=pixels&&paletteInk(p)<1;
  if(pixels)host.style.setProperty('--document-image-pale',String(1-paletteInk(p)));
  host.toggleAttribute('data-document-image-pale',pale);
  host.toggleAttribute('data-document-image-pixels',pixels);
  if(inkEnabled)useDocumentWallpaper(host,pixels,pale);
  const fill=inkEnabled&&!debug?paletteFillOpacity(p):1;
  const active=patterned||pixels||fill<1,changed=active!==enabled;enabled=active;
  if(active&&p){
   const focus=patterned&&isFocusPalette(p),geometry=focus?focusPaletteGeometry(p):undefined;
   host.toggleAttribute('data-focus-theme',focus);host.toggleAttribute('data-pattern-debug',debug);
   host.style.setProperty('--document-palette-size',geometry?.size??'100% 100%');host.style.setProperty('--document-palette-repeat',geometry?.repeat??'no-repeat');
   host.style.setProperty('--document-palette-gradient',!patterned?'linear-gradient(currentColor,currentColor)':focus?focusPaletteCSS(p):p.pattern==='generated'?generatedTextPaletteCSS(p):textPaletteCSS(p));
   host.style.setProperty('--document-palette-filter',normal.render(paint,false,fill));
   host.style.setProperty('--document-ink-filter',inkEnabled&&!pixels&&patterned&&!isImageField(p)&&p.progression==='ink-serpentine'?ink.render(paint,true,fill):'none');
  }else{host.toggleAttribute('data-focus-theme',false);host.toggleAttribute('data-pattern-debug',false);for(const name of ['--document-palette-gradient','--document-palette-filter','--document-ink-filter'])host.style.removeProperty(name);}return changed;
 },dispose(){if(inkEnabled)useDocumentWallpaper(host,false);normal.dispose();ink.dispose();}};}
