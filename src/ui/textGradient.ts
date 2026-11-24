import {gradientCSS,GLOW_SATURATION,GLOW_LUMINOSITY,TEXT_KEYLINE,type TextGradient} from '../properties/textGradient.ts';
import {textGlowLayers} from '../properties/textGlow.ts';
/** Recolor SourceGraphic, so halo and ink cannot acquire separate positions. */
export function textGradientFilter(id:string,glow:number,spread:number,fontPixels=13){
 const layers=textGlowLayers(glow,spread),padding=Math.ceil(Math.max(.45,...layers.map(layer=>layer.blur*1.5))/fontPixels*100);
 return `<filter id="${id}" x="-15%" y="-${padding}%" width="130%" height="${100+padding*2}%" color-interpolation-filters="sRGB">
 <feColorMatrix in="SourceGraphic" type="saturate" values="${GLOW_SATURATION}" result="saturated"/>
 <feComponentTransfer in="saturated" result="halo"><feFuncR type="linear" slope="${GLOW_LUMINOSITY}"/><feFuncG type="linear" slope="${GLOW_LUMINOSITY}"/><feFuncB type="linear" slope="${GLOW_LUMINOSITY}"/></feComponentTransfer>
 ${layers.map((layer,i)=>`<feGaussianBlur in="halo" stdDeviation="${layer.blur/2}" result="blur${i}"/><feComponentTransfer in="blur${i}" result="glow${i}"><feFuncA type="linear" slope="${layer.opacity}"/></feComponentTransfer>`).join('')}
 <feMorphology in="SourceAlpha" operator="dilate" radius=".45" result="edge"/><feFlood flood-color="${TEXT_KEYLINE}"/><feComposite in2="edge" operator="in" result="keyline"/>
 <feMerge>${layers.map((_,i)=>`<feMergeNode in="glow${i}"/>`).join('')}<feMergeNode in="keyline"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}
let nextId=0;
const states=new WeakMap<HTMLElement,{svg:SVGSVGElement;id:string;key:string}>();
/** Each document owns its filter definition; closing its window removes it.
 * Only CodeMirror's rendered lines use the filter, leaving selection and cursor
 * layers outside it and keeping very long documents out of one giant surface. */
export function setDOMTextGradient(owner:HTMLElement,gradient:TextGradient|null,glow:number,spread:number){
 let state=states.get(owner);
 if(!gradient){if(state){state.svg.remove();states.delete(owner);}delete owner.dataset.imageText;owner.style.removeProperty('--image-text-gradient');owner.style.removeProperty('--image-text-filter');return;}
 if(!state){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),id=`image-text-${++nextId}`;svg.setAttribute('width','0');svg.setAttribute('height','0');svg.setAttribute('aria-hidden','true');svg.style.position='absolute';svg.style.pointerEvents='none';owner.append(svg);state={svg,id,key:''};states.set(owner,state);}
 // Font pixels conservatively bound each line's height without layout reads.
 const fontPixels=Number.parseFloat(owner.style.fontSize)||13,key=JSON.stringify([glow,spread,fontPixels]);if(state.key!==key){state.svg.innerHTML=textGradientFilter(state.id,glow,spread,fontPixels);state.key=key;}
 owner.dataset.imageText='';owner.style.setProperty('--image-text-gradient',gradientCSS(gradient));owner.style.setProperty('--image-text-filter',`url("#${state.id}")`);
}
