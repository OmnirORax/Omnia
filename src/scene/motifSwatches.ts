import type {MotifCandidate} from './colorCombo.ts';
import {colorLuminance,paletteRGB} from './palette.ts';
/** Scene controls and the inclusion picker project the same cached membership. */
export function motifSwatches(change:(candidate:MotifCandidate,enabled:boolean)=>void){
 const root=document.createElement('div');root.className='theme-inclusions motif-swatches';let previous='';
 return {root,render(candidates:readonly MotifCandidate[],disabled=false){const next=JSON.stringify([candidates,disabled]);if(next===previous)return;previous=next;root.replaceChildren();
  // Rank by the share shown on each swatch, including occupation inversion.
  const ranked=candidates.toSorted((a,b)=>Number(b.enabled)-Number(a.enabled)||(b.occupation??0)-(a.occupation??0));
  for(const c of ranked){const button=document.createElement('button');button.type='button';button.disabled=disabled;button.dataset.uiPaintOwner='geometry';button.style.backgroundColor=c.color;button.style.color=colorLuminance(paletteRGB(c.color))>.4?'#000000':'#ffffff';button.setAttribute('aria-label',`Motif ${c.color}`);button.setAttribute('aria-pressed',String(c.enabled));button.textContent=c.enabled?`${Number(((c.occupation??0)*100).toPrecision(2))}%`:'';button.onclick=()=>{if(root.isConnected&&!button.disabled)change(c,!c.enabled);};root.append(button);}
 }};
}
