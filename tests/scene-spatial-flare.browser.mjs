// Opt-in: the user approved this bounded synthetic bright-spot GPU check.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
try{
 await page.route('**/spatial-check',r=>r.fulfill({contentType:'text/html',body:'<html><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script><body></body></html>' }));await page.goto('http://127.0.0.1:5183/spatial-check');
 const result=await page.evaluate(async()=>{
  // Resolve the same Vite graph, including HMR version URLs, as the application.
  const graph=await (await fetch('/src/scene/wallpaper.ts')).text();
  const moduleURL=stem=>{const match=graph.match(new RegExp('from "([^"\\n]*'+stem+'[^"\\n]*)"'));if(!match)throw Error('Missing module '+stem);return match[1];};
  const T=await import(moduleURL('deps/three.js')),{FullScreenQuad}=await import(moduleURL('Pass'));
  const {createWallpaperGlow}=await import(moduleURL('wallpaperGlow.ts')),{createWallpaper}=await import('/src/scene/wallpaper.ts'),{DEFAULT_SCENE_VFX}=await import(moduleURL('vfx.ts')),audio=await import(moduleURL('audio.ts'));
  Object.defineProperty(document,'hidden',{configurable:true,value:true});
  const width=512,height=256,image=document.createElement('canvas');image.width=width;image.height=height;const ctx=image.getContext('2d');
  ctx.fillStyle='#030508';ctx.fillRect(0,0,width,height);const g=ctx.createRadialGradient(256,128,0,256,128,10);g.addColorStop(0,'#fff5c0');g.addColorStop(.35,'#ffb52a');g.addColorStop(1,'#030508');ctx.fillStyle=g;ctx.fillRect(244,116,24,24);
  for(let x=20;x<60;x++){ctx.fillStyle=x%2?'#303030':'black';ctx.fillRect(x,20,1,40);}
  const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(width,height);renderer.debug.onShaderError=(gl,program,vs,fs)=>{const message=gl.getProgramInfoLog(program)+' '+gl.getShaderInfoLog(vs)+' '+gl.getShaderInfoLog(fs);console.error('Shader failure '+message);throw Error(message);};
  const settings={...DEFAULT_SCENE_VFX,pulseRangeMode:'auto',pulseColorMode:'all',pulseOmniTintLow:'#ffffff',pulseGlowTravel:100,waves:false,distortion:0,glitching:0};
  const texture=new T.CanvasTexture(image);texture.colorSpace=T.SRGBColorSpace;
  const glow=createWallpaperGlow(renderer);glow.setImage(texture);glow.configure(settings);
  const copy=new T.ShaderMaterial({uniforms:{image:{value:glow.texture}},vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'varying vec2 uv0;uniform sampler2D image;void main(){gl_FragColor=vec4(texture2D(image,uv0).rgb,1.);#include <colorspace_fragment>}'.replace(';#include',';\n#include')});
  const quad=new FullScreenQuad(copy),gl=renderer.getContext(),read=()=>{const p=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
  const linear=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);};
  const radius=(p,base=null)=>{let total=0,moment=0;for(let y=32;y<224;y++)for(let x=160;x<352;x++){const i=(y*width+x)*4,r2=(x-256)**2+(y-128)**2;let w=0;for(let c=0;c<3;c++)w+=Math.max(0,linear(p[i+c])-(base?linear(base[i+c]):0));total+=w;moment+=w*r2;}return {energy:total,rms:total?Math.sqrt(moment/total):0};};
  const kernel=[];for(const reach of [.05,.5,1,.5,.05]){const ok=glow.render([{reach,energy:1}],true);if(!ok)throw Error('HDR glow field was not rendered');renderer.setRenderTarget(null);quad.render(renderer);kernel.push(radius(read()));}
  glow.configure({...settings,pulseColorMode:'tint',pulseTintHigh:'#ff8800'});if(!glow.render([{reach:1,energy:1}],true))throw Error('Single tint glow failed');
  let context;class Node{connect(n){return n;}disconnect(){}}
  class FakeContext{state='running';currentTime=0;sampleRate=48000;destination={};constructor(){context=this;}resume(){return Promise.resolve();}close(){return Promise.resolve();}createMediaElementSource(){return new Node();}createChannelSplitter(){return new Node();}createAnalyser(){return Object.assign(new Node(),{frequencyBinCount:1024,getByteFrequencyData(b){b.fill(0);if(context.currentTime===0)b[2]=255;},getByteTimeDomainData(b){b.fill(128);}});}}
  window.AudioContext=FakeContext;await audio.connectSceneAudioElement({paused:false,pause(){},addEventListener(){},removeEventListener(){}});
  const scene=new T.Scene(),paper=createWallpaper(scene,()=>{},renderer);paper.configure(settings);paper.resize(width,height);await paper.setURL(image.toDataURL());
  const u=scene.children.find(o=>o.material?.uniforms?.light).material.uniforms,world=new T.DataTexture(new Uint8Array(4),1,1);world.needsUpdate=true;
  document.body.style.cssText='background:#111;color:white;font:14px sans-serif;display:flex;flex-wrap:wrap;gap:12px';const samples=[];let base;
  for(const time of [0,.016,.032,.056,.08,.11]){context.currentTime=time;u.light.value=audio.sampleScenePulse(settings,0);paper.renderComposite(world);const pixels=read();if(!base)base=pixels;const metric=radius(pixels,base);samples.push({time,core:u.light.value,spatial:u.spatialGlow.value,...metric});
   const tile=document.createElement('div'),label=document.createElement('div'),preview=document.createElement('img');label.textContent=`${Math.round(time*1000)} ms`;preview.src=renderer.domElement.toDataURL();preview.style.width='340px';tile.append(label,preview);document.body.append(tile);}
  const last=read(),bright=last[((height-30)*width+31)*4],dark=last[((height-30)*width+32)*4];
  let endDifference=0;for(let i=0;i<last.length;i++)endDifference=Math.max(endDifference,Math.abs(last[i]-base[i]));
  paper.dispose();glow.dispose();texture.dispose();world.dispose();quad.dispose();copy.dispose();renderer.dispose();return {kernel,samples,bright,dark,endDifference};
 });
 assert.deepEqual(errors,[]);assert.ok(result.kernel[2].rms>result.kernel[0].rms*2);assert.ok(result.kernel[3].rms<result.kernel[2].rms*.8);assert.ok(result.kernel[4].rms<result.kernel[3].rms*.7);
 assert.ok(result.samples[2].spatial===1&&result.samples[2].energy>0);assert.ok(result.samples[4].rms<result.samples[2].rms*.8);assert.equal(result.samples.at(-1).spatial,0);assert.ok(result.endDifference<=1);assert.ok(result.bright>=46&&result.dark<3,'base image one-pixel detail must remain sharp');
 await page.screenshot({path:'/tmp/scene-spatial-flare-check.png',fullPage:true});console.log(JSON.stringify({result:'PASS',...result}));
}catch(error){console.error(JSON.stringify({errors}));throw error;}finally{await browser.close();}
