import {subscribeNativeFields} from '../properties/nativeField.ts';
import {isFocusPalette,focusPaletteCSS,focusPaletteGeometry,isImageField,isSourceField,hasPalettePaint,focusPattern,retainFocusPattern} from '../properties/focusPalette.ts';
import {generatedTextPaletteCSS} from '../properties/generatedTextPalette.ts';
import {textPaletteCSS,paletteInk} from '../properties/textPalette.ts';
import {paletteRGB} from '../scene/palette.ts';
import {textGlowLayers,TEXT_EMISSION_THRESHOLD,hasTextEmission} from '../properties/textGlow.ts';
import type {Paint} from '../properties/visual.ts';
let sequence=0;
const element=(name:string,attributes:Record<string,string|number>)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,String(value));return node;};
/** The same filter profile handles ordinary ink and a discrete palette-index image. */
function paletteFilter(){const id=`document-palette-${++sequence}`;let svg:SVGSVGElement|undefined,filter:SVGElement|undefined,key='';return {
 render(paint:Paint,indexed=false){const p=paint.palette!,layers=textGlowLayers(paint.glow??0,paint.glowSpread),strength=paletteInk(p),black=isSourceField(p)||p.colors.some(c=>!hasTextEmission(c)),next=JSON.stringify([layers,strength,black,indexed,indexed?p.colors:undefined]);if(!layers.length&&!indexed)return 'none';
  if(next!==key){key=next;if(!svg){svg=element('svg',{width:0,height:0,'aria-hidden':'true'}) as SVGSVGElement;svg.style.position='absolute';svg.style.pointerEvents='none';filter=element('filter',{id,x:'-50%',y:'-200%',width:'200%',height:'500%','color-interpolation-filters':'sRGB'});svg.append(filter);document.body.append(svg);}filter!.replaceChildren();let source='SourceGraphic';
   if(indexed){const colors=p.colors.map(paletteRGB),lookup=element('feComponentTransfer',{in:source,result:'paletteInk'});for(const [k,channel]of ['R','G','B'].entries())lookup.append(element(`feFunc${channel}`,{type:'discrete',tableValues:colors.map(c=>1-strength+c[k]/255*strength).join(' ')}));filter!.append(lookup);
    // Smooth the resolved colors, then restore the original glyph alpha exactly.
    // Interpolating index IDs would pick unrelated colors from larger palettes.
    filter!.append(element('feGaussianBlur',{in:'paletteInk',stdDeviation:.5,result:'softPaletteInk'}));
    filter!.append(element('feColorMatrix',{in:'softPaletteInk',type:'matrix',values:'1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0 1',result:'opaquePaletteInk'}));
    filter!.append(element('feComposite',{in:'opaquePaletteInk',in2:'SourceGraphic',operator:'in',result:'smoothPaletteInk'}));source='smoothPaletteInk';}
   if(layers.length){const transfer=element('feComponentTransfer',{in:source,result:'glowColor'});for(const channel of ['R','G','B'])transfer.append(element(`feFunc${channel}`,{type:'linear',slope:1/strength,intercept:-(1-strength)/strength}));filter!.append(transfer);
    if(black){filter!.append(element('feColorMatrix',{in:'glowColor',type:'matrix',values:`1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 ${1/TEXT_EMISSION_THRESHOLD} ${1/TEXT_EMISSION_THRESHOLD} ${1/TEXT_EMISSION_THRESHOLD} 0 0`,result:'glowEnergy'}));filter!.append(element('feComposite',{in:'glowEnergy',in2:'glowColor',operator:'in',result:'luminousGlow'}));}
    const merge=element('feMerge',{});for(const [i,layer]of layers.entries()){filter!.append(element('feGaussianBlur',{in:black?'luminousGlow':'glowColor',stdDeviation:layer.blur/2,result:`blur${i}`}));const opacity=element('feComponentTransfer',{in:`blur${i}`,result:`halo${i}`});opacity.append(element('feFuncA',{type:'linear',slope:layer.opacity}));filter!.append(opacity);merge.append(element('feMergeNode',{in:`halo${i}`}));}merge.append(element('feMergeNode',{in:source}));filter!.append(merge);
   }
  }return `url(#${id})`;
 },dispose(){svg?.remove();}};}
/** Palette tiles and glow filters update only when their owning paint changes. */
export function createPalettePaint(host:HTMLElement,inkEnabled=false){const normal=paletteFilter(),ink=paletteFilter();let enabled=false,last:Paint|undefined,pinned='',release=()=>{};const stop=subscribeNativeFields(()=>{if(last)sink.render(last);});const sink={
 render(paint:Paint){last=paint;const active=paint.palette?.mode==='text'&&hasPalettePaint(paint.palette),changed=active!==enabled;enabled=active;
  if(active){const p=paint.palette!,focus=isFocusPalette(p),patternKey=focus?focusPattern(p).key:'';if(patternKey!==pinned){const previous=release;pinned=patternKey;release=focus?retainFocusPattern(p):()=>{};previous();}const geometry=focus?focusPaletteGeometry(p):undefined;host.toggleAttribute('data-focus-theme',focus);host.toggleAttribute('data-pattern-debug',!!p.debugPattern);host.style.setProperty('--document-palette-size',geometry?.size??'100% 100%');host.style.setProperty('--document-palette-repeat',geometry?.repeat??'no-repeat');host.style.setProperty('--document-palette-gradient',focus?focusPaletteCSS(p):p.pattern==='generated'?generatedTextPaletteCSS(p):textPaletteCSS(p));host.style.setProperty('--document-palette-filter',normal.render(paint));host.style.setProperty('--document-ink-filter',inkEnabled&&!isImageField(p)&&p.progression==='ink-serpentine'?ink.render(paint,true):'none');
  }else{release();release=()=>{};pinned='';host.toggleAttribute('data-focus-theme',false);host.toggleAttribute('data-pattern-debug',false);for(const name of ['--document-palette-gradient','--document-palette-filter','--document-ink-filter'])host.style.removeProperty(name);}return changed;
 },dispose(){stop();release();normal.dispose();ink.dispose();}};return sink;}
