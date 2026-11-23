import {verifyAccess} from '../cloud/access.ts';
export async function accountProxy(request:Request,endpoint:'backend'|'account-workspace',fetcher:typeof fetch=fetch){
 const url=new URL(request.url),token=request.headers.get('cf-access-jwt-assertion')??request.headers.get('cookie')?.split(';').map(value=>value.trim()).find(value=>value.startsWith('CF_Authorization='))?.slice('CF_Authorization='.length);
 if(!token||!await verifyAccess(token,fetcher,url.origin))return Response.json({error:'Access session unavailable. Reload Omnium.'},{status:401});
 if(request.method!=='POST')return new Response('',{status:405});
 if(request.headers.get('origin')!==url.origin)return new Response('',{status:403});
 const authorization=request.headers.get('authorization')??'';if(!authorization.startsWith('Bearer '))return Response.json({error:'Sign in first.'},{status:401});
 try{const result=await fetcher(`https://tqjjcabekjjmmspttbli.supabase.co/functions/v1/${endpoint}`,{method:'POST',headers:{authorization,'content-type':'application/json',origin:url.origin,'x-omnium-origin':url.origin,'x-omnium-access':token},body:request.body,signal:AbortSignal.timeout(60000)});return new Response(result.body,{status:result.status,headers:{'content-type':'application/json','cache-control':'no-store'}});}catch{return Response.json({error:'Cloud service unavailable.'},{status:503});}
}
