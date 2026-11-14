import {verifyAccess} from './access.ts';
import {connectionFailure,storageFailure} from './errors.ts';
import {checkedWorld,decodeBytes,decodeScene,encodeBytes,type SceneFile,sceneReferences} from '../core/transfer.ts';
import {imageSignatureMatches,isImageType,MAX_ASSET_BYTES} from '../scene/contracts.ts';
type Environment={url:string;key:string};
let assetBusy=false;
export async function draftServer(request:Request,env:Environment){
 const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
 if(!await verifyAccess(request.headers.get('x-omnium-access')??'',fetch,request.headers.get('x-omnium-origin')??undefined))return json({error:'Access session could not be verified. Reload this preview and retry.'},401);
 const db=async(path:string,method='GET',body?:unknown)=>{
  let response:Response;
  try{response=await fetch(`${env.url}/rest/v1/${path}`,{method,signal:AbortSignal.timeout(15000),headers:{apikey:env.key,authorization:`Bearer ${env.key}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}
  catch(error){throw Error(connectionFailure(error));}
  if(!response.ok)throw Error(storageFailure(response.status,await response.json().catch(()=>null)));
  return response.status===204?null:response.json();
 };
 let ownsAsset=false;
 try{
  const url=new URL(request.url),asset=url.searchParams.get('asset');
  if(asset&&!/^sha256:[a-f0-9]{64}$/.test(asset))return json({error:'Invalid asset.'},400);
  if(asset){if(assetBusy)return json({error:'Another image transfer is running. Wait a moment and retry.'},429);assetBusy=true;ownsAsset=true;}
  if(request.method==='GET'){
   if(asset){const rows=await db(`omnium_draft_assets?id=eq.${asset}&select=data,type`);if(!rows.length)return json({error:'Image unavailable.'},404);return new Response(decodeBytes(rows[0].data) as Uint8Array<ArrayBuffer>,{headers:{'content-type':rows[0].type,'cache-control':'private, max-age=31536000, immutable'}});}
   const rows=await db('omnium_site_draft?id=eq.1&select=revision,world');
   const state=rows[0];if(!state)return json({error:'Draft not initialized.'},503);
   checkedWorld(state.world);
   const references=[...sceneReferences(state.world)],assets=references.length?await db(`omnium_draft_assets?id=in.(${references.join(',')})&select=id,name,type`):[];
   return json({...state,version:1,assets});
  }
  if(request.method!=='PUT')return json({error:'Unsupported method.'},405);
  const type=request.headers.get('content-type')?.split(';')[0]??'',binary=!!asset&&isImageType(type);
  const limit=asset?(binary?MAX_ASSET_BYTES:14*1024*1024):4_100_000,reader=request.body?.getReader();if(!reader)return json({error:'Missing body.'},400);
  let buffer=new Uint8Array(Math.min(limit,65536)),size=0;
  for(;;){const next=await reader.read();if(next.done)break;if(size+next.value.length>limit){await reader.cancel();return json({error:'Draft exceeds size limit.'},413);}if(size+next.value.length>buffer.length){const grown=new Uint8Array(Math.min(limit,Math.max(size+next.value.length,buffer.length*2)));grown.set(buffer.subarray(0,size));buffer=grown;}buffer.set(next.value,size);size+=next.value.length;}
  const payload=binary?null:JSON.parse(new TextDecoder().decode(buffer.subarray(0,size)));
  if(asset){
   const bytes=binary?buffer.subarray(0,size):decodeScene(payload as SceneFile);
   if(binary&&(!isImageType(type)||!imageSignatureMatches(bytes,type)))return json({error:'Invalid workspace image bytes.'},400);
   const name=url.searchParams.get('name');
   if(binary&&(!name||name.length>120))return json({error:'Invalid image name.'},400);
   const file=binary?{id:asset,name:name!,type,data:encodeBytes(bytes)}:payload as SceneFile;
   const hash='sha256:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),n=>n.toString(16).padStart(2,'0')).join('');
   if(file.id!==asset||hash!==asset)return json({error:'Image identity mismatch.'},400);
   await db('rpc/omnium_put_draft_asset','POST',{asset_id:file.id,asset_name:file.name,asset_type:file.type,asset_data:file.data,asset_size:bytes.length});return json({saved:true});
  }
  if(payload.version!==1||!Number.isSafeInteger(payload.revision)||payload.revision<0)return json({error:'Unsupported draft format.'},400);
  const world=checkedWorld(payload.world),revision=await db('rpc/omnium_save_draft','POST',{expected:payload.revision,snapshot:world});
  return revision===null?json({error:'Draft changed in another session.'},409):json({revision});
 }catch(error){return json({error:error instanceof Error?error.message:'Draft unavailable.'},400);}
 finally{if(ownsAsset)assetBusy=false;}
}
