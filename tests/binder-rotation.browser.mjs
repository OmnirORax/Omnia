/** Opt-in focused diagnostic authorized 2026-11-07; not a routine browser suite. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const origin=process.env.OMNIA_URL??'http://127.0.0.1:5181';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Use disposable local data.');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:900,height:800}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
await page.route('**/*',route=>{
 const url=new URL(route.request().url());
 if(url.origin!==new URL(origin).origin)return route.abort();
 // The static diagnostic does not use HMR; avoid local WebSocket permission
 // retries while still treating real renderer/page errors as failures.
 if(url.pathname==='/@vite/client')return route.fulfill({contentType:'application/javascript',body:'export const createHotContext=()=>({accept(){},dispose(){},on(){},send(){}});export const injectQuery=u=>u;export const updateStyle=()=>{};export const removeStyle=()=>{};'});
 if(url.pathname==='/binder-rotation-check')return route.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0;background:#101927"><script type="module" src="/tests/binder-rotation-harness.ts"></script>'});
 return route.continue();
});
try{
 await page.goto(`${origin}/binder-rotation-check`);await page.waitForFunction(()=>window.diagnostic);
 const result=await page.evaluate(()=>{
  const d=window.diagnostic,frames=[];
  const read=()=>{d.renderer.setRenderTarget(null);d.renderer.setViewport(0,0,900,800);d.renderer.render(d.scene,d.camera);const gl=d.renderer.getContext(),pixels=new Uint8Array(900*800*4);gl.readPixels(0,0,900,800,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
  // Hold distance fixed; only rotate. Verify actual rendered label contribution
  // as well as the final projected quad, not just the visibility flag.
  for(const yaw of [0,.3,.6,.9,1.2])for(const pitch of [0,.3]){
   const frame=d.render(yaw,pitch,6),label=d.built.connectors[0].label,on=read();label.visible=false;const off=read();label.visible=frame.visible;
   let changed=0;for(let i=0;i<on.length;i+=4)if(Math.abs(on[i]-off[i])+Math.abs(on[i+1]-off[i+1])+Math.abs(on[i+2]-off[i+2])>30)changed++;
   frames.push({...frame,changed,yaw,pitch});
  }
  const node=d.built.nodes.get('a');d.built.animateSelection(d.camera,0,true);const first=node.outline.scale.x;d.built.animateSelection(d.camera,1/3,true);const second=node.outline.scale.x;
  return {frames,selection:{carrier:node.cell.visible,ring:node.outline.visible,first,second}};
 });
 for(const frame of result.frames){assert.equal(frame.visible,true,`label remains present at yaw ${frame.yaw}, pitch ${frame.pitch}`);assert.ok(frame.changed>100,'real label pixels rendered');assert.ok(frame.corners.every(p=>p.x>=0&&p.y>=0&&p.x<=900&&p.y<=800&&p.z>=-1&&p.z<=1),'complete rotated quad is on-screen');assert.equal(frame.glError,0);}
 assert.equal(result.selection.carrier,false);assert.equal(result.selection.ring,true);assert.ok(result.selection.second>result.selection.first,'existing selection pulse changes the ring size');
 assert.deepEqual(errors,[]);console.log('PASS fixed-distance rotations: complete rendered binder text; selected O hidden and pulse retained');
}finally{await browser.close();}
