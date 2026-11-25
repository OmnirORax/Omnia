import {unmetNormalizationConstraints,planSceneNormalization,sampleScenePixels,transformScenePixels,analyzeScenePixels,type NormalizationPreferences} from './normalization.ts';
const scope=globalThis as unknown as {onmessage:(event:MessageEvent<{pixels:Uint8ClampedArray;preferences:NormalizationPreferences;sample?:Uint8ClampedArray}>)=>void;postMessage:(value:unknown,transfer:Transferable[])=>void};
scope.onmessage=({data:{pixels,preferences,sample}})=>{
 try{const report=planSceneNormalization(sample??sampleScenePixels(pixels),preferences);
  if(report.changed){transformScenePixels(pixels,report.corrections,pixels);report.after=analyzeScenePixels(sampleScenePixels(pixels));}
  report.unmet=unmetNormalizationConstraints(report.after,preferences,report.balanceAvailable);
  scope.postMessage({pixels,report},[pixels.buffer]);
 }catch(error){scope.postMessage({error:error instanceof Error?error.message:'Scene normalization failed.'},[]);}
};
