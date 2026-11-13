import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioResponse,defaultAudioResponse,createAudioMeasurement,RESPONSE_HZ,ATTACK_SECONDS,RELEASE_SECONDS} from '../src/scene/audioResponse.ts';
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);
const settings=()=>({version:2,lightMax:2,bounceMax:.4,cooldownMs:1000});
function hit(engine,at,amplitude=.1,pattern=0){if(at>0)engine.sample(0,at-1/60,pattern);engine.sample(amplitude,at,pattern);return engine.read(at+ATTACK_SECONDS);}

test('same pattern is blocked from its last reaction; rejected repeats do not restart cooldown',()=>{
 const e=createAudioResponse(settings());assert.equal(hit(e,0).reacted,true);
 for(const t of [.2,.4,.6,.8,.98])assert.equal(hit(e,t).reacted,false);
 assert.equal(hit(e,1).reacted,true);assert.equal(hit(e,1.2).reacted,false);
 assert.equal(hit(e,2).reacted,true);
});
test('different patterns have independent timers, and neighboring signatures remain blocked',()=>{
 const e=createAudioResponse(settings());assert.equal(hit(e,0,.1,9).reacted,true);
 assert.equal(hit(e,.1,.1,18).reacted,false);
 assert.equal(hit(e,.2,.1,63).reacted,true);
 assert.equal(hit(e,.3,.1,9).reacted,false);assert.equal(hit(e,.4,.1,63).reacted,false);
});
test('attack strength is proportional to absolute intensity, rather than relative rise size',()=>{
 const e=createAudioResponse({...settings(),cooldownMs:0});hit(e,0,.2);
 const r=hit(e,1,.1);assert.equal(r.intensity,.5);near(r.light,1);near(r.bounce,.2);
 e.sample(.11,2);e.read(2+ATTACK_SECONDS);assert.ok(Math.abs(e.result.light-1.1)<1e-12);assert.ok(Math.abs(e.result.bounce-.22)<1e-12);
});
test('recent strongest input reaches both configured maxima and adapts after it ages out',()=>{
 const e=createAudioResponse(settings());let r=hit(e,0,.8);near(r.light,2);near(r.bounce,.4);
 r=hit(e,2,.08);assert.ok(Math.abs(r.light-.2)<1e-12);
 e.sample(0,8.1);r=hit(e,9,.08);near(r.light,2);near(r.bounce,.4);
});
test('faint detail is not discarded by a loudness cutoff; silence causes no reaction',()=>{
 const e=createAudioResponse(settings());hit(e,0,.1,0);
 const r=hit(e,1,.00001,63);assert.equal(r.reacted,true);assert.ok(r.light>0&&r.light<.001);
 e.reset();assert.equal(e.sample(0,0).reacted,false);assert.equal(e.result.light,0);
});
test('steady levels do not hold or retrigger effects, and delayed reads release by elapsed time',()=>{
 const e=createAudioResponse(settings());hit(e,0);
 for(let i=1;i<120;i++){e.sample(.1,i/60);assert.equal(e.result.reacted,false);}
 assert.equal(e.result.light,0);near(e.result.bounce,0);
 e.reset();hit(e,0);e.sample(.1,.75);assert.ok(e.result.light<.0003);
});
test('zero cooldown allows every new attack; changing cooldown retains accepted timestamps',()=>{
 const e=createAudioResponse({...settings(),cooldownMs:0});assert.equal(hit(e,0).reacted,true);assert.equal(hit(e,.1).reacted,true);
 e.configure({...settings(),cooldownMs:2000});assert.equal(hit(e,1).reacted,false);
 assert.equal(hit(e,2.1).reacted,true);
});
test('muted effects do not consume a reaction timer and settings edits do not manufacture attacks',()=>{
 const e=createAudioResponse({...settings(),lightMax:0,bounceMax:0});assert.equal(hit(e,0).reacted,false);
 e.configure(settings());assert.equal(e.result.light,0);assert.equal(hit(e,.1).reacted,true);
 e.configure({...settings(),lightMax:0});assert.equal(e.result.light,0);near(e.result.bounce,.4);
 e.configure(settings());assert.equal(e.result.light,0);assert.equal(hit(e,.2).reacted,false);
});
test('a long sampling gap expires intensity history without prematurely clearing a longer cooldown',()=>{
 const e=createAudioResponse({...settings(),cooldownMs:10000});assert.equal(hit(e,0).reacted,true);
 assert.equal(hit(e,9).reacted,false);assert.equal(hit(e,10).reacted,true);
 e.reset();assert.equal(hit(e,0).reacted,true);
});
test('sample slots are frame-independent and invalid input cannot inject an effect',()=>{
 const a=createAudioResponse(settings()),b=createAudioResponse(settings());
 for(let i=0;i<1200;i++){const level=i%6<3?.1:0;a.sample(level,i/60,18);b.sample(level,i/60,18);b.sample(.9,i/60+.0001,63);}
 assert.deepEqual(a.result,b.result);a.reset();a.sample(NaN,0);assert.equal(a.result.reacted,false);
 a.sample(Infinity,1);assert.equal(a.result.light,0);a.sample(.1,NaN);assert.equal(a.result.light,0);
});
test('stereo measurement preserves opposite-phase energy and uses a reused result',()=>{
 const measure=createAudioMeasurement();let r=measure([new Float32Array([.5,-.5]),new Float32Array([-.5,.5])],48000);
 assert.equal(r.rms,.5);const before=r;
 r=measure([new Float32Array([1,1]),new Float32Array([0,0])],48000);assert.equal(r,before);assert.ok(Math.abs(r.rms-Math.SQRT1_2)<1e-12);
});
test('coarse waveform signatures distinguish separated patterns and survive volume changes',()=>{
 const measure=createAudioMeasurement(),wave=(hz,gain)=>new Float32Array(Array.from({length:512},(_,i)=>gain*Math.sin(2*Math.PI*hz*i/48000)));
 const low=measure([wave(110,.2),wave(110,.2)],48000).pattern;
 const quieter=measure([wave(110,.02),wave(110,.02)],48000).pattern;
 const high=measure([wave(4000,.2),wave(4000,.2)],48000).pattern;
 assert.equal(low,quieter);assert.ok(Math.abs(Math.floor(low/8)-Math.floor(high/8))>1);
});
test('long sessions keep bounded outputs and fixed result storage',()=>{
 const e=createAudioResponse(settings()),result=e.result;
 for(let i=0;i<60000;i++){assert.equal(e.sample((i%137)/136,i/RESPONSE_HZ,i%64),result);assert.ok(result.light>=0&&result.light<=2&&result.bounce>=0&&result.bounce<=.4&&result.intensity>=0&&result.intensity<=1);}
 assert.deepEqual(defaultAudioResponse(1.5,1.2),{version:2,lightMax:1.5,bounceMax:.2,cooldownMs:1000});
});
test('even quiet dominant attacks reach the chosen maximum without an artificial gain floor',()=>{
 const e=createAudioResponse(settings());const r=hit(e,0,.00001);assert.equal(r.intensity,1);near(r.light,2);near(r.bounce,.4);
});
test('permitted reactions rise smoothly instead of jumping to the maximum',()=>{
 const e=createAudioResponse(settings());e.sample(.1,0);
 assert.equal(e.read(0).light,0);
 assert.ok(Math.abs(e.read(ATTACK_SECONDS/2).light-1)<1e-12);
 assert.equal(e.read(ATTACK_SECONDS).light,2);
 assert.ok(2-e.read(ATTACK_SECONDS+.001).light<.0002);
 near(e.read(ATTACK_SECONDS+RELEASE_SECONDS/2).light,1);
 assert.equal(e.read(ATTACK_SECONDS+RELEASE_SECONDS).light,0);
});
test('render-time release changes between audio samples and is independent of refresh rate',()=>{
 const a=createAudioResponse(settings()),b=createAudioResponse(settings());a.sample(.1,0);b.sample(.1,0);
 for(let i=1;i<120;i++){
  const t=i/120;const output=b.read(t).light;
  if(i%2===0)assert.equal(a.read(t).light,output);
 }
 const e=createAudioResponse(settings());e.sample(.1,0);
 assert.ok(e.read(ATTACK_SECONDS+.051).light>e.read(ATTACK_SECONDS+.055).light);
});
test('a new permitted attack starts from the existing tail without a discontinuity',()=>{
 const e=createAudioResponse({...settings(),cooldownMs:0});e.sample(.1,0);e.sample(0,.05);
 const t=4/60,before=e.read(t).light;e.sample(.1,t,63);
 assert.equal(e.read(t).light,before);assert.ok(e.read(t+ATTACK_SECONDS/2).light>before);
 near(e.read(t+ATTACK_SECONDS).light,2);
});
