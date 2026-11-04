import test from 'node:test';
import assert from 'node:assert/strict';
import {deployMetrics} from '../scripts/deploy-metrics.mjs';
const options={url:'https://tqjjcabekjjmmspttbli.supabase.co',token:'synthetic-token',mode:'plan'};
test('deployment refuses wrong projects, missing credentials and unknown modes before network work',async()=>{
 for(const change of [{url:'https://different.supabase.co'},{token:''},{mode:'reset'}])await assert.rejects(deployMetrics({...options,...change,fetcher:()=>{throw Error('Network should not run');}}));
});
test('plan is read-only and detects changed historical SQL',async()=>{
 const calls=[];
 const fetcher=async(_url,input)=>{calls.push(JSON.parse(input.body));return {ok:true,json:async()=>calls.length===1?[{history_exists:false}]:[]};};
 const result=await deployMetrics({...options,fetcher});assert.equal(result.pending.length,2);assert.ok(calls.every(call=>call.read_only));
 await assert.rejects(deployMetrics({...options,fetcher:async(_url,input)=>({ok:true,json:async()=>JSON.parse(input.body).query.includes('to_regclass')?[{history_exists:true}]:[{version:'20261104000100',statements:['changed']} ]})}),/history differs/);
});
test('apply uses the exact guarded installer and verifies deployment without creating test users',async()=>{
 const calls=[];
 await deployMetrics({...options,mode:'apply',fetcher:async(_url,input)=>{const body=JSON.parse(input.body);calls.push(body);return {ok:true,json:async()=>calls.length===1?[{history_exists:false}]:calls.length===3?[{authoring_ready:true,board_ready:true,claims_protected:true}]:[]};}});
 assert.equal(calls.filter(call=>!call.read_only).length,1);assert.match(calls[1].query,/begin;/);assert.match(calls[1].query,/Migration history differs/);assert.match(calls[2].query,/create_click_quest/);
});
test('management errors do not echo responses containing credentials',async()=>{
 await assert.rejects(deployMetrics({...options,fetcher:async()=>({ok:false,status:403,json:async()=>({secret:'synthetic-token'})})}),error=>error.message.includes('HTTP 403')&&!error.message.includes('synthetic-token'));
});
