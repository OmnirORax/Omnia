// Opt-in direct website playback check; this revision requires fresh browser approval.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/.test(m.text()))errors.push(m.text());});
const origin=process.env.ATLAS_URL||'http://127.0.0.1:5183';
function quietTone(){const rate=48000,n=rate*8,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(Math.sin(i/rate*Math.PI*110)*.04*32767),44+i*2);return b;}
try{
 await page.addInitScript(()=>{
 localStorage.setItem('omnium.workspace.settings.v1',JSON.stringify({appearance:{theme:'classic',motion:0,glow:0,effectIntensity:0},sceneVfx:{audioLight:'#aa3300',audioBounce:1.12,waves:false,distortion:0,glitching:0,pulseFrequencyMin:0,pulseFrequencyMax:15,pulseExponent:1,pulseAudioHigh:.1}}));
 window.captureRequests=0;
 for(const name of ['getDisplayMedia','getUserMedia'])if(navigator.mediaDevices)navigator.mediaDevices[name]=async()=>{window.captureRequests++;throw Error('Browser capture must not be requested');};
 window.audioUniforms={};
 for(const Type of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){
 if(!Type)continue;const locations=new WeakMap(),get=Type.prototype.getUniformLocation,set=Type.prototype.uniform1f;
 Type.prototype.getUniformLocation=function(program,name){const location=get.call(this,program,name);if(location)locations.set(location,name);return location;};
 Type.prototype.uniform1f=function(location,value){const name=locations.get(location);if(name==='light'||name==='bounce')window.audioUniforms[name]=value;return set.call(this,location,value);};
 }
 });
 await page.goto(origin);await page.getByRole('button',{name:'+ Add first node',exact:true}).click();
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');for(const [i,color]of ['#b4743b','#5066bb','#dd7700','#008844'].entries()){ctx.fillStyle=color;ctx.fillRect(i%2*64,Math.floor(i/2)*64,64,64);}return c.toDataURL().split(',')[1];});
 const imageChooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Choose image',exact:true}).click();await(await imageChooser).setFiles({name:'disposable-colour-patches.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
 await page.getByText(/Image saved and assigned/).waitFor();
 const audioChooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Choose audio file',exact:true}).click();await(await audioChooser).setFiles({name:'quiet-55hz.wav',mimeType:'audio/wav',buffer:quietTone()});
 await page.getByRole('button',{name:'Play audio',exact:true}).click();
 await page.waitForFunction(()=>window.audioUniforms.light>.02&&window.audioUniforms.bounce>1.005);
 const local=await page.evaluate(async()=>({signal:(await import('/src/scene/audio.ts')).sampleSceneAudio(),uniforms:{...window.audioUniforms},meter:document.querySelector('meter').value}));assert.ok(local.signal.active&&local.meter>.1,JSON.stringify(local));assert.equal(await page.evaluate(()=>window.captureRequests),0,'no tab/screen/microphone capture');
 // Detaching the controls' media view must retain the same app-owned player/session.
 const retained=await page.evaluate(async()=>{const a=await import('/src/scene/audio.ts'),player=a.sceneAudioSnapshot().player;a.parkSceneAudioPlayer(player);await new Promise(r=>setTimeout(r,150));const active=a.sampleSceneAudio();return {active,paused:player.paused};});assert.ok(retained.active.active&&!retained.paused);
 await page.getByRole('button',{name:'Stop audio',exact:true}).click();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',local,checks:'direct playback drives pulse/bounce, retains playback across controls closing, never requests capture'}));
}finally{await browser.close();}
