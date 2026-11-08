import {useEffect,useRef,useState} from 'react';
import {normalizeSceneBlob} from './normalizationCache.ts';
import {normalizationKey,type NormalizationPreferences,type NormalizationReport} from './normalization.ts';
export function useNormalizedScene(original:Blob|null,preferences:NormalizationPreferences,persistent=true,preview=false){
 const key=normalizationKey(preferences),enabled=preferences.enabled,latest=useRef({preferences,key});latest.current={preferences,key};
 const urlRef=useRef<string|null>(null);
 const [state,setState]=useState<{source:Blob;key:string;url:string;report:NormalizationReport;cached:boolean;preview:boolean}|null>(null),[error,setError]=useState('');
 // While dragging, a serial latest-candidate queue lets work finish instead of
 // aborting every frame. Full-resolution work runs on committed values only.
 const requestKey=preview?'interactive':key;
 useEffect(()=>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,completed:string|undefined;setError('');
  const run=async()=>{
   if(!original||!enabled||controller.signal.aborted)return;
   const candidate=latest.current;
   if(candidate.key!==completed)try{
    setError('');const result=await normalizeSceneBlob(original,candidate.preferences,controller.signal,persistent&&!preview,preview?384:undefined);
    if(controller.signal.aborted)return;
    const url=URL.createObjectURL(result.blob),before=urlRef.current;urlRef.current=url;completed=candidate.key;
    setState({source:original,key:candidate.key,url,report:result.report,cached:result.cached,preview});if(before)URL.revokeObjectURL(before);
   }catch(failure){if(!controller.signal.aborted){completed=candidate.key;setState(null);setError(failure instanceof Error?failure.message:'Normalization unavailable; using original.');}}
   if(preview&&!controller.signal.aborted)timer=setTimeout(run,80);
  };
  if(original&&enabled)void run();
  return ()=>{controller.abort();if(timer)clearTimeout(timer);};
 },[original,requestKey,enabled,persistent,preview]);
 useEffect(()=>()=>{if(urlRef.current)URL.revokeObjectURL(urlRef.current);},[]);
 const valid=enabled&&state?.source===original?state:null;
 return {url:valid?.url??null,report:valid?.report??null,cached:valid?.cached??false,preview:valid?.preview??false,busy:!!original&&enabled&&(!valid||valid.key!==key||valid.preview!==preview)&&!error,error};
}
