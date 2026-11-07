// Focused bright-colour/full-bloom regression; requires explicit user approval to run.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
try{
 await page.route('**/headroom-check',r=>r.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));await page.goto((process.env.ATLAS_URL||'http://127.0.0.1:5183')+'/headroom-check');
 const result=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{createWallpaper}=await import('/src/scene/wallpaper.ts'),{createSceneAppearance}=await import('/src/sceneAppearance.ts'),{defaultSettings}=await import('/src/workspaceActions.ts');
 const source=['#000000','#02081a','#006bd6','#0044aa','#bb6600','#ff9900','#fff0cd','#d6a246','#00bb55','#cc3355'];
 const image=document.createElement('canvas');image.width=source.length*128;image.height=128;const ctx=image.getContext('2d');source.forEach((colour,i)=>{ctx.fillStyle=colour;ctx.fillRect(i*128,0,128,128);});
 const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(image.width,image.height);const scene=new T.Scene(),camera=new T.PerspectiveCamera(),wallpaper=createWallpaper(scene,()=>{}),appearance=createSceneAppearance(renderer,scene,camera);
 wallpaper.resize(image.width,image.height);wallpaper.configure({...defaultSettings().sceneVfx,waves:false,distortion:0,glitching:0});await wallpaper.setURL(image.toDataURL());
 const configure=()=>{appearance.configure({...defaultSettings().appearance,theme:'classic',motion:0,effectIntensity:0,glow:0});appearance.configure({...defaultSettings().appearance,theme:'neon',motion:0,effectIntensity:0,glow:.22});appearance.resize(image.width,image.height);};configure();
 const material=scene.children.find(o=>o.material?.uniforms?.light).material,u=material.uniforms;
 const pixels=()=>{appearance.render();const gl=renderer.getContext();return source.map((_,i)=>{const p=new Uint8Array(4);gl.readPixels(i*128+64,64,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p].slice(0,3);});};
 u.light.value=0;const base=pixels(),peaks={};for(const target of ['#ff9900','#0044ff','#00bb55','#cc3355']){u.lightColor.value.set(target);u.light.value=1;peaks[target]=pixels();}
 const shader=material.fragmentShader;
 material.fragmentShader=shader.replace('vec3 boosted=color*(1.0+(peak-value)/max(value,.00001));','vec3 boosted=color+color*response*3.0;').replace('vec3 halo=color*response*.12;','vec3 halo=color*response*3.0;');material.needsUpdate=true;configure();u.lightColor.value.set('#ff9900');const unboundedOrange=pixels();
 material.fragmentShader=shader;material.needsUpdate=true;configure();u.light.value=0;const restored=pixels();wallpaper.dispose();appearance.dispose();renderer.dispose();return {source,base,peaks,unboundedOrange,restored};
 });
 const hsv=rgb=>{const [r,g,b]=rgb.map(v=>v/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=d===0?0:max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4;return {h:h*60,s:max?d/max:0,v:max};};
 assert.ok(hsv(result.unboundedOrange[6]).s<.03,'reproduce the old near-white orange blowout');
 for(const [target,pixels]of Object.entries(result.peaks))for(let i=0;i<pixels.length;i++){
 const before=hsv(result.base[i]),after=hsv(pixels[i]);if(before.s>.15&&before.v>.15){
 assert.ok(after.s>=before.s-.04,`${target} washed ${result.source[i]} to ${pixels[i]}`);
 let hue=Math.abs(before.h-after.h);hue=Math.min(hue,360-hue);assert.ok(hue<5,`${target} shifted ${result.source[i]} by ${hue} degrees`);
 }
 if(i<2)assert.ok(pixels[i].every((v,c)=>Math.abs(v-result.base[i][c])<=3),'shadows stay unchanged');
 }
 assert.ok(result.peaks['#ff9900'][4][0]>result.base[4][0]+15,'midtone orange still flashes');assert.ok(result.peaks['#0044ff'][3][2]>result.base[3][2]+15,'midtone blue still flashes');
 assert.deepEqual(result.restored,result.base);assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',...result,checks:'old orange white-out reproduced; orange, blue, green and pink retain hue/saturation at peak through full bloom/output; midtone colour flashes; shadows/base preserved'}));
}finally{await browser.close();}
