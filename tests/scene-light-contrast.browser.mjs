// User-approved focused original-versus-blue-peak comparison through the real output/bloom stack.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
try{
 await page.route('**/contrast-check',r=>r.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));await page.goto((process.env.ATLAS_URL||'http://127.0.0.1:5183')+'/contrast-check');
 const result=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{createWallpaper}=await import('/src/scene/wallpaper.ts'),{createSceneAppearance}=await import('/src/sceneAppearance.ts'),{defaultSettings}=await import('/src/workspaceActions.ts');
 const source=['#000000','#02081a','#00163d','#d6a246','#006bd6','#0044aa'];
 const image=document.createElement('canvas');image.width=576;image.height=96;const ctx=image.getContext('2d');source.forEach((colour,i)=>{ctx.fillStyle=colour;ctx.fillRect(i*96,0,96,96);});
 const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(576,96);const scene=new T.Scene(),camera=new T.PerspectiveCamera(),wallpaper=createWallpaper(scene,()=>{}),appearance=createSceneAppearance(renderer,scene,camera);
 wallpaper.resize(576,96);wallpaper.configure({...defaultSettings().sceneVfx,audioLight:'#0044ff',waves:false,distortion:0,glitching:0});await wallpaper.setURL(image.toDataURL());
 appearance.configure({...defaultSettings().appearance,theme:'neon',motion:0,effectIntensity:0,glow:.22});appearance.resize(576,96);
 const material=scene.children.find(o=>o.material?.uniforms?.light).material,u=material.uniforms;
 const pixels=()=>{appearance.render();const gl=renderer.getContext();return source.map((_,i)=>{const p=new Uint8Array(4);gl.readPixels(i*96+48,48,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p];});};
 u.light.value=0;const base=pixels();u.light.value=1;const peak=pixels();
 const shader=material.fragmentShader;
 material.fragmentShader=shader.replace('vec3 emission=color*match*light*highlights*3.0;',`vec3 chroma=color/max(.025,value); vec3 chosen=lightColor/max(.025,max(lightColor.r,max(lightColor.g,lightColor.b))); vec3 emission=mix(chroma,chosen,.25)*match*light*(.2+.8*value)*1.6;`);material.needsUpdate=true;
 // The bloom cache uses the original material; replace its source for a fresh prior-version comparison.
 appearance.configure({...defaultSettings().appearance,theme:'classic',motion:0,effectIntensity:0,glow:0});appearance.configure({...defaultSettings().appearance,theme:'neon',motion:0,effectIntensity:0,glow:.22});
 const oldPeak=pixels();
 material.fragmentShader=shader;material.needsUpdate=true;appearance.configure({...defaultSettings().appearance,theme:'classic',motion:0,effectIntensity:0,glow:0});appearance.configure({...defaultSettings().appearance,theme:'neon',motion:0,effectIntensity:0,glow:.22});u.light.value=0;const restored=pixels();
 wallpaper.dispose();appearance.dispose();renderer.dispose();return {source,base,peak,oldPeak,restored};
 });
 const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 for(let i=0;i<result.source.length;i++)for(let c=0;c<3;c++)assert.ok(Math.abs(result.base[i][c]-rgb(result.source[i])[c])<=2,`base source changed at patch ${i}, channel ${c}: ${JSON.stringify(result)}`);
 assert.ok(result.oldPeak[1][2]>result.base[1][2]+25,'reproduce prior dark-blue haze');
 for(const i of [0,1,2,3])for(let c=0;c<3;c++)assert.ok(Math.abs(result.peak[i][c]-result.base[i][c])<=4,`shadow/non-target patch ${i} lifted: ${JSON.stringify(result)}`);
 assert.ok(result.peak[4][1]>result.base[4][1]+20,'bright blue/cyan detail must flash strongly');
 assert.deepEqual(result.restored,result.base,'silence restores the unaltered source through bloom/output');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',...result,checks:'reproduced old blue haze; base matches source; shadows and non-target gold preserved; bright blue/cyan flashes; silence restores base through full bloom/output'}));
}finally{await browser.close();}
