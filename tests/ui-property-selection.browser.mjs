import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { emptyUILayout } from '../src/ui/layout.ts';
const browser = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  const page=await browser.newPage({viewport:{width:1600,height:1050},reducedMotion:'reduce'});
  page.setDefaultTimeout(8000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const names=['color','lighting','opacity'];
  const layout={...emptyUILayout(),hideNames:true,windows:{theme:{x:450,y:150,width:500,height:680,collapsed:false,pinned:false}}};
  for(const name of names) layout.windows[`property:master:${name}`]={x:120,y:140,width:240,height:160,collapsed:true,pinned:false};
  await page.addInitScript(layout=>{if(!sessionStorage.getItem('property-selection-seeded')){localStorage.setItem('omnium.ui.layout.v1',JSON.stringify(layout));sessionStorage.setItem('property-selection-seeded','1');}},layout);
  await page.goto(process.env.ATLAS_URL||'http://127.0.0.1:5181/');
  const handle=name=>page.locator(`[data-ui-drag="window:property:master:${name}"]`);
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('omnium.ui.layout.v1')));
  await handle('lighting').waitFor();
  for(const name of names) {
    await handle(name).evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest'}));
    const box=await handle(name).boundingBox();
    await page.keyboard.down('Control'); await page.mouse.click(box.x+box.width/2,box.y+box.height/2); await page.keyboard.up('Control');
  }
  for(const name of names) assert.equal(await handle(name).getAttribute('data-ui-selected'),'');
  assert.match(await page.locator('[aria-label="UI selection"]').innerText(),/3 UI selected/);
  for(const name of names) assert.equal((await state()).windows[`property:master:${name}`].collapsed,true,'Ctrl selection must not expand or activate');
  await handle('lighting').click({button:'right'});
  const menu=page.getByRole('menu',{name:'Selected UI actions'});
  await menu.getByRole('button',{name:'Group into frame',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('omnium.ui.layout.v1')).frames.length===1);
  const grouped=await state(),group=grouped.frames[0], keys=names.map(name=>`property:master:${name}`);
  assert.deepEqual(group.members.map(member=>member.id),keys);
  for(const name of names) assert.equal(await handle(name).isVisible(),false,'collapsed group conceals owned content');
  await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerdown',{button:3,shiftKey:true,bubbles:true,cancelable:true})));
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('omnium.ui.layout.v1')).frames.length===0);
  await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerdown',{button:4,shiftKey:true,bubbles:true,cancelable:true})));
  await page.locator(`[data-ui-drag="frame:${group.id}"]`).click();
  const root=page.locator(`[data-ui-resident-root="frame:${group.id}"]`);
  for(const name of names) assert.ok(await root.locator(`[data-ui-inline-group="window:property:master:${name}"]`).isVisible());
  await handle('lighting').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('omnium.ui.layout.v1')).windows['property:master:lighting'].collapsed===false);
  await root.locator('[data-ui-drag="window:property:master:brightness"]').waitFor({state:'visible'});
  await page.reload(); await page.locator(`[data-ui-resident-root="frame:${group.id}"]`).waitFor();
  assert.deepEqual((await state()).frames[0].members.map(member=>member.id),keys);
  assert.deepEqual(errors,[]);
  console.log('Property groups Ctrl-select without activation; shared menu groups live subtrees, supports one-step undo/redo and reload.');
} finally {await browser.close();}
