import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioResponse,defaultAudioResponse,responseStrength,RESPONSE_HZ,HISTORY_SECONDS,LOUDNESS_BINS} from '../src/scene/audioResponse.ts';
import {curveValue,makeCurve,CURVE_POINTS} from '../src/properties/curve.ts';
import {paintCurve} from '../src/ui/curve.ts';
const flat=value=>makeCurve(()=>value);
const constantResponse=()=>({version:1,light:{loudness:flat(1),recurrence:flat(1)},bounce:{loudness:flat(1),recurrence:flat(1)}});

test('curve interpolation includes both ends and independently shapes loudness and recurrence',()=>{
 const response={loudness:makeCurve(x=>x),recurrence:makeCurve(x=>1-x)};
 assert.equal(curveValue(response.loudness,0),0);assert.equal(curveValue(response.loudness,1),1);
 assert.ok(Math.abs(responseStrength(response,.8,.75)-.2)<1e-12);
 assert.equal(responseStrength({loudness:flat(1),recurrence:flat(1)},0,0),0);
});
test('drawing a range includes its endpoints, clamps strength and preserves other points',()=>{
 const source=flat(.5),next=paintCurve(source,{x:3/15,y:0},{x:10/15,y:1});
 assert.equal(next[3],0);assert.equal(next[10],1);assert.equal(next[2],.5);assert.equal(next[11],.5);
 assert.equal(source[3],.5);assert.ok(paintCurve(source,{x:10/15,y:1},{x:3/15,y:0}).every((v,i)=>Math.abs(v-next[i])<1e-12));
 assert.equal(paintCurve(source,{x:0,y:-10})[0],0);assert.equal(paintCurve(source,{x:1,y:10})[CURVE_POINTS-1],1);
});
test('loudness follows input amplitude on a fixed -60 to 0 dB scale',()=>{
 const engine=createAudioResponse(constantResponse());
 assert.equal(engine.sample(.001,0).loudness,0);
 assert.ok(Math.abs(engine.sample(.01,1/60).loudness-1/3)<1e-12);
 assert.ok(Math.abs(engine.sample(.1,2/60).loudness-2/3)<1e-12);
 assert.equal(engine.sample(1,3/60).loudness,1);
});
test('repetition is elapsed-time occupancy of similar loudness, not spectral pitch',()=>{
 const engine=createAudioResponse(constantResponse());
 const first=engine.sample(.1,0).recurrence;assert.equal(first,1/(RESPONSE_HZ*HISTORY_SECONDS));
 for(let i=1;i<RESPONSE_HZ*HISTORY_SECONDS;i++)engine.sample(.1,i/RESPONSE_HZ);
 assert.equal(engine.result.recurrence,1);
 for(let i=480;i<960;i++)engine.sample(i%6===0?.1:0,i/RESPONSE_HZ);
 assert.ok(Math.abs(engine.result.counts.reduce((a,b)=>a+b,0)/engine.result.samples-1/6)<1e-12);
});
test('the same loudness can fade with repetition while another curve retains it',()=>{
 const settings=constantResponse();settings.light.recurrence=makeCurve(x=>1-x);
 const engine=createAudioResponse(settings);engine.sample(.1,0);
 const rare=engine.result.light;
 for(let i=1;i<600;i++)engine.sample(.1,i/60);
 assert.ok(engine.result.light<rare*.01);assert.ok(engine.result.bounce>.99);
});
test('a muted loudness range contributes nothing, with independent light and bounce settings',()=>{
 const settings=constantResponse();settings.light.loudness=flat(0);
 const engine=createAudioResponse(settings);
 for(let i=0;i<60;i++)engine.sample(.1,i/60);
 assert.equal(engine.result.light,0);assert.ok(engine.result.bounce>.99);
});
test('silence and invalid levels release output and never create a new pulse',()=>{
 const engine=createAudioResponse(constantResponse());
 for(let i=0;i<10;i++)engine.sample(1,i/60);
 for(let i=10;i<160;i++)engine.sample(i%2?NaN:0,i/60);
 assert.equal(engine.result.light,0);assert.equal(engine.result.bounce,0);assert.equal(engine.result.loudness,0);
 engine.reset();assert.equal(engine.sample(Infinity,0).light,0);
});
test('duplicate render/frame reads cannot increase repetition or change response',()=>{
 const a=createAudioResponse(),b=createAudioResponse();
 for(let i=0;i<1000;i++){
  a.sample(i%7<2?.1:0,i/60);b.sample(i%7<2?.1:0,i/60);b.sample(.9,i/60+.0001);
 }
 assert.deepEqual(a.result,b.result);
});
test('history ages out, large gaps reset, and missing samples are not invented',()=>{
 const e=createAudioResponse();e.sample(.1,0);e.sample(.1,1);
 assert.equal(e.result.counts.reduce((a,b)=>a+b,0),2);
 e.sample(.1,20);assert.equal(e.result.recurrence,1/480);
 e.sample(.1,0);assert.equal(e.result.recurrence,1/480);
 e.reset();assert.equal(e.result.light,0);assert.equal(e.result.counts.reduce((a,b)=>a+b,0),0);
});
test('live configuration preserves recent history and takes effect without waiting for adaptation',()=>{
 const e=createAudioResponse();for(let i=0;i<30;i++)e.sample(.1,i/60);
 const before=e.result.recurrence,settings=defaultAudioResponse();settings.light.loudness=flat(0);
 e.configure(settings);assert.equal(e.result.recurrence,before);assert.equal(e.result.light,0);
});
test('long sessions keep fixed storage, a reused output object and bounded values',()=>{
 const e=createAudioResponse(),result=e.result,counts=result.counts;
 for(let i=0;i<60000;i++){const r=e.sample((i%137)/136,i/60);assert.equal(r,result);assert.equal(r.counts,counts);assert.ok(r.light>=0&&r.light<=1&&r.bounce>=0&&r.bounce<=1&&r.recurrence>=0&&r.recurrence<=1);}
 assert.equal(counts.length,LOUDNESS_BINS);assert.ok(counts.reduce((a,b)=>a+b,0)<=480);
});
test('loudness combines stereo energy without cancellation or channel-maximum bias',async()=>{
 const {rmsLevel}=await import('../src/scene/audioResponse.ts');
 assert.equal(rmsLevel([new Float32Array([.5,-.5]),new Float32Array([-.5,.5])]),.5);
 assert.ok(Math.abs(rmsLevel([new Float32Array([1,1]),new Float32Array([0,0])])-Math.SQRT1_2)<1e-12);
 assert.equal(rmsLevel([new Float32Array([0,0])]),0);assert.equal(rmsLevel([]),0);
});
