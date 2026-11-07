import {startupFailureSummary} from './backend-start-diagnostics.mjs';
/** Only isolated CI image-registry throttling is retryable. Health, SQL, config,
 * permissions and unknown failures keep their original immediate failure. */
export async function startBackendWithRetries({attempt,wait,report=()=>{}}){
 const delays=[15000,45000];
 for(let index=0;;index++){
  const result=await attempt(index+1),status=result.status??1;
  if(status===0)return {status:0,attempts:index+1};
  const summary=startupFailureSummary(result.log);
  if(summary!=='Container image registry rate limit was reached.'||index>=delays.length)return {status,attempts:index+1,summary};
  report({attempt:index+1,next:index+2,maximum:3,delay:delays[index],summary});
  await wait(delays[index]);
 }
}
