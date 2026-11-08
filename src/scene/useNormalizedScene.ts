import {useEffect,useRef,useState} from 'react';
import {createNormalizationProcessor,normalizeSceneBlob} from './normalizationCache.ts';
import {normalizationKey,type NormalizationPreferences,type NormalizationReport} from './normalization.ts';
export function useNormalizedScene(original:Blob|null,preferences:NormalizationPreferences,persistent=true,preview=false){
 const key=normalizationKey(preferences),enabled=preferences.enabled,latest=useRef({preferences,key});latest.current={preferences,key};
 const urlRef=useRef<string|null>(null);
 const [state,setState]=useState<{source:Blob;key:string;url:string|null;canvas:HTMLCanvasElement|null;report:NormalizationReport;cached:boolean;preview:boolean}|null>(null),[error,setError]=useState('');
 // While dragging, a serial latest-candidate queue lets work finish instead of
 // aborting every frame. Full-resolution work runs on committed values only.
 const requestKey=preview?'interactive':key,kick=useRef<()=>void>(()=>{}),previousMode=useRef<{source:Blob|null;preview:boolean}|null>(null);
 useEffect(()=>{
  const fromDrag=previousMode.current?.source===original&&previousMode.current.preview&&!preview;previousMode.current={source:original,preview};
  const catchUp=fromDrag&&(state?.source!==original||state.key!==key);
  const controller=new AbortController(),processor=createNormalizationProcessor();let completed:string|undefined,running=false;setError('');
  const run=async()=>{
   if(!original||!enabled||controller.signal.aborted||running)return;
   const candidate=latest.current;if(candidate.key===completed)return;running=true;
   try{
    setError('');
    // A short drag may finish before its first worker result. Publish its final
    // small frame before starting the full-size commit, rather than waiting for PNG.
    for(const small of catchUp?[true,false]:[preview]){
     const result=await normalizeSceneBlob(original,candidate.preferences,{signal:controller.signal,persistent:persistent&&!small,maxEdge:small?384:undefined,processor});
     if(controller.signal.aborted)return;
     const url=result.canvas?null:URL.createObjectURL(result.blob),before=urlRef.current;completed=candidate.key;
     if(url)urlRef.current=url;
     setState({source:original,key:candidate.key,url,canvas:result.canvas??null,report:result.report,cached:result.cached,preview:small});if(url&&before)URL.revokeObjectURL(before);
    }
   }catch(failure){if(!controller.signal.aborted){completed=candidate.key;setState(null);setError(failure instanceof Error?failure.message:'Normalization unavailable; using original.');}}
   finally{running=false;}
   if(preview&&!controller.signal.aborted&&latest.current.key!==completed)void run();
  };
  kick.current=run;void run();
  return ()=>{controller.abort();processor.dispose();if(kick.current===run)kick.current=()=>{};};
 },[original,requestKey,enabled,persistent,preview]);
 useEffect(()=>{kick.current();},[key]);
 useEffect(()=>()=>{if(urlRef.current)URL.revokeObjectURL(urlRef.current);urlRef.current=null;},[original,enabled]);
 const valid=enabled&&state?.source===original&&(!state.url||state.url===urlRef.current)?state:null;
 return {url:valid?.url??null,canvas:valid?.canvas??null,report:valid?.report??null,cached:valid?.cached??false,preview:valid?.preview??false,busy:!!original&&enabled&&(!valid||valid.key!==key||valid.preview!==preview)&&!error,error};
}
