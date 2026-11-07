// Prepared saturation contract check. Run only with explicit user approval.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
try{
 await page.route('**/saturation-check',r=>r.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));await page.goto((process.env.ATLAS_URL||'http://127.0.0.1:5183')+'/saturation-check');
 const result=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{createWallpaper}=await import('/src/scene/wallpaper.ts'),{createSceneAppearance}=await import('/src/sceneAppearance.ts'),{defaultSettings}=await import('/src/workspaceActions.ts');
 const source=['#000000','#888888','#fff0cd','#b4743b','#ddb080','#5066bb','#80a0dd','#44aa77','#bb6677','#ff9900'];
 const image=document.createElement('canvas');image.width=source.length*128;image.height=128;const ctx=image.getContext('2d');source.forEach((colour,i)=>{ctx.fillStyle=colour;ctx.fillRect(i*128,0,128,128);});
 const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(image.width,image.height);const scene=new T.Scene(),camera=new T.PerspectiveCamera(),wallpaper=createWallpaper(scene,()=>{}),appearance=createSceneAppearance(renderer,scene,camera);
 const settings={...defaultSettings().sceneVfx,waves:false,distortion:0,glitching:0};wallpaper.resize(image.width,image.height);wallpaper.configure(settings);await wallpaper.setURL(image.toDataURL());
 appearance.configure({...defaultSettings().appearance,theme:'neon',motion:0,effectIntensity:0,glow:.22});appearance.resize(image.width,image.height);
 const material=scene.children.find(o=>o.material?.uniforms?.light).material,u=material.uniforms;
 const pixels=()=>{appearance.render();const gl=renderer.getContext();return source.map((_,i)=>{const p=new Uint8Array(4);gl.readPixels(i*128+64,64,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p].slice(0,3);});};
 u.light.value=0;const base=pixels(),peaks={};for(const target of ['#ff9900','#0044ff','#00bb55','#cc3355']){wallpaper.configure({...settings,audioLight:target});u.light.value=1;peaks[target]=pixels();}
 u.light.value=0;const restored=pixels();wallpaper.dispose();appearance.dispose();renderer.dispose();return {source,base,peaks,restored};
 });
 const hsv=rgb=>{const [r,g,b]=rgb.map(v=>v/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=d===0?0:max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4;return {h:h*60,s:max?d/max:0,v:max};};
 for(const [target,pixels]of Object.entries(result.peaks))for(let i=0;i<pixels.length;i++){
 const before=hsv(result.base[i]),after=hsv(pixels[i]);assert.ok(Math.abs(before.v-after.v)<=1/255,'peak channel value stays fixed');
 assert.ok(pixels[i].every((v,c)=>v<=result.base[i][c]+1),`${target} added light to ${result.source[i]}`);
 if(before.s>.15){let hue=Math.abs(before.h-after.h);hue=Math.min(hue,360-hue);assert.ok(hue<=2,'source hue stays fixed');}
 }
 assert.ok(hsv(result.peaks['#ff9900'][3]).s>hsv(result.base[3]).s+.1,'orange saturation increases');assert.ok(hsv(result.peaks['#0044ff'][5]).s>hsv(result.base[5]).s+.1,'blue saturation increases');
 assert.deepEqual(result.peaks['#ff9900'][5],result.base[5],'distant blue unaffected by orange');assert.deepEqual(result.peaks['#0044ff'][3],result.base[3],'distant orange unaffected by blue');assert.deepEqual(result.restored,result.base);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',...result,checks:'saturation increases in the selected hue family, visible hue/value stay fixed, no channel gains light through bloom/output, silence restores source'}));
}finally{await browser.close();}
