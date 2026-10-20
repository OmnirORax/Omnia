import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { emptyUILayout } from '../src/ui/layout.ts';
const browser = await chromium.launch({ executablePath:'/usr/bin/chromium', args:['--no-sandbox','--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage({ viewport:{width:1600,height:1050}, reducedMotion:'reduce' });
  page.setDefaultTimeout(8000);
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.addInitScript(layout=>{
    if (!sessionStorage.getItem('wide-frame-seeded')) {
      localStorage.setItem('omnium.ui.layout.v1',JSON.stringify(layout)); sessionStorage.setItem('wide-frame-seeded','1');
    }
  }, { ...emptyUILayout(), panels:{'@theme':false}, frames:[
    { id:'Wide', name:'Wide', x:8,y:150,width:1584,height:240,cellSize:96,collapsed:false,pinned:false,dockGroup:true,dockEdge:'top',members:[{kind:'frame',id:'Left'},{kind:'frame',id:'Right'}],dockLayout:{kind:'split',axis:'horizontal',ratio:.5,first:{kind:'tabs',keys:['frame:Left'],active:'frame:Left'},second:{kind:'tabs',keys:['frame:Right'],active:'frame:Right'}} },
    ...['Left','Right'].map((id,i)=>({id,name:id,x:0,y:0,width:300,cellSize:96,collapsed:false,pinned:false,members:[{kind:'function',id:i?'zoom100':'focus'}]})),
  ] });
  await page.goto(process.env.ATLAS_URL||'http://127.0.0.1:5181/');
  const root=()=>page.locator('[data-ui-resident-root="frame:Wide"]');
  const handle=()=>page.locator('[data-ui-drag="frame:Wide"]');
  await handle().waitFor();
  const before=await root().boundingBox(), grip=await handle().boundingBox();
  await page.mouse.move(grip.x+12,grip.y+12); await page.mouse.down();
  await page.mouse.move(grip.x+330,grip.y+12,{steps:5});
  const preview=await page.locator('.ui-placement-preview').boundingBox();
  assert.ok(preview.x>250,'full-width frame can move sideways without resizing');
  await page.mouse.up();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('omnium.ui.layout.v1')).frames.find(f=>f.id==='Wide').floatingOverflow===true);
  const after=await root().boundingBox();
  assert.ok(after.x>250 && after.x+after.width>1600);
  assert.ok(Math.abs(after.width-before.width)<2,'moving preserves its width');
  assert.ok(Math.abs(after.x-preview.x)<2,'release matches preview');
  await page.reload(); await handle().waitFor();
  const restored=await root().boundingBox();
  assert.ok(Math.abs(restored.x-after.x)<2 && Math.abs(restored.width-after.width)<2,'reload preserves overflow placement');
  await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerdown',{button:3,shiftKey:true,bubbles:true,cancelable:true})));
  assert.deepEqual(errors,[]);
  console.log('Wide docked frame drags sideways, retains width, matches its preview and survives reload.');
} finally { await browser.close(); }
