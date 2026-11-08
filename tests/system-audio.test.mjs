import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {decodePcmPacket,PcmQueue,pcmWorkletSource,systemAudioRequiresPairing,systemAudioOriginSupported} from '../src/scene/nativePcm.ts';
import {createNativeAudioTransport} from '../src/scene/nativeAudioTransport.ts';

function packet(values,rate=48000,channels=2,sequence=0){
 const out=new ArrayBuffer(16+values.length*4),v=new DataView(out);
 v.setUint32(0,0x31414d4f,true);v.setUint32(4,rate,true);v.setUint16(8,channels,true);v.setUint16(10,values.length/channels,true);v.setUint32(12,sequence,true);new Float32Array(out,16).set(values);return out;
}
test('PCM decoder rejects malformed/version/NaN input and preserves stereo format',()=>{
 const decoded=decodePcmPacket(packet([.25,-.25,.5,-.5]));assert.equal(decoded.rate,48000);assert.equal(decoded.channels,2);assert.deepEqual([...decoded.samples],[.25,-.25,.5,-.5]);
 for(const bad of [new ArrayBuffer(0),packet([NaN,0]),packet([0,0],0),packet([0,0]).slice(0,18)])assert.equal(decodePcmPacket(bad),undefined);
 const wrong=packet([0,0]);new DataView(wrong).setUint32(0,0,true);assert.equal(decodePcmPacket(wrong),undefined);
});
test('PCM queue resamples stereo, bounds backlog and clears stale sound on starvation',()=>{
 const queue=new PcmQueue(),pcm=Float32Array.from({length:2048},(_,i)=>i%2?-.5:.5);
 queue.push(pcm,2,48000);const left=new Float32Array(128),right=new Float32Array(128);queue.render(left,right,44100);assert.ok(left.every(x=>x===.5));assert.ok(right.every(x=>x===-.5));
 for(let i=0;i<100;i++)queue.push(pcm,2,48000);assert.ok(queue.count<=48000*.06);
 for(let i=0;i<50;i++)queue.render(left,right,44100);assert.ok(left.every(x=>x===0));assert.ok(right.every(x=>x===0));
 queue.push(pcm,2,48000);queue.clear();queue.render(left,right,48000);assert.ok(left.every(x=>x===0));
});
test('inline AudioWorklet runs the same queue, preserving mono input and explicit reset',()=>{
 let Processor;
 const context={Float32Array,Math,sampleRate:48000,AudioWorkletProcessor:class{port={};},registerProcessor:(_name,type)=>Processor=type};
 vm.runInNewContext(pcmWorkletSource(),context);const processor=new Processor(),out=[new Float32Array(128),new Float32Array(128)];
 processor.port.onmessage({data:{samples:new Float32Array(1024).fill(.125),channels:1,rate:48000}});assert.equal(processor.process([], [out]),true);assert.ok(out.every(channel=>channel.every(x=>x===.125)));
 processor.port.onmessage({data:{clear:true}});processor.process([], [out]);assert.ok(out.every(channel=>channel.every(x=>x===0)));
});
test('native transport ignores duplicate packets, reconnects and Stop cancels retry/clears PCM',()=>{
 const prior={WebSocket:globalThis.WebSocket,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
 const sockets=[],timers=new Map(),messages=[],states=[];let id=0,opens=0;
 class Socket{constructor(url){this.url=url;sockets.push(this);}close(){this.onclose?.();}}
 globalThis.WebSocket=Socket;globalThis.setTimeout=fn=>{timers.set(++id,fn);return id;};globalThis.clearTimeout=id=>timers.delete(id);globalThis.setInterval=()=>999;globalThis.clearInterval=()=>{};
 try{
  const transport=createNativeAudioTransport({postMessage:m=>messages.push(m)},(ready,message)=>states.push({ready,message}),'a'.repeat(32),()=>opens++);const socket=sockets[0];assert.equal(new URL(socket.url).searchParams.get('pair'),'a'.repeat(32));socket.onopen();assert.equal(opens,1);
  socket.onmessage({data:packet([.25,-.25],48000,2,8)});socket.onmessage({data:packet([.25,-.25],48000,2,8)});assert.equal(messages.filter(m=>m.samples).length,1);assert.equal(states.at(-1).ready,true);
  socket.onclose();assert.equal(states.at(-1).ready,false);assert.ok(messages.at(-1).clear);assert.equal(timers.size,1);
  [...timers.values()][0]();assert.equal(sockets.length,2);assert.equal(sockets[1].url,socket.url);sockets[1].onclose({code:4001});assert.ok(states.at(-1).message.includes('another Omnium tab'));transport.stop();assert.equal(timers.size,0);assert.ok(messages.at(-1).clear);
 }finally{Object.assign(globalThis,prior);}
});

test('system input feeds the existing analysers through a muted graph and releases everything on Stop',async()=>{
 const audio=await import('../src/scene/audio.ts'),{DEFAULT_SCENE_VFX}=await import('../src/scene/vfx.ts');
 const prior={window:globalThis.window,AudioContext:globalThis.AudioContext,AudioWorkletNode:globalThis.AudioWorkletNode,WebSocket:globalThis.WebSocket,localStorage:globalThis.localStorage};
 const contexts=[],sockets=[];let worklet;
 class Node{links=[];connect(next){this.links.push(next);return next;}disconnect(){this.links=[];}}
 class Context{
  state='running';sampleRate=48000;destination={};analysers=[];audioWorklet={addModule:async()=>{}};
  constructor(){contexts.push(this);}
  resume(){return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
  createChannelSplitter(){return new Node();}createGain(){this.mute=Object.assign(new Node(),{gain:{value:1}});return this.mute;}
  createAnalyser(){const a=Object.assign(new Node(),{fftSize:2048,frequencyBinCount:1024,getByteFrequencyData:b=>{b.fill(0);b[2]=240;},getByteTimeDomainData:b=>b.fill(150)});this.analysers.push(a);return a;}
 }
 class Worklet extends Node{port={messages:[],postMessage(m){this.messages.push(m);},close(){this.closed=true;}};constructor(_context,name,options){super();assert.equal(name,'omnium-system-pcm');assert.deepEqual(options.outputChannelCount,[2]);worklet=this;}}
 class Socket{constructor(url){this.url=url;sockets.push(this);}close(){this.closed=true;}}
 const events=new Map(),saved=new Map();globalThis.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
 globalThis.window={location:{origin:'https://omnium.nexus'},addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)};globalThis.AudioContext=Context;globalThis.AudioWorkletNode=Worklet;globalThis.WebSocket=Socket;
 try{
  globalThis.window.location.origin='https://raw.githack.com';
  await assert.rejects(audio.connectSceneSystemAudio(),/pairing code/);assert.equal(contexts.length,0);
  await audio.connectSceneSystemAudio('a'.repeat(32));assert.equal(new URL(sockets[0].url).searchParams.get('pair'),'a'.repeat(32));assert.ok(!JSON.stringify(audio.sceneAudioSnapshot()).includes('a'.repeat(32)));assert.equal(audio.isSceneAudioConnected(),false);const socket=sockets[0];socket.onopen();socket.onmessage({data:packet([.25,-.25])});
  assert.equal(audio.sceneAudioSnapshot().kind,'system');assert.equal(audio.isSceneAudioConnected(),true);
  const ctx=contexts[0];assert.equal(ctx.mute.gain.value,0);assert.equal(ctx.analysers.length,3);assert.ok(worklet.links.includes(ctx.analysers[0]));assert.deepEqual(ctx.analysers[0].links,[ctx.mute]);
  assert.ok(audio.sampleScenePulse(DEFAULT_SCENE_VFX)>0);assert.ok(audio.sampleSceneAudio().bassAmplitude>0);assert.ok(audio.sampleSceneAudio().level>0);
  const count=worklet.port.messages.length;ctx.state='suspended';socket.onmessage({data:packet([.25,-.25],48000,2,1)});assert.equal(worklet.port.messages.length,count,'suspended worklets must not accumulate PCM messages');
  ctx.state='running';socket.onmessage({data:packet([.25,-.25],48000,2,2)});assert.ok(worklet.port.messages.at(-2).clear,'resumption discards stale queued sound');
  audio.stopSceneAudio();assert.equal(audio.isSceneAudioConnected(),false);assert.equal(ctx.state,'closed');assert.ok(socket.closed);assert.ok(worklet.port.closed);assert.equal(audio.sampleScenePulse(DEFAULT_SCENE_VFX),0);
  const pref=await import('../src/scene/systemAudioPreference.ts');assert.equal(pref.readSystemAudioPreference().enabled,false);
  pref.saveSystemAudioPreference('a'.repeat(32),true);
  const uninstall=audio.startRememberedSystemAudio();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(sockets.length,2);assert.equal(new URL(sockets[1].url).searchParams.get('pair'),'a'.repeat(32));
  let resumed=0;contexts[1].state='suspended';contexts[1].resume=()=>{resumed++;return Promise.resolve();};events.get('pointerdown')();assert.equal(resumed,1);
  audio.forgetSceneSystemAudio();assert.equal(pref.readSystemAudioPreference(),null);assert.ok(sockets[1].closed);events.get('pointerdown')();assert.equal(resumed,1);
  uninstall();assert.equal(events.size,0);
 }finally{audio.disposeSceneAudio();Object.assign(globalThis,prior);}
});

test('preview requires explicit pairing while unrelated origins remain unsupported',()=>{
 assert.equal(systemAudioRequiresPairing('https://raw.githack.com'),true);
 for(const origin of ['https://pr-61.omnia-web-bae.pages.dev','https://a1234567.omnia-web-bae.pages.dev']){
  assert.equal(systemAudioRequiresPairing(origin),true);assert.equal(systemAudioOriginSupported(origin),true);
 }
 for(const origin of ['https://pr-61.omnia-web-bae.pages.dev.evil.test','https://other.pages.dev','https://omnia-web-bae.pages.dev','http://pr-61.omnia-web-bae.pages.dev','https://pr-61.omnia-web-bae.pages.dev:443','https://a.b.omnia-web-bae.pages.dev'])assert.equal(systemAudioOriginSupported(origin),false);
 for(const origin of ['https://raw.githack.com','https://omnium.nexus','http://localhost:5173'])assert.equal(systemAudioOriginSupported(origin),true);
 for(const origin of ['https://unrelated.example','https://raw.githack.com.evil.test','null'])assert.equal(systemAudioOriginSupported(origin),false);
 assert.equal(systemAudioRequiresPairing('https://omnium.nexus'),false);
});

test('remembered pairing persists across module/page callers, Stop pauses and Forget removes it; unknown versions survive',async()=>{
 const pref=await import('../src/scene/systemAudioPreference.ts');
 const previous=globalThis.localStorage,values=new Map();
 globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 try{
  assert.equal(pref.readSystemAudioPreference(),null);
  assert.equal(pref.saveSystemAudioPreference('a'.repeat(32),true),true);
  assert.deepEqual(pref.readSystemAudioPreference(),{version:1,code:'a'.repeat(32),enabled:true});
  pref.pauseRememberedSystemAudio();assert.equal(pref.readSystemAudioPreference().enabled,false);assert.equal(pref.readSystemAudioPreference().code,'a'.repeat(32));
  pref.forgetSystemAudioPreference();assert.equal(pref.readSystemAudioPreference(),null);
  const unknown=JSON.stringify({version:2,code:'new format'});values.set(pref.SYSTEM_AUDIO_PREFERENCE_KEY,unknown);
  assert.equal(pref.readSystemAudioPreference(),null);assert.equal(pref.saveSystemAudioPreference('a'.repeat(32),true),false);assert.equal(values.get(pref.SYSTEM_AUDIO_PREFERENCE_KEY),unknown);
 }finally{globalThis.localStorage=previous;}
});
