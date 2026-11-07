// Focused quiet website/shared-audio check explicitly approved by the user.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/.test(m.text()))errors.push(m.text());});
const origin=process.env.ATLAS_URL||'http://127.0.0.1:5183';
function quietTone(){const rate=48000,n=rate*8,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(Math.sin(i/rate*Math.PI*110)*.04*32767),44+i*2);return b;}
try{
 await page.addInitScript(()=>{
 localStorage.setItem('omnium.workspace.settings.v1',JSON.stringify({appearance:{theme:'classic',motion:0,glow:0,effectIntensity:0},sceneVfx:{audioLight:'#aa3300',audioBounce:1.12,waves:false,distortion:0,glitching:0}}));
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
 await page.locator('audio').click({position:{x:25,y:27}});await page.locator('audio').evaluate(el=>el.play());
 await page.waitForFunction(()=>window.audioUniforms.light>.02&&window.audioUniforms.bounce>1.005);
 const local=await page.evaluate(async()=>({signal:(await import('/src/scene/audio.ts')).sampleSceneAudio(),uniforms:{...window.audioUniforms},meter:document.querySelector('meter').value}));assert.ok(local.signal.active&&local.meter>.1,JSON.stringify(local));
 // Detaching the controls' media view must retain the same app-owned player/session.
 const retained=await page.evaluate(async()=>{const a=await import('/src/scene/audio.ts'),player=a.sceneAudioSnapshot().player;a.parkSceneAudioPlayer(player);await new Promise(r=>setTimeout(r,150));const active=a.sampleSceneAudio();return {active,paused:player.paused};});assert.ok(retained.active.active&&!retained.paused);
 await page.getByRole('button',{name:'Disconnect audio',exact:true}).click();
 // Real browser WebAudio stream through the same shared-audio command; only the OS picker is simulated.
 await page.evaluate(()=>{navigator.mediaDevices.getDisplayMedia=async()=>{const ctx=new AudioContext(),osc=ctx.createOscillator(),gain=ctx.createGain(),out=ctx.createMediaStreamDestination();osc.frequency.value=55;gain.gain.value=.04;osc.connect(gain).connect(out);osc.start();await ctx.resume();window.captureFixture={ctx,osc,out};return out.stream;};});
 await page.getByRole('button',{name:'Connect shared audio',exact:true}).click();await page.getByText('Shared audio connected',{exact:true}).waitFor();
 await page.waitForFunction(()=>window.audioUniforms.light>.02&&window.audioUniforms.bounce>1.005);
 const shared=await page.evaluate(async()=>(await import('/src/scene/audio.ts')).sampleSceneAudio());assert.ok(shared.active&&shared.level>.1,JSON.stringify(shared));
 await page.getByRole('button',{name:'Disconnect audio',exact:true}).click();await page.evaluate(()=>{window.captureFixture.osc.stop();void window.captureFixture.ctx.close();});
 assert.equal(await page.evaluate(async()=>(await import('/src/scene/audio.ts')).isSceneAudioConnected()),false);
 // Pixel-level selective hue response in the actual wallpaper shader.
 await page.route('**/colour-harness',r=>r.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));await page.goto(origin+'/colour-harness');
 const colours=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{createWallpaper}=await import('/src/scene/wallpaper.ts'),{DEFAULT_SCENE_VFX}=await import('/src/scene/vfx.ts');
 const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(128,128);const scene=new T.Scene(),camera=new T.PerspectiveCamera(),wallpaper=createWallpaper(scene,()=>{});wallpaper.resize(128,128);wallpaper.configure({...DEFAULT_SCENE_VFX,waves:false,distortion:0,glitching:0});
 const c=document.createElement('canvas');c.width=c.height=128;const paint=c.getContext('2d');for(const [i,colour]of ['#b4743b','#5066bb','#dd7700','#008844'].entries()){paint.fillStyle=colour;paint.fillRect(i%2*64,Math.floor(i/2)*64,64,64);}await wallpaper.setURL(c.toDataURL());
 const mesh=scene.children.find(o=>o.material?.uniforms?.light),u=mesh.material.uniforms,gl=renderer.getContext();const pixels=()=>{renderer.render(scene,camera);return [[32,96],[96,96],[32,32],[96,32]].map(([x,y])=>{const p=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p];});};
 u.light.value=0;const before=pixels();u.light.value=.7;const orange=pixels();wallpaper.configure({...DEFAULT_SCENE_VFX,audioLight:'#0044ff',waves:false,distortion:0,glitching:0});u.light.value=.7;const blue=pixels();
 const {SceneGlow}=await import('/src/sceneGlow.ts');const glow=new SceneGlow(scene,camera,0),original=mesh.material,mask=glow.mask(original,1);mesh.material=mask;wallpaper.configure({...DEFAULT_SCENE_VFX,audioLight:'#aa3300',waves:false,distortion:0,glitching:0});u.light.value=.7;const emission=pixels();u.light.value=.2;const quieterEmission=pixels();const originalPass=u.sceneGlowPass.value;mesh.material=original;glow.dispose();wallpaper.dispose();renderer.dispose();return {before,orange,blue,emission,quieterEmission,originalPass};
 });
 assert.notDeepEqual(colours.orange[0],colours.before[0],'orange range becomes more saturated');assert.notDeepEqual(colours.orange[2],colours.before[2],'nearby lighter orange also responds');assert.deepEqual(colours.orange[1],colours.before[1],'distant blue is not globally tinted');assert.deepEqual(colours.orange[3],colours.before[3],'distant green is unchanged');assert.notDeepEqual(colours.blue[1],colours.before[1],'selecting blue activates blue');assert.deepEqual(colours.blue[0],colours.before[0],'orange stays unchanged when blue is selected');assert.ok(colours.emission.every(p=>p.slice(0,3).every(c=>c===0)),'audio saturation has no bloom contribution');assert.deepEqual(colours.emission,colours.quieterEmission,'audio saturation never adds emission to bloom');assert.equal(colours.originalPass,0,'bloom never mutates normal rendering mode');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',local,shared,colours,checks:'quiet website playback reaches actual atlas light/bounce uniforms; view detach retains playback; real shared WebAudio stream drives effects; selective broad colour ranges preserve distant hues; disconnect cleans up'}));
}finally{await browser.close();}
