import {connectionFailure,DraftConflictError,requestFailure} from './errors.ts';
export async function draftRequest(query='',method='GET',body?:unknown){
 for(let attempt=0;;attempt++){
  let response:Response;
  try{response=await fetch(`/api/draft${query}`,{method,headers:{'content-type':body instanceof Blob?body.type:'application/json'},body:body instanceof Blob?body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(30000)});}
  catch(error){throw Error(connectionFailure(error));}
  if(response.status===429&&query.startsWith('?asset=')&&attempt<3){await response.body?.cancel();await new Promise(resolve=>setTimeout(resolve,1000*2**attempt));continue;}
  if(response.status===409)throw new DraftConflictError();
  if(!response.ok){const value=await response.json().catch(()=>null);throw Error(![413,429,546].includes(response.status)&&typeof value?.error==='string'?value.error:requestFailure(response.status));}return response;
 }
}
