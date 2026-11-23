import test from 'node:test';import assert from 'node:assert/strict';
import {emptyWorld} from '../src/core/model.ts';
import {privateSnapshot} from '../src/backend/workspaceSnapshot.ts';
import {accountWorkspaceServer} from '../src/backend/workspaceServer.ts';
import {accountRequest} from '../src/backend/request.ts';
import {deployCloud} from '../scripts/deploy-cloud.mjs';
const actor='00000000-0000-0000-0000-000000000001',workspace='00000000-0000-0000-0000-000000000002',requestId='00000000-0000-0000-0000-000000000003';
function snapshot(){const world=emptyWorld();delete world.scene.image;return {format:'omnium-v2-private-workspace',version:1,world,images:[]};}
const env={url:'https://example.supabase.co',key:'synthetic-server-key',origins:['https://omnium.nexus']};
const req=body=>new Request('https://example.supabase.co/functions/v1/account-workspace',{method:'POST',headers:{origin:'https://omnium.nexus',authorization:'Bearer synthetic-user-token','content-type':'application/json'},body:JSON.stringify(body)});
test('V2 snapshot validation rejects legacy formats and missing or unrelated scene references',()=>{
 assert.equal(privateSnapshot(snapshot()).world.format,'omnium-world');
 assert.throws(()=>privateSnapshot({format:'omnium-workspace',version:1,atlases:[]}));
 const value=snapshot();value.images=[{sceneId:'unrelated',assetId:actor}];assert.throws(()=>privateSnapshot(value));
});
test('private saves bind the actor to verified Auth and check editor access before service writes',async()=>{
 const calls=[];const fetcher=async(url,options)=>{calls.push([url,options]);if(url.endsWith('/auth/v1/user'))return Response.json({id:actor});if(url.includes('/workspace_members?'))return Response.json([{role:'editor'}]);if(url.includes('/rpc/save_account_workspace'))return Response.json({revision:1});throw Error('Unexpected request');};
 const response=await accountWorkspaceServer(req({workspaceId:workspace,requestId,expectedVersion:0,snapshot:snapshot(),actorId:'forged'}),env,fetcher);
 assert.equal(response.status,200);assert.equal(JSON.parse(calls.at(-1)[1].body).p_actor,actor);
 let wrote=false;const viewer=async url=>{if(url.endsWith('/auth/v1/user'))return Response.json({id:actor});if(url.includes('/workspace_members?'))return Response.json([{role:'viewer'}]);wrote=true;return Response.json({});};
 assert.equal((await accountWorkspaceServer(req({workspaceId:workspace,requestId,expectedVersion:0,snapshot:snapshot()}),env,viewer)).status,403);assert.equal(wrote,false);
});
test('invalid identities and stale writes produce safe errors without leaking server keys',async()=>{
 assert.equal((await accountWorkspaceServer(req({}),env,async()=>Response.json({}, {status:401}))).status,401);
 const response=await accountWorkspaceServer(req({workspaceId:workspace,requestId,expectedVersion:0,snapshot:snapshot()}),env,async url=>url.endsWith('/auth/v1/user')?Response.json({id:actor}):url.includes('/workspace_members?')?Response.json([{role:'owner'}]):Response.json({code:'23505',details:'synthetic-server-key'},{status:409}));
 assert.equal(response.status,409);assert.equal((await response.text()).includes('synthetic-server-key'),false);
});
test('account transport rejects cancellation while waiting for the current session',async()=>{
 let finish;const session=new Promise(resolve=>{finish=resolve;});let current=true;
 const call=accountRequest({auth:{getSession:()=>session}},'account-cloud',{},()=>current);current=false;finish({data:{session:{access_token:'synthetic'}}});await assert.rejects(call,/Account changed/);
});
test('cloud migration planning is read-only and checks all historical dependencies before the V2 delta',async()=>{
 const calls=[];const result=await deployCloud({url:'https://tqjjcabekjjmmspttbli.supabase.co',token:'synthetic',mode:'plan',fetcher:async(_url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>[{history_exists:false}]};}});
 assert.equal(result.pending.length,4);assert.ok(calls.every(call=>call.read_only));
});
test('partial V2 export choices survive cloud snapshot validation and invalid choices are rejected',()=>{
 const value=snapshot();value.parts={nodes:[],settings:true,scene:false,appearance:false,complete:false};
 assert.deepEqual(privateSnapshot(value).parts,value.parts);
 assert.throws(()=>privateSnapshot({...value,parts:{...value.parts,nodes:['unknown-node']}}));
 assert.throws(()=>privateSnapshot({...value,parts:{...value.parts,complete:'yes'}}));
});
