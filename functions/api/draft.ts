/** Access issues the assertion; the Supabase endpoint verifies its signature/audience. */
import {connectionFailure} from '../../src/cloud/errors.ts';
export async function onRequest({request}:{request:Request}){
 const url=new URL(request.url),token=request.headers.get('cf-access-jwt-assertion')??request.headers.get('cookie')?.split(';').map(value=>value.trim()).find(value=>value.startsWith('CF_Authorization='))?.slice('CF_Authorization='.length);
 if(!token)return Response.json({error:'Access session unavailable. Reload Omnium and try again.'},{status:401});
 if(!['GET','PUT'].includes(request.method))return new Response('',{status:405});
 if(request.method==='PUT'&&request.headers.get('origin')!==url.origin)return new Response('',{status:403});
 try{
  const upstream=await fetch(`https://tqjjcabekjjmmspttbli.supabase.co/functions/v1/site-draft${url.search}`,{
   method:request.method,headers:{'x-omnium-access':token,'x-omnium-origin':url.origin,'content-type':request.headers.get('content-type')??'application/json'},body:request.method==='PUT'?request.body:undefined,
  });
  return new Response(upstream.body,{status:upstream.status,headers:{'content-type':upstream.headers.get('content-type')??'application/json','cache-control':'no-store'}});
 }catch(error){return Response.json({error:connectionFailure(error)},{status:502,headers:{'cache-control':'no-store'}});}
}
