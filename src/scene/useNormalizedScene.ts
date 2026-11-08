import {useEffect,useState} from 'react';
import {normalizeSceneBlob} from './normalizationCache.ts';
import {normalizationKey,type NormalizationPreferences,type NormalizationReport} from './normalization.ts';
export function useNormalizedScene(original:Blob|null,preferences:NormalizationPreferences,persistent=true){
 const key=normalizationKey(preferences),enabled=preferences.enabled;
 const [state,setState]=useState<{source:Blob;key:string;url:string;report:NormalizationReport;cached:boolean}|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();let url:string|undefined;setState(null);setError('');
  if(original&&enabled)void normalizeSceneBlob(original,preferences,controller.signal,persistent).then(result=>{
   if(controller.signal.aborted)return;url=URL.createObjectURL(result.blob);setState({source:original,key,url,report:result.report,cached:result.cached});
  }).catch(failure=>{if(!controller.signal.aborted)setError(failure instanceof Error?failure.message:'Normalization unavailable; using original.');});
  return ()=>{controller.abort();if(url)URL.revokeObjectURL(url);};
 },[original,key,enabled,persistent]);
 const valid=enabled&&state?.source===original&&state.key===key?state:null;
 return {url:valid?.url??null,report:valid?.report??null,cached:valid?.cached??false,busy:!!original&&enabled&&!valid&&!error,error};
}
