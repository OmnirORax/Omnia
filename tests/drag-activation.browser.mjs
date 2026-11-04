/** Opt-in focused regression for the shared window/drag activation boundary. */
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {emptyUILayout,UI_LAYOUT_KEY,validateUILayout} from '../src/ui/layout.ts';
import {emptyDocument} from '../src/graph/structural.ts';
const origin=process.env.OMNIA_URL??'http://127.0.0.1:5173/';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('Use a disposable local server.');
await mkdir('work/drag-activation',{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(origin).origin?route.continue():route.abort());
const ui=emptyUILayout();ui.panels['@devMode']=true;
ui.frames=[{id:'Tools',name:'Tools',x:30,y:90,width:340,height:180,cellSize:96,collapsed:false,pinned:false,members:[{kind:'function',id:'shortcuts'},{kind:'function',id:'theme'}]}];
validateUILayout(ui);
await page.addInitScript(({ui,doc,key})=>{localStorage.setItem(key,JSON.stringify(ui));localStorage.setItem('omnium.atlas.v2',JSON.stringify(doc));},{ui,doc:emptyDocument(),key:UI_LAYOUT_KEY});
const pinned=()=>page.evaluate(key=>!!JSON.parse(localStorage.getItem(key)).panels['@shortcuts'],UI_LAYOUT_KEY);
const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
try{
 await page.goto(origin);
 const button=page.locator('[data-ui-resident-root="frame:Tools"] [data-ui-function="shortcuts"]').first();
 await button.hover();
 const title=page.locator('[data-ui-resident-root="window:shortcuts"] [data-ui-drag="window:shortcuts"]').first();
 await title.waitFor();const box=await title.boundingBox();assert.ok(box);
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await settle();
 assert.equal(await pinned(),false,'pressing the window title cannot pin the hovered window');
 console.log('PASS window press does not commit interaction');
 await page.mouse.move(box.x+box.width/2-70,box.y+box.height/2+55,{steps:8});await page.mouse.up();await settle();
 assert.equal(await pinned(),false,'drag release cannot pin the hovered window');console.log('PASS window drag does not activate its interaction callback');
 await button.hover();await title.waitFor();await title.click();await settle();assert.equal(await pinned(),true,'an independent real click still commits interaction');console.log('PASS deliberate click after drag remains usable');
 const theme=page.locator('[data-ui-resident-root="frame:Tools"] [data-ui-function="theme"]').first();
 const appearance=()=>page.locator('[data-ui-function="theme"]:visible').first().getAttribute('aria-pressed');
 const before=await appearance(),b=await theme.boundingBox();assert.ok(b);
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+90,b.y+b.height/2+90,{steps:8});await page.mouse.up();await settle();
 assert.equal(await appearance(),before,'dragging a different command must not invoke it');console.log('PASS command drag does not run its action');
 await page.locator('[data-ui-function="theme"]:visible').first().focus();await page.keyboard.press('Enter');await settle();assert.notEqual(await appearance(),before,'keyboard activation is not a drag tail');console.log('PASS keyboard activation after drag remains usable');
 assert.deepEqual(errors,[],'no uncaught runtime errors');
}catch(error){await page.screenshot({path:'work/drag-activation/failure.png'});throw error;}finally{await browser.close();}
