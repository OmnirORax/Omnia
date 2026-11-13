import test from 'node:test';
import assert from 'node:assert/strict';
import {createPulseBandSampler,referencePulse,PULSE_FFT_SIZE} from '../src/scene/pulse.ts';
import {createAudioResponse,ATTACK_SECONDS} from '../src/scene/audioResponse.ts';
import {normalizeSceneVfx,serializeSceneVfx} from '../src/scene/vfx.ts';
import bindings from '../src/scene/vfx.function.ts';
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
const config=()=>({version:2,lightMax:1.5,bounceMax:.15,cooldownMs:1000});

test('V1 log bands retain stereo separation, isolate high-frequency content and reuse storage',()=>{
 const sample=createPulseBandSampler(48000),left=new Uint8Array(PULSE_FFT_SIZE/2),right=new Uint8Array(PULSE_FFT_SIZE/2);
 left.fill(255);const bands=sample([left,right]);assert.equal(bands.length,32);
 for(let i=0;i<16;i++){near(bands[i],1);near(bands[i+16],0);}
 left.fill(0);left[600]=255;assert.equal(sample([left,right]),bands);
 assert.ok(bands[15]>0);for(let i=0;i<15;i++)assert.equal(bands[i],0);
 left.fill(0);right.fill(255);sample([left,right]);for(let i=0;i<16;i++){near(bands[i],0);near(bands[i+16],1);}
});
test('first/last band selection excludes unrelated content and averages both stereo channels',()=>{
 const bands=new Float32Array(32);bands[14]=bands[15]=bands[30]=bands[31]=1;
 near(referencePulse(bands,14,15,0,1,1,2),2);near(referencePulse(bands,0,13,0,1,1,2),0);
 bands[30]=bands[31]=0;near(referencePulse(bands,14,15,0,1,1,2),1);
 near(referencePulse(bands,15,14,0,1,1,2),1);
});
test('lower/upper threshold, exponent and amount each change the band response; silence stays dark',()=>{
 const bands=new Float32Array(32).fill(.25),value=(low,high,power,amount)=>referencePulse(bands,14,15,low,high,power,amount);
 near(value(0,1,1,2),.3125);near(value(.3,1,1,2),0);near(value(0,.25,1,2),2);
 near(value(0,1,2,2),.048828125);near(value(0,1,1,1),.15625);
 near(value(0,1,0,2),2);near(referencePulse(new Float32Array(32),14,15,0,1,0,2),0);
});
test('band attacks drive light even when waveform loudness is unchanged, without stealing bounce timers',()=>{
 const e=createAudioResponse(config());e.sample(.2,0,0,0);near(e.read(ATTACK_SECONDS).bounce,.15);near(e.result.light,0);
 e.sample(.2,.4,0,1);near(e.read(.4+ATTACK_SECONDS).light,1);near(e.result.bounce,0);
 e.sample(0,.9,0,0);e.sample(.2,1,0,0);near(e.read(1+ATTACK_SECONDS).bounce,.15);
 e.sample(.2,1.2,0,1);near(e.read(1.2+ATTACK_SECONDS).light,0);
 e.sample(.2,1.3,0,0);e.sample(.2,1.4,0,1);near(e.read(1.4+ATTACK_SECONDS).light,1);
 e.sample(0,1.9,0,0);e.sample(.2,2,0,0);near(e.read(2+ATTACK_SECONDS).bounce,.15);
});
test('band response respects light maximum, releases smoothly and rejects invalid values',()=>{
 const e=createAudioResponse(config());e.sample(.1,0,0,2);near(e.read(ATTACK_SECONDS).light,1.5);near(e.read(.3).light,0);
 for(const [at,value] of [[1,NaN],[2,Infinity],[3,-1]]){e.sample(.1,at,0,value);near(e.read(at+ATTACK_SECONDS).light,0);}
 e.sample(.1,4,0,.5);near(e.read(4+ATTACK_SECONDS).light,.5);e.reset();near(e.read(4+ATTACK_SECONDS).light,0);
});
test('all six original pulse controls write real settings and round-trip with tint and audio maxima',()=>{
 let state={sceneVfx:normalizeSceneVfx(undefined)};const response=structuredClone(state.sceneVfx.audioResponse);
 for(const [key,value] of Object.entries({pulseFrequencyMin:3,pulseFrequencyMax:9,pulseAudioLow:.1,pulseAudioHigh:.8,pulseExponent:2,pulseAmount:1.2,pulseTintLow:'#ffe4e1',pulseTintHigh:'#001122'})){
  state=bindings.inputs[`scene.${key}`].write(state,value);assert.equal(state.sceneVfx[key],value);
 }
 const restored=JSON.parse(serializeSceneVfx(state.sceneVfx));assert.deepEqual(restored,state.sceneVfx);assert.deepEqual(restored.audioResponse,response);
});
