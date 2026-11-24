import test from 'node:test';import assert from 'node:assert/strict';
import {createWorkspaceContext} from '../src/backend/workspaceContext.ts';
import {privateSceneStorage} from '../src/backend/sceneLibrary.ts';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 let auth,actor='a',hold=false;const pending=[];
 const result=table=>({data:table==='workspaces'?[{id:`${actor}-1`,name:'First'},{id:`${actor}-2`,name:'Second'}]:[{workspace_id:`${actor}-1`,role:'owner'},{workspace_id:`${actor}-2`,role:'viewer'}],error:null});
 const query=table=>{const value=result(table);return hold?new Promise(resolve=>pending.push(()=>resolve(value))):Promise.resolve(value);};
 const client={auth:{getSession:async()=>({data:{session:{user:{id:actor}}}}),onAuthStateChange:fn=>{auth=fn;return{data:{subscription:{unsubscribe(){}}}};}},from:table=>({select:()=>({order:()=>({limit:()=>query(table)}),eq:()=>query(table)})})};
 const context=createWorkspaceContext(client);
 return{context,pending,setHold(value){hold=value;},switch(next){actor=next;auth('SIGNED_IN',next?{user:{id:next}}:null);}};
}
test('account, workspace transfers and images share one selection and its write permissions',async()=>{
 const f=fixture();await f.context.ready;await tick();const seen=[];const stop=f.context.subscribe(()=>seen.push(f.context.state.id));
 assert.equal(f.context.state.id,'a-1');assert.equal(f.context.state.canWrite,true);
 const current=f.context.current(),images=privateSceneStorage(f.context);f.context.select('a-2');
 assert.equal(current(),false);assert.equal(images.current(),false);assert.equal(f.context.state.canWrite,false);assert.deepEqual(seen,['a-2']);
 assert.throws(()=>images.remove({id:'stale'}),/changed/);assert.throws(()=>images.download({id:'stale'}),/changed/);
 const readonly=privateSceneStorage(f.context);assert.throws(()=>readonly.remove({id:'stale'}),/read-only/);
 stop();f.context.dispose();
});
test('late workspace refreshes cannot restore the previous account or its permissions',async()=>{
 const f=fixture();await f.context.ready;await tick();f.setHold(true);const old=f.context.refresh();
 f.switch('b');await tick();assert.equal(f.context.state.id,'');assert.deepEqual(f.context.state.workspaces,[]);
 for(const release of f.pending.splice(0,2))release();await old;
 assert.deepEqual(f.context.state.workspaces,[]);for(const release of f.pending.splice(0))release();await tick();
 assert.equal(f.context.state.id,'b-1');assert.equal(f.context.state.session.user.id,'b');f.context.dispose();
});
test('sign-out clears all consumers and disposed consumers cannot remain current',async()=>{
 const f=fixture();await f.context.ready;await tick();const valid=f.context.current();f.switch(null);await tick();
 assert.equal(valid(),false);assert.equal(f.context.state.canWrite,false);assert.equal(f.context.state.id,'');assert.deepEqual(f.context.state.workspaces,[]);
 const last=f.context.current();f.context.dispose();assert.equal(last(),false);
});
test('an auth sign-out event wins over an older initial session lookup',async()=>{
 let auth,resolve;const session=new Promise(done=>{resolve=done;});
 const context=createWorkspaceContext({auth:{getSession:()=>session,onAuthStateChange:fn=>{auth=fn;return{data:{subscription:{unsubscribe(){}}}};}},from(){throw Error('Stale session must not request workspaces');}});
 auth('SIGNED_OUT',null);resolve({data:{session:{user:{id:'old'}}}});await context.ready;await tick();
 assert.equal(context.state.session,null);assert.deepEqual(context.state.workspaces,[]);context.dispose();
});
