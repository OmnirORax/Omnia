import {createClient,type SupabaseClient} from '@supabase/supabase-js';
export function publicBackendConfig(env:Record<string,string|undefined>){
 const url=String(env.VITE_SUPABASE_URL??'').trim(),key=String(env.VITE_SUPABASE_PUBLISHABLE_KEY??'').trim();
 if(!url&&!key)return null;
 const fail=()=>{throw Error('Configure the Supabase project URL and public publishable key.');};
 if(!url||!key||key.startsWith('sb_secret_'))return fail();
 let parsed:URL;try{parsed=new URL(url);}catch{return fail();}
 if(parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/'||parsed.protocol!=='https:'&&!(parsed.protocol==='http:'&&['localhost','127.0.0.1'].includes(parsed.hostname)))return fail();
 if(!key.startsWith('sb_publishable_')){
  try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.role!=='anon')return fail();}catch{return fail();}
 }
 return {url,key,storageKey:`omnia.backend.auth.${parsed.host}`};
}
let client:SupabaseClient|undefined;
/** Explicit, lazy account client. Importing the module does not open a session. */
export function backendClient(){
 if(client)return client;
 const config=publicBackendConfig(import.meta.env??{});
 if(!config)throw Error('Online accounts are not configured.');
 return client=createClient(config.url,config.key,{auth:{storageKey:config.storageKey,detectSessionInUrl:false}});
}
