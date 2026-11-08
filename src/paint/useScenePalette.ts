import {useEffect,useState} from 'react';
import {sceneSourceSample} from '../scene/normalizationCache.ts';
import {sampleScenePixels,transformScenePixels,type Corrections} from '../scene/normalization.ts';
import {omniHighTintRGB} from '../scene/pulse.ts';
import type {SceneVfx} from '../scene/vfx.ts';
import {scenePalette,type ScenePaletteSignal} from './pattern.ts';
const cache=new Map<string,ScenePaletteSignal>();
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
/** Scene adapter publishes stable resting colours; transient audio flashes are not a theme input. */
export function useScenePalette(original:Blob|null,correction:Corrections|null,vfx:SceneVfx,enabled:boolean,ready:boolean){
 const key=JSON.stringify([correction,vfx.pulseColorMode,vfx.pulseTintLow,vfx.pulseOmniTintLow,vfx.imageTintEnabled,vfx.imageTint]);
 const [state,setState]=useState<{source:Blob;signal:ScenePaletteSignal}|null>(null),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();setError('');if(!original||!enabled||!ready)return;
  const timer=setTimeout(()=>void sceneSourceSample(original,controller.signal).then(({key:hash,pixels})=>{
   if(controller.signal.aborted)return;const id=hash+key,previous=cache.get(id);if(previous){setState({source:original,signal:previous});return;}
   const sample=sampleScenePixels(pixels,4096),visible=correction?transformScenePixels(sample,correction):sample,low=rgb(vfx.pulseColorMode==='all'?vfx.pulseOmniTintLow:vfx.pulseTintLow),tint=vfx.imageTintEnabled?rgb(vfx.imageTint):[1,1,1];
   for(let i=0;i<visible.length;i+=4){const source=[visible[i]/255,visible[i+1]/255,visible[i+2]/255],gain=vfx.pulseColorMode==='all'?omniHighTintRGB(source,low):low;for(let c=0;c<3;c++)visible[i+c]=Math.round(visible[i+c]*gain[c]*tint[c]);}
   const signal:ScenePaletteSignal={source:'scene.image.palette',revision:id,colors:scenePalette(visible)};if(cache.size>=8)cache.delete(cache.keys().next().value!);cache.set(id,signal);setState({source:original,signal});
  }).catch(failure=>{if(!controller.signal.aborted)setError(failure instanceof Error?failure.message:'Scene palette unavailable.');}),180);
  return()=>{clearTimeout(timer);controller.abort();};
 },[original,key,enabled,ready]);
 return {signal:enabled&&state?.source===original?state.signal:null,error};
}
