/** Focused opt-in local resize regression; never a background/browser CI suite. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {writeFile} from 'node:fs/promises';
import {emptyUILayout} from '../src/ui/layout.ts';
import {defaultSettings} from '../src/workspaceActions.ts';
const [target='http://127.0.0.1:4173/',output='/tmp/omnia-ui-resize-check.json']=process.argv.slice(2),url=new URL(target);
if(!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Only an isolated local preview is supported.');
const browser=await chromium.launch({executablePath:process.env.OMNIA_CHROMIUM??'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===url.origin?r.continue():r.abort());
 const ui=emptyUILayout();ui.panels={'@devMode':true,'@organized':true,'@theme':false};ui.windows['omnic-library']={x:500,y:150,width:420,height:500,collapsed:false,pinned:false};
 ui.frames.push({id:'Resize-sample',name:'Resize sample',x:80,y:120,width:280,cellSize:96,collapsed:false,pinned:false,members:[{kind:'function',id:'newNode'}]});
 const settings=defaultSettings();Object.assign(settings.appearance,{effect:'off',glow:0,atmosphere:false});
 await page.addInitScript(({ui,settings})=>{localStorage.setItem('omnium.ui.layout.v1',JSON.stringify(ui));localStorage.setItem('omnium.workspace.settings.v1',JSON.stringify(settings));},{ui,settings});
 await page.goto(url.href);await page.waitForSelector('[data-ui-function="omnic.library"]',{state:'attached'});await page.evaluate(()=>document.querySelector('[data-ui-function="omnic.library"]').click());await page.waitForSelector('[aria-label="Search library"]',{state:'attached'});
 const header=page.locator('[data-ui-chrome="window:omnic-library"] .ui-frame-handle button');
 const root=page.locator('[data-ui-resident-root="window:omnic-library"]');
 const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const state=()=>page.evaluate(()=>{const root=document.querySelector('[data-ui-resident-root="window:omnic-library"]'),surface=root.parentElement,r=surface.getBoundingClientRect(),s=getComputedStyle(surface);return{rect:{x:r.x,y:r.y,width:r.width,height:r.height},borderWidth:parseFloat(s.borderTopWidth),projected:surface.hasAttribute('data-ui-viewport-original'),original:surface.dataset.uiViewportOriginal,layer:surface.style.zIndex,layout:JSON.parse(localStorage.getItem('omnium.ui.layout.v1')).windows['omnic-library']};});
 const closeRect=(a,b)=>{for(const key of ['x','y','width','height'])assert.ok(Math.abs(a[key]-b[key])<1,`${key}: ${a[key]} vs ${b[key]}`);};
 await settle();const original=await state();
 await page.keyboard.down('Shift');await page.keyboard.press('w');const choices=page.locator('.resize-levels [data-configuration-option]');await choices.first().waitFor();
 const last=choices.last(),lastIndex=await last.getAttribute('data-configuration-option');assert.ok(Number(lastIndex)>0,'fixture must offer a non-default hover choice');await last.hover();
 await page.waitForFunction(index=>document.querySelector(`.resize-levels [data-configuration-option="${index}"]`)?.getAttribute('aria-pressed')==='true',lastIndex);
 await page.keyboard.up('Shift');await settle();const full=await state();assert.equal(full.projected,true);closeRect(full.rect,{x:8,y:8,width:1350,height:884});
 assert.equal(await header.locator('..').getAttribute('draggable'),'false','viewport projection retains the existing restore-before-drag rule');
 for(let i=0;i<3;i++){const r=await root.boundingBox();await page.mouse.click(r.x+r.width-10,r.y+r.height/2);await settle();const current=await state();closeRect(current.rect,full.rect);assert.equal(current.borderWidth,original.borderWidth);}
 for(let i=0;i<2;i++){await header.click();await settle();assert.equal((await state()).projected,false);await header.click();await settle();const current=await state();closeRect(current.rect,full.rect);assert.equal(current.borderWidth,original.borderWidth);assert.equal(current.layout.x,original.layout.x);assert.equal(current.layout.y,original.layout.y);}
 await page.keyboard.press('w');await settle();const restored=await state();assert.equal(restored.projected,false);closeRect(restored.rect,original.rect);
 // Pointing changes a temporary choice; locking remains explicit.
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('omnium.workspace.settings.v1')).functionValues?.['ui.frame.resize']?.['operation.level']??1),1);
 await page.keyboard.down('Shift');await page.keyboard.press('w');await choices.first().waitFor();const focusIndex=await choices.last().getAttribute('data-configuration-option');await choices.last().focus();await page.keyboard.up('Shift');await settle();closeRect((await state()).rect,full.rect);assert.ok(focusIndex!==null);
 await page.keyboard.press('w');await settle();
 await page.keyboard.down('Shift');await page.keyboard.press('w');await choices.last().waitFor();await choices.last().click({button:'right'});await page.keyboard.up('Shift');await settle();closeRect((await state()).rect,full.rect);
 assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('omnium.workspace.settings.v1')).functionValues['ui.frame.resize']['operation.level'])>1);
 await page.keyboard.press('w');await settle();closeRect((await state()).rect,original.rect);
 await page.keyboard.down('Shift');await page.keyboard.press('w');await choices.last().waitFor();await choices.last().click();await page.keyboard.up('Shift');await settle();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('omnium.workspace.settings.v1')).functionValues['ui.frame.resize']['operation.level']),1);
 const resetSize=(await state()).rect;assert.ok(resetSize.width<full.rect.width-1||resetSize.height<full.rect.height-1);
 await page.keyboard.press('w');await settle();closeRect((await state()).rect,original.rect);
 const layers=[];
 for(let i=0;i<3;i++){
  const r=await header.boundingBox();await page.mouse.move(r.x+40,r.y+r.height/2);await page.mouse.down();await settle();layers.push((await state()).layer);
  await page.mouse.move(r.x+55,r.y+r.height/2+10);await page.waitForSelector('.ui-live-drag');await page.mouse.up();await settle();
 }
 assert.equal(new Set(layers).size,1,'regrabbing the front window must not allocate new layers');
 const sampleHeader=page.locator('[data-ui-chrome="frame:Resize-sample"] .ui-frame-handle button');await sampleHeader.focus();await page.keyboard.press('w');await settle();
 const sample=()=>page.locator('[data-ui-resident-root="frame:Resize-sample"]').evaluate(root=>{const surface=root.parentElement,r=surface.getBoundingClientRect();return{rect:{x:r.x,y:r.y,width:r.width,height:r.height},border:parseFloat(getComputedStyle(surface).borderTopWidth),projected:surface.hasAttribute('data-ui-viewport-original')};});
 const sampleResized=await sample();assert.equal(sampleResized.projected,true);
 for(let i=0;i<2;i++){await sampleHeader.click();await settle();assert.equal((await sample()).projected,false);await sampleHeader.click();await settle();const current=await sample();closeRect(current.rect,sampleResized.rect);assert.equal(current.border,0);}
 await page.keyboard.press('w');await settle();assert.equal((await sample()).projected,false);
 assert.deepEqual(errors,[]);
 const report={checks:{hoverRelease:true,focusRelease:true,noImplicitLock:true,bodyClicksStable:true,collapseExpandStable:true,originalGeometryRestored:true,noBrowserBorder:true,regrabsReuseLayer:true,customFrameCyclesStable:true,rightClickLocksOnce:true,leftClickResets:true,noPageErrors:true},original,full,restored,layers};
 await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,checks:report.checks,layers}));
}finally{await browser.close();}
