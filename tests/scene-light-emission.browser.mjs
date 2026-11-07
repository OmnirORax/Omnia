// Prepared coloured-emission contract check. Run only with explicit user approval.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
try{
 await page.route('**/emission-check',r=>r.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));await page.goto((process.env.ATLAS_URL||'http://127.0.0.1:5183')+'/emission-check');
 const result=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{createWallpaper}=await import('/src/scene/wallpaper.ts'),{createSceneAppearance}=await import('/src/sceneAppearance.ts'),{defaultSettings}=await import('/src/workspaceActions.ts');
 const source=['#997700','#c46800','#0033bb','#009944','#aa0055','#dddddd'];
 const image=document.createElement('canvas');image.width=1152;image.height=256;const ctx=image.getContext('2d');ctx.fillStyle='#080808';ctx.fillRect(0,0,image.width,image.height);source.forEach((colour,i)=>{ctx.fillStyle=colour;ctx.fillRect(i*192+64,96,64,64);});
 const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(image.width,image.height);const scene=new T.Scene(),camera=new T.PerspectiveCamera(),wallpaper=createWallpaper(scene,()=>{},renderer),appearance=createSceneAppearance(renderer,scene,camera);
 const settings={...defaultSettings().sceneVfx,waves:false,distortion:0,glitching:0,audioBounce:1,lightCoreStrength:1.1,lightNearStrength:.9,lightFarStrength:1.2,lightNearRadius:.35,lightFarRadius:1.2,lightGain:2,lightMix:.85,lightTintSaturation:1,lightHueInner:14.4,lightHueOuter:50.4,lightSourcePower:2,lightAudioGain:1.2,lightAudioPower:4};wallpaper.resize(image.width,image.height);wallpaper.configure(settings);await wallpaper.setURL(image.toDataURL());
 appearance.configure({...defaultSettings().appearance,theme:'neon',motion:0,effectIntensity:0,glow:.22});appearance.resize(image.width,image.height);
 const u=scene.children.find(o=>o.material?.uniforms?.light).material.uniforms;
 const pixels=()=>{appearance.render();const gl=renderer.getContext();const sample=(x,y)=>{const p=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p].slice(0,3);};return {cores:source.map((_,i)=>sample(i*192+96,128)),halos:source.map((_,i)=>sample(i*192+136,128)),distant:sample(16,16)};};
 u.light.value=0;const base=pixels(),peaks={};for(const target of ['#ffcc00','#ff8800','#2244ff','#00ff55','#ff3388','#ffffff']){wallpaper.configure({...settings,audioLight:target});u.light.value=1;peaks[target]=pixels();}
 wallpaper.configure({...settings,audioLight:'#ffcc00'});u.light.value=.2;const quiet=pixels();wallpaper.configure({...settings,lightAllColors:true});u.light.value=1;const allColours=pixels();wallpaper.configure(settings);u.light.value=0;const restored=pixels();wallpaper.dispose();appearance.dispose();renderer.dispose();return {source,base,peaks,quiet,allColours,restored};
 });
 const max=rgb=>Math.max(...rgb),sat=rgb=>max(rgb)?(max(rgb)-Math.min(...rgb))/max(rgb):0;
 for(const [target,index] of [['#ffcc00',0],['#ff8800',1],['#2244ff',2],['#00ff55',3],['#ff3388',4]]){
 const peak=result.peaks[target];assert.ok(max(peak.cores[index])>max(result.base.cores[index])+10,`${target} matching core must emit more light, including fully saturated sources`);
 assert.ok(max(peak.halos[index])>max(result.base.halos[index])+2,`${target} emission must spread beyond its source boundary`);
 assert.ok(sat(peak.halos[index])>.65,`${target} halo retains colour instead of white`);
 assert.ok(sat(peak.cores[index])>.65,`${target} core retains colour instead of white`);
 assert.deepEqual(peak.distant,result.base.distant,'no global exposure lift');assert.deepEqual(peak.cores[5],result.base.cores[5],'distant white is not an emitter for a chromatic target');
 }
 assert.ok(result.peaks['#ffcc00'].halos[0][0]>result.peaks['#ffcc00'].halos[0][2]+8,'yellow halo is yellow');
 assert.ok(result.peaks['#2244ff'].halos[2][2]>result.peaks['#2244ff'].halos[2][0]+8,'blue halo is blue');
 assert.deepEqual(result.peaks['#ffcc00'].cores[2],result.base.cores[2],'distant blue not activated by yellow');
 assert.ok(max(result.peaks['#ffcc00'].cores[0])>max(result.quiet.cores[0]),'louder input makes a brighter flash');assert.ok(max(result.quiet.cores[0])>max(result.base.cores[0]),'quiet input still emits');
 for(let i=0;i<5;i++){
  const before=result.base.cores[i],after=result.allColours.cores[i];
  assert.ok(max(after)>max(before)+10,'all colours brighten across the spectrum');
  assert.equal(after.indexOf(max(after)),before.indexOf(max(before)),'all colours retains each source dominant channel');
  assert.ok(max(result.allColours.halos[i])>max(result.base.halos[i])+2,'each colour supplies its own halo');
 }
 assert.deepEqual(result.allColours.distant,result.base.distant);
 assert.ok(max(result.peaks['#ffffff'].cores[5])>max(result.base.cores[5]),'neutral selection follows neutral highlights');assert.deepEqual(result.restored,result.base);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',...result,checks:'matching emitters brighten, colour spreads beyond source boundaries, generic selected hues retain chroma through bloom/output, distant regions stay unchanged, audio strength controls emission and silence restores source'}));
}finally{await browser.close();}
