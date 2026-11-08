import {planSceneNormalization,sampleScenePixels,transformScenePixels,analyzeScenePixels,type NormalizationPreferences} from './normalization.ts';
const scope=globalThis as unknown as {onmessage:(event:MessageEvent<{pixels:Uint8ClampedArray;preferences:NormalizationPreferences}>)=>void;postMessage:(value:unknown,transfer:Transferable[])=>void};
scope.onmessage=({data:{pixels,preferences}})=>{
 try{const report=planSceneNormalization(sampleScenePixels(pixels),preferences);
  if(report.changed){transformScenePixels(pixels,report.corrections,pixels);report.after=analyzeScenePixels(sampleScenePixels(pixels));}
  scope.postMessage({pixels,report},[pixels.buffer]);
 }catch(error){scope.postMessage({error:error instanceof Error?error.message:'Scene normalization failed.'},[]);}
};
