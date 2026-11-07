// Opt-in: focused check authorized for this scene VFX delivery; no standing browser-suite permission.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const origin=process.env.ATLAS_URL||'http://127.0.0.1:5183';
function tone(){const rate=48000,samples=rate*4,b=Buffer.alloc(44+samples*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples*2,40);for(let i=0;i<samples;i++)b.writeInt16LE(Math.round(Math.sin(i/rate*Math.PI*2*55)*.65*32767),44+i*2);return b;}
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&/shader|WebGLProgram/i.test(message.text()))errors.push(message.text());});
try{
 await page.addInitScript(value=>{window.testTone=value;},tone().toString('base64'));
 await page.goto(origin);await page.getByRole('button',{name:'Scene effects',exact:true}).waitFor();
 const defaults=await page.evaluate(async()=>{const {defaultSettings}=await import('/src/workspaceActions.ts');return defaultSettings().sceneVfx;});
 assert.deepEqual(Object.fromEntries(Object.entries(defaults).filter(([k])=>['audioLight','audioBounce','waves','distortion','glitching','maxFps'].includes(k))),{audioLight:'#aa3300',audioBounce:1.12,waves:true,distortion:.4,glitching:.3,maxFps:120});
 assert.ok((await page.locator('body').innerText()).includes('Audio Light'));
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Choose audio file',exact:true}).click();await(await chooser).setFiles({name:'disposable-55hz.wav',mimeType:'audio/wav',buffer:tone()});
 await page.getByRole('button',{name:'Play audio',exact:true}).click();await page.getByText('Audio file connected',{exact:true}).waitFor();
 await page.waitForTimeout(350);
 const signal=await page.evaluate(async()=>{const audio=await import('/src/scene/audio.ts');return audio.sampleSceneAudio();});assert.ok(signal.active&&signal.bass>.1&&signal.level>.1,JSON.stringify(signal));
 await page.getByRole('button',{name:'Stop audio',exact:true}).click();
 assert.equal(await page.evaluate(async()=>(await import('/src/scene/audio.ts')).isSceneAudioConnected()),false);
 // Exercise the actual wallpaper renderer in a disposable harness without the atlas effects stack.
 await page.route('**/vfx-harness',route=>route.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));await page.goto(origin+'/vfx-harness');
 await page.mouse.click(5,5);
 const result=await page.evaluate(async()=>{
 const THREE=await import('/node_modules/three/build/three.module.js');const {createWallpaper}=await import('/src/scene/wallpaper.ts');const {DEFAULT_SCENE_VFX,serializeSceneVfx}=await import('/src/scene/vfx.ts');const audio=await import('/src/scene/audio.ts');
 const renderer=new THREE.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(256,256);document.body.append(renderer.domElement);const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();let paints=0;
 const wallpaper=createWallpaper(scene,()=>{paints++;renderer.render(scene,camera);},renderer);wallpaper.resize(256,256);
 const image=document.createElement('canvas');image.width=image.height=128;const ctx=image.getContext('2d');for(let y=0;y<128;y++)for(let x=0;x<128;x++){ctx.fillStyle=`rgb(${x*2},${y*2},${(Math.floor(x/8)+Math.floor(y/8))%2*255})`;ctx.fillRect(x,y,1,1);}
 wallpaper.configure({...DEFAULT_SCENE_VFX,waves:false,distortion:0,glitching:0});await wallpaper.setURL(image.toDataURL());renderer.render(scene,camera);const plain=renderer.domElement.toDataURL();
 wallpaper.configure(DEFAULT_SCENE_VFX);await new Promise(r=>setTimeout(r,350));const effected=renderer.domElement.toDataURL();
 wallpaper.configure({...DEFAULT_SCENE_VFX,waves:false,distortion:0,glitching:0});renderer.render(scene,camera);const restored=renderer.domElement.toDataURL();
 const local=document.createElement('audio');const bytes=atob(window.testTone);local.src=URL.createObjectURL(new Blob([Uint8Array.from(bytes,c=>c.charCodeAt(0))],{type:'audio/wav'}));local.loop=true;
 await audio.connectSceneAudioElement(local);await local.play();await new Promise(r=>setTimeout(r,150));wallpaper.configure({...DEFAULT_SCENE_VFX,waves:false,distortion:0,glitching:0});await new Promise(r=>setTimeout(r,300));const reactive=renderer.domElement.toDataURL();
 local.pause();audio.disconnectSceneAudio();URL.revokeObjectURL(local.src);wallpaper.dispose();const disposedPaints=paints;await new Promise(r=>setTimeout(r,100));renderer.dispose();
 return {plain,effected,restored,reactive,disposedPaints,paints,programs:renderer.info.programs?.length,serialized:JSON.parse(serializeSceneVfx({...DEFAULT_SCENE_VFX,privateSource:'must-not-save'}))};
 });
 assert.notEqual(result.plain,result.effected,'wave/VHS shader changes patterned image');assert.equal(result.plain,result.restored,'zero effects restores original image');assert.notEqual(result.plain,result.reactive,'actual test-tone audio changes the rendered wallpaper');assert.equal(result.paints,result.disposedPaints,'disposed wallpaper stops animation');assert.deepEqual(Object.keys(result.serialized).sort(),Object.keys(defaults).sort());assert.deepEqual(errors,[]);
 console.log('Focused scene VFX browser check passed: defaults, local audio spectrum, shader compilation, displacement, audio response, original restoration, whitelisted scene/light tuning serialization and disposal.');
}finally{await browser.close();}
