import type {SupabaseClient} from '@supabase/supabase-js';
/** App-origin transport retains both Cloudflare Access and Supabase account checks. */
export async function accountRequest<T>(client:SupabaseClient,route:'account-cloud'|'account-workspace',body:unknown,current:()=>boolean=()=>true):Promise<T>{
 if(!current())throw Error('Account changed.');const {data,error}=await client.auth.getSession();if(!current())throw Error('Account changed.');if(error||!data.session)throw Error('Sign in first.');
 if(typeof location!=='undefined'&&['localhost','127.0.0.1'].includes(location.hostname)){const {data:result,error:failure}=await client.functions.invoke(route==='account-cloud'?'backend':'account-workspace',{body:JSON.stringify(body),headers:{'content-type':'application/json'}});if(!current())throw Error('Account changed.');if(failure||result?.error||!result||!('data'in result))throw Error(result?.error?.message??result?.error??'Cloud operation failed.');return result.data as T;}
 const response=await fetch(`/api/${route}`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 const result=await response.json().catch(()=>null);if(!response.ok||result?.error||!result||!('data'in result))throw Error(typeof result?.error==='string'?result.error:result?.error?.message??'Cloud operation failed.');return result.data as T;
}
