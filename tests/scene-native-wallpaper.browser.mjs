// Prepared native wallpaper pixel check. Run only with explicit user approval.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
try{
 await page.route('**/native-check',r=>r.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));await page.goto((process.env.ATLAS_URL||'http://127.0.0.1:5183')+'/native-check');
 const result=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{createWallpaper}=await import('/src/scene/wallpaper.ts'),{createSceneAppearance}=await import('/src/sceneAppearance.ts'),{defaultSettings}=await import('/src/workspaceActions.ts'),{sceneOutputPixelRatio}=await import('/src/renderBudget.ts');
 const image=document.createElement('canvas');image.width=2560;image.height=1440;const ctx=image.getContext('2d');for(let x=0;x<2560;x++){ctx.fillStyle=x%2?'#ffffff':'#000000';ctx.fillRect(x,0,1,1440);}
 const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setPixelRatio(sceneOutputPixelRatio(2560,1440,1,true));renderer.setSize(2560,1440);
 const targets=[],setTarget=renderer.setRenderTarget.bind(renderer);renderer.setRenderTarget=(target,...rest)=>{if(target)targets.push([target.width,target.height]);return setTarget(target,...rest);};
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),wallpaper=createWallpaper(scene,()=>{},renderer),appearance=createSceneAppearance(renderer,scene,camera);
 appearance.setWallpaper(wallpaper);wallpaper.configure({...defaultSettings().sceneVfx,lightModel:'pulse',pulseTintLow:'#ffffff',waves:false,distortion:0,glitching:0,audioBounce:1});wallpaper.resize(2560,1440);await wallpaper.setURL(image.toDataURL());
 const outputs=[];for(const glow of [0,.22]){
 appearance.configure({...defaultSettings().appearance,theme:'neon',motion:0,effectIntensity:0,glow});appearance.resize(2560,1440);appearance.render();
 const gl=renderer.getContext(),samples=[];for(let x=100;x<116;x++){const p=new Uint8Array(4);gl.readPixels(x,720,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);samples.push([...p]);}
 outputs.push({glow,samples,width:gl.drawingBufferWidth,height:gl.drawingBufferHeight});
 }
 await wallpaper.setURL(null);renderer.setPixelRatio(sceneOutputPixelRatio(2560,1440,1,false));appearance.resize(2560,1440);appearance.render();
 const cleared={width:renderer.domElement.width,height:renderer.domElement.height};wallpaper.dispose();appearance.dispose();renderer.dispose();return {outputs,targets,cleared};
 });
 for(const output of result.outputs){assert.equal(output.width,2560);assert.equal(output.height,1440);for(let i=0;i<output.samples.length;i++)for(let c=0;c<3;c++)assert.ok(Math.abs(output.samples[i][c]-(i%2?255:0))<=2,'one-pixel wallpaper detail survives graph AA/glow');}
 assert.ok(result.targets.every(([w,h])=>w*h<=1_500_000),'graph/bloom targets retain existing pixel budgets');assert.ok(result.cleared.width*result.cleared.height<=1_500_000);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',...result,checks:'native 2560 image stripes survive with and without glow; graph targets remain bounded; clearing restores graph output budget'}));
}finally{await browser.close();}
