// Prepared source-pulse GPU contract check. Run only with explicit user approval.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
try{
 await page.route('**/pulse-check',r=>r.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));await page.goto((process.env.ATLAS_URL||'http://127.0.0.1:5183')+'/pulse-check');
 const result=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{createWallpaper}=await import('/src/scene/wallpaper.ts'),{createSceneAppearance}=await import('/src/sceneAppearance.ts'),{defaultSettings}=await import('/src/workspaceActions.ts');
 const image=document.createElement('canvas');image.width=256;image.height=64;const ctx=image.getContext('2d');
 const colours=['#304080','#aa7744','#fafafa','#000000'];colours.forEach((c,i)=>{ctx.fillStyle=c;ctx.fillRect(i*64,0,64,64);});
 const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(256,64);const scene=new T.Scene(),camera=new T.PerspectiveCamera(),wallpaper=createWallpaper(scene,()=>{},renderer),appearance=createSceneAppearance(renderer,scene,camera);
 const settings={...defaultSettings().sceneVfx,pulseColorMode:'tint',pulseTintLow:'#a8a8a8',pulseTintHigh:'#ffffff',waves:false,distortion:0,glitching:0};wallpaper.configure(settings);wallpaper.resize(256,64);await wallpaper.setURL(image.toDataURL());appearance.configure({...defaultSettings().appearance,theme:'neon',motion:0,effectIntensity:0,glow:.22});appearance.resize(256,64);
 const u=scene.children.find(o=>o.material?.uniforms?.light).material.uniforms;
 const samples=[];for(const pulse of [0,.5,1.2]){u.light.value=pulse;appearance.render();const gl=renderer.getContext();samples.push(colours.map((_,i)=>{const p=new Uint8Array(4);gl.readPixels(i*64+32,32,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p].slice(0,3);}));}
 wallpaper.dispose();appearance.dispose();renderer.dispose();return {colours,samples};
 });
 for(const [j,pulse]of [0,.5,1.2].entries())for(let i=0;i<result.colours.length;i++)for(let c=0;c<3;c++){
 const value=parseInt(result.colours[i].slice(1+c*2,3+c*2),16)/255,a=value*168/255;
 const expected=Math.round(Math.max(0,Math.min(1,a+(Math.min(a+value,1)-a)*pulse))*255);
 assert.ok(Math.abs(result.samples[j][i][c]-expected)<=2,`source blend differs at pulse ${pulse}, patch ${i}, channel ${c}`);
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',...result,checks:'actual shader through bloom/output matches supplied mode-9 equation at rest, intermediate pulse and 1.2; not a visual acceptance test'}));
}finally{await browser.close();}
