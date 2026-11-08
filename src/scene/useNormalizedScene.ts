import {useEffect,useRef,useState} from 'react';
import {createNormalizationProcessor,normalizeSceneBlob} from './normalizationCache.ts';
import {normalizationKey,type NormalizationPreferences,type NormalizationReport} from './normalization.ts';
export function useNormalizedScene(original:Blob|null,preferences:NormalizationPreferences,persistent=true,preview=false){
 const key=normalizationKey(preferences),enabled=preferences.enabled,latest=useRef({preferences,key});latest.current={preferences,key};
 const [state,setState]=useState<{source:Blob;key:string;report:NormalizationReport;cached:boolean;preview:boolean}|null>(null),[error,setError]=useState('');
 // While dragging, a serial latest-candidate queue lets work finish instead of
 // aborting every frame. Full-resolution pixel processing runs on committed values only.
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
    // correction preview before starting the full-size commit, rather than waiting for PNG.
    for(const fast of catchUp?[true,false]:[preview]){
     const result=await normalizeSceneBlob(original,candidate.preferences,{signal:controller.signal,persistent:persistent&&!fast,preview:fast,processor});
     if(controller.signal.aborted)return;
     completed=candidate.key;
     setState({source:original,key:candidate.key,report:result.report,cached:result.cached,preview:fast});
    }
   }catch(failure){if(!controller.signal.aborted){completed=candidate.key;setState(null);setError(failure instanceof Error?failure.message:'Normalization unavailable; using original.');}}
   finally{running=false;}
   if(preview&&!controller.signal.aborted&&latest.current.key!==completed)void run();
  };
  kick.current=run;void run();
  return ()=>{controller.abort();processor.dispose();if(kick.current===run)kick.current=()=>{};};
 },[original,requestKey,enabled,persistent,preview]);
 useEffect(()=>{kick.current();},[key]);
 const valid=enabled&&state?.source===original?state:null;
 return {report:valid?.report??null,cached:valid?.cached??false,preview:valid?.preview??false,busy:!!original&&enabled&&(!valid||valid.key!==key||valid.preview!==preview)&&!error,error};
}
