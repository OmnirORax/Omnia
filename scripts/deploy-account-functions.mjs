import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';import {resolve} from 'node:path';
const ref='tqjjcabekjjmmspttbli';
export async function deployAccountFunctions({token,mode='plan',fetcher=fetch}){
 if(!token)throw Error('SUPABASE_ACCESS_TOKEN is missing.');if(!['plan','verify','apply'].includes(mode))throw Error('Choose plan, verify or apply.');
 const functions=['backend','account-workspace'];const bundled=[];
 for(const name of functions){
  const output=await build({entryPoints:[`supabase/functions/${name}/index.ts`],bundle:true,write:false,platform:'neutral',format:'esm',target:'es2023',external:['@supabase/supabase-js','three'],logLevel:'silent'});
  bundled.push({name,code:output.outputFiles[0].text});
 }
 if(mode==='plan')return {mode,functions:bundled.map(({name,code})=>({name,bytes:Buffer.byteLength(code)}))};
 const deployed=[];
 for(const {name,code} of bundled){
  const form=new FormData();form.append('metadata',JSON.stringify({name,entrypoint_path:'index.ts',import_map_path:'deno.json',verify_jwt:false}));
  form.append('file',new File([code],'index.ts',{type:'application/typescript'}));form.append('file',new File([JSON.stringify({imports:{'@supabase/supabase-js':'npm:@supabase/supabase-js@2.118.0',three:'npm:three@0.186.1'}})],'deno.json',{type:'application/json'}));
  const response=await fetcher(`https://api.supabase.com/v1/projects/${ref}/functions/deploy?slug=${name}${mode==='verify'?'&bundleOnly=true':''}`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form,signal:AbortSignal.timeout(180000)});
  if(!response.ok)throw Error(`Function ${name} deployment failed (HTTP ${response.status}).`);
  if(mode==='verify'){await response.arrayBuffer();deployed.push({name,verified:true});continue;}
  const result=await response.json();if(result.status!=='ACTIVE')throw Error(`Function ${name} is not active.`);deployed.push({name,version:result.version});
 }
 return {mode,deployed};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(await deployAccountFunctions({token:process.env.SUPABASE_ACCESS_TOKEN,mode:process.argv[2]??'plan'})));}catch(error){console.error(error.message);process.exitCode=1;}}
