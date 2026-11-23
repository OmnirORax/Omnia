import test from 'node:test';
import assert from 'node:assert/strict';
import {createInfinitySystem} from '../src/metrics/system.ts';
import {publicBackendConfig} from '../src/backend/client.ts';
function fixture(){
 let listener,time=0;const calls=[];
 const board={benchmarks:[{id:'primary-5s-v1',seconds:5}],quests:[],claims:[],best:{}};
 const client={auth:{onAuthStateChange:cb=>{listener=cb;return {data:{subscription:{unsubscribe(){listener=undefined;}}}};},getSession:async()=>({data:{session:{user:{id:'account-a'}}}}),signOut:async()=>{listener('SIGNED_OUT',null);return {};},signInWithPassword:async()=>({})},rpc:async(name,args)=>{calls.push([name,args]);return {data:name==='click_quest_board'?board:name==='begin_click_attempt'?{id:args.p_id,user_id:'account-a',benchmark_id:args.p_benchmark}:null,error:null};}};
 const system=createInfinitySystem(client,()=>time);
 return {system,calls,advance:ms=>{time+=ms;},account:id=>listener('SIGNED_IN',id?{user:{id}}:null)};
}
test('public backend configuration refuses privileged keys and preserves the existing auth storage owner',()=>{
 assert.equal(publicBackendConfig({}),null);
 for(const key of ['sb_secret_fake','not-a-key'])assert.throws(()=>publicBackendConfig({VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:key}));
 assert.throws(()=>publicBackendConfig({VITE_SUPABASE_URL:'https://user:password@example.com',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fake'}));
 assert.equal(publicBackendConfig({VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fake'}).storageKey,'omnia.backend.auth.example.supabase.co');
});
test('online attempts use the server benchmark, submit once, and clear on account changes',async()=>{
 const f=fixture();try{
  await f.system.ready;await f.system.beginOnline({id:'primary-5s-v1',seconds:999});
  assert.equal(f.system.tracker.getSnapshot().options.durationSeconds,5);
  f.system.tracker.click();f.advance(5000);f.system.tracker.tick();const result=f.system.tracker.getSnapshot().results[0];
  await Promise.all([f.system.submit(result),f.system.submit(result)]);await f.system.submit(result);
  assert.equal(f.calls.filter(([name])=>name==='finish_click_attempt').length,1);
  f.account('account-b');assert.equal(f.system.tracker.getSnapshot().results.length,0);
  await assert.rejects(f.system.submit(result),/eligible/);
 }finally{f.system.dispose();}
});
test('account changes reject a late leaderboard response and signed-out requests never reach RPC',async()=>{
 const f=fixture();try{
  await f.system.ready;const request=f.system.standings('primary-5s-v1');f.account('account-b');
  await assert.rejects(request,/Account changed/);
  f.account(null);const count=f.calls.length;await assert.rejects(f.system.board(),/Sign in/);assert.equal(f.calls.length,count);
 }finally{f.system.dispose();}
});
