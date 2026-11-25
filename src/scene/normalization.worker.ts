import {classifySceneFamilies} from './palette.ts';
import {unmetNormalizationConstraints,planSceneNormalization,sampleScenePixels,transformScenePixels,analyzeScenePixels,type NormalizationPreferences} from './normalization.ts';
const scope=globalThis as unknown as {onmessage:(event:MessageEvent<{pixels:Uint8ClampedArray;kind?:'families';preferences:NormalizationPreferences;sample?:Uint8ClampedArray}>)=>void;postMessage:(value:unknown,transfer:Transferable[])=>void};
scope.onmessage=({data:{pixels,preferences,sample,kind}})=>{
 if(kind==='families'){try{const indices=classifySceneFamilies(pixels);scope.postMessage({indices},[indices.buffer]);}catch(error){scope.postMessage({error:String(error)},[]);}return;}
 try{const report=planSceneNormalization(sample??sampleScenePixels(pixels),preferences);
  if(report.changed){transformScenePixels(pixels,report.corrections,pixels);report.after=analyzeScenePixels(sampleScenePixels(pixels));}
  report.unmet=unmetNormalizationConstraints(report.after,preferences,report.balanceAvailable);
  scope.postMessage({pixels,report},[pixels.buffer]);
 }catch(error){scope.postMessage({error:error instanceof Error?error.message:'Scene normalization failed.'},[]);}
};
