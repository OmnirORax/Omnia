import test from 'node:test';
import assert from 'node:assert/strict';
import {initialLocalQuests,addLocalQuest,recordLocalResult,claimLocalQuest,validateLocalQuests,loadLocalQuests,saveLocalQuests} from '../src/metrics/localQuests.ts';
test('offline authoring, completion and one-time stars need no account or network',()=>{
 const initial=initialLocalQuests();let data=addLocalQuest(initial,10,7,'authored');
 assert.equal(data.quests.length,4);assert.equal(addLocalQuest(data,10,7,'duplicate'),data);
 const result={actorId:'local',benchmarkId:'primary-7s-v1',reason:'timeout',elapsedMs:7000,clicks:11};
 assert.throws(()=>claimLocalQuest(data,'authored'));
 assert.equal(recordLocalResult(data,{...result,interrupted:true}),data);
 data=recordLocalResult(data,result);data=claimLocalQuest(data,'authored');
 assert.equal(data.claims.length,1);assert.equal(claimLocalQuest(data,'authored'),data);
 assert.deepEqual(validateLocalQuests(JSON.parse(JSON.stringify(data))),data);assert.equal(initial.claims.length,0);
});
test('saved local progress survives reload; newer/corrupt data and stale writes preserve originals',()=>{
 let text=null;globalThis.localStorage={getItem:()=>text,setItem:(_key,value)=>{text=value;}};
 const first=loadLocalQuests();text=saveLocalQuests(first.data,first.original);assert.deepEqual(loadLocalQuests().data,first.data);
 assert.throws(()=>saveLocalQuests(first.data,null),/another tab/);
 const newer=JSON.stringify({...first.data,version:99});text=newer;assert.throws(()=>loadLocalQuests());assert.equal(text,newer);
 text='broken';assert.throws(()=>loadLocalQuests());assert.equal(text,'broken');delete globalThis.localStorage;
});
