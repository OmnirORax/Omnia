/** Opt-in local drag diagnostic; never part of the normal browser suite. */
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {emptyDocument} from '../src/graph/structural.ts';
import {emptyUILayout} from '../src/ui/layout.ts';
import {defaultSettings} from '../src/workspaceActions.ts';
const [target='http://127.0.0.1:4173/',output='/tmp/omnia-ui-drag.json']=process.argv.slice(2);
const url=new URL(target);if(!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Only a disposable local preview is supported.');
const smoke=process.env.OMNIA_DRAG_SMOKE==='1',countDiscovery=process.env.OMNIA_PROFILE_DOM==='1',expandImmediately=process.env.OMNIA_DRAG_EXPAND==='1';
const browser=await chromium.launch({executablePath:process.env.OMNIA_CHROMIUM??'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===url.origin?route.continue():route.abort());
 const graph=emptyDocument();for(let i=0;i<12;i++){graph.entities.push({id:`e${i}`,label:`Node ${i}`,aliases:[],notes:''});graph.placements.push({id:`p${i}`,entityId:`e${i}`,parentId:null,position:{x:i*100,y:0},spatialPosition:{x:(i%4)*3,y:Math.floor(i/4)*2,z:0},collapsed:false,hidden:false});}
 const ui=emptyUILayout();ui.panels['@devMode']=true;ui.panels['@organized']=true;ui.windows['omnic-library']={x:500,y:150,width:420,height:500,pinned:false,collapsed:false};
 if(smoke)ui.frames.push({id:'Drag-target',name:'Drag target',x:120,y:220,width:260,cellSize:96,collapsed:false,pinned:false,members:[]});
 const settings=process.env.OMNIA_DRAG_EFFECTS==='off'?defaultSettings():null;
 if(settings)Object.assign(settings.appearance,{effect:'off',glow:0,atmosphere:false});
 await page.addInitScript(({graph,ui,settings})=>{localStorage.setItem('omnium.atlas.v2',JSON.stringify(graph));localStorage.setItem('omnium.ui.layout.v1',JSON.stringify(ui));if(settings)localStorage.setItem('omnium.workspace.settings.v1',JSON.stringify(settings));},{graph,ui,settings});
 await page.goto(url.href);await page.waitForSelector('[data-ui-function="omnic.library"]',{state:'attached'});
 await page.evaluate(()=>document.querySelector('[data-ui-function="omnic.library"]').click());
 const handle=page.locator('[data-ui-chrome="window:omnic-library"] [data-ui-drag="window:omnic-library"]');await handle.waitFor();
 await page.keyboard.press('Control+a');await page.waitForTimeout(1500);
 if(expandImmediately){await handle.locator('button').first().evaluate(button=>button.click());await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.waitForTimeout(300);}
 const bounds=await handle.boundingBox();if(!bounds)throw Error('Missing drag handle');
 const x=bounds.x+Math.min(bounds.width/2,70),y=bounds.y+bounds.height/2;
 const saved=await page.evaluate(()=>localStorage.getItem('omnium.ui.layout.v1'));
 if(countDiscovery)await page.evaluate(()=>{
  const original=Document.prototype.querySelectorAll;window.__dragDiscovery={frameSlotQueries:0,dropZoneQueries:0,sourceRectReads:0};
  const rect=Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect=function(){if(this.closest('[data-ui-resident-root="window:omnic-library"]'))window.__dragDiscovery.sourceRectReads++;return rect.call(this);};
  Document.prototype.querySelectorAll=function(selector){
   if(selector==='[data-ui-frame-slot],[data-ui-slot-key]')window.__dragDiscovery.frameSlotQueries++;
   if(selector==='[data-ui-drop-zone]')window.__dragDiscovery.dropZoneQueries++;
   return original.call(this,selector);
  };
 });
 const client=await page.context().newCDPSession(page),profilePath=process.env.OMNIA_PROFILE_CPU;
 if(profilePath){await client.send('Profiler.enable');await client.send('Profiler.start');}
 await page.evaluate(()=>{window.__dragFrames=[];window.__dragRecording=true;let previous=performance.now();const tick=now=>{if(!window.__dragRecording)return;window.__dragFrames.push(now-previous);previous=now;requestAnimationFrame(tick);};requestAnimationFrame(tick);});
 await page.mouse.move(x,y);if(expandImmediately)await handle.locator('button').first().evaluate(button=>button.click());await page.mouse.down();
 const inputMs=[],moves=smoke?8:36;
 for(let i=1;i<=moves;i++){const start=performance.now();await page.mouse.move(x+100*Math.sin(i/moves*Math.PI),y+i*2);inputMs.push(performance.now()-start);await page.waitForTimeout(16);}
 const live=await page.locator('.ui-live-drag').count();if(!live)throw Error('Drag did not start');
 const during=await page.evaluate(()=>localStorage.getItem('omnium.ui.layout.v1'));
 if(expandImmediately){const a=JSON.parse(during).windows['omnic-library'],b=JSON.parse(saved).windows['omnic-library'];if(a.x!==b.x||a.y!==b.y)throw Error('Movement persisted while held');}
 else if(during!==saved)throw Error('Layout persisted during pointer movement');
 await page.mouse.up();await page.waitForFunction(()=>!document.querySelector('.ui-live-drag'));
 await page.waitForFunction(saved=>localStorage.getItem('omnium.ui.layout.v1')!==saved,saved);
 const frames=await page.evaluate(()=>{window.__dragRecording=false;return window.__dragFrames;});
 if(profilePath){const {profile}=await client.send('Profiler.stop');await writeFile(profilePath,JSON.stringify(profile));}
 const smokeChecks={};
 if(smoke){
  await page.keyboard.press('Control+z');await page.waitForFunction(saved=>{const a=JSON.parse(localStorage.getItem('omnium.ui.layout.v1')).windows['omnic-library'],b=JSON.parse(saved).windows['omnic-library'];return a.x===b.x&&a.y===b.y;},saved);assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('omnium.ui.layout.v1'))),JSON.parse(saved));smokeChecks.singleUndo=true;
  let grip=await handle.boundingBox();await page.mouse.move(grip.x+40,grip.y+grip.height/2);await page.mouse.down();await page.mouse.move(grip.x+80,grip.y+grip.height/2+30);await page.waitForSelector('.ui-live-drag');
  await page.keyboard.press('Escape');await page.mouse.up();await page.waitForFunction(()=>!document.querySelector('.ui-live-drag'));
  assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('omnium.ui.layout.v1'))),JSON.parse(saved),'Cancel must preserve layout');smokeChecks.cancelRestores=true;
  const destination=page.locator('[data-ui-chrome="frame:Drag-target"] .ui-frame-handle');const dest=await destination.boundingBox();grip=await handle.boundingBox();
  if(!dest||!grip)throw Error('Missing docking handles');
  await page.mouse.move(grip.x+40,grip.y+grip.height/2);await page.mouse.down();await page.mouse.move(dest.x+dest.width/2,dest.y+dest.height/2,{steps:8});await page.mouse.up();
  await page.waitForFunction(()=>{const layout=JSON.parse(localStorage.getItem('omnium.ui.layout.v1'));return layout.frames.some(frame=>frame.members?.some(member=>member.kind==='window'&&member.id==='omnic-library'))||Object.values(layout.windows).some(win=>win.members?.some(member=>member.kind==='window'&&member.id==='omnic-library'));});smokeChecks.docked=true;
  await page.keyboard.press('Control+z');await page.waitForFunction(saved=>{const a=JSON.parse(localStorage.getItem('omnium.ui.layout.v1')).windows['omnic-library'],b=JSON.parse(saved).windows['omnic-library'];return a.x===b.x&&a.y===b.y;},saved);assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('omnium.ui.layout.v1'))),JSON.parse(saved));smokeChecks.dockSingleUndo=true;
 }
 if(errors.length)throw Error(errors.join('\n'));
 const sorted=frames.slice(1).sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];
 const report={source:process.env.OMNIA_PROFILE_SOURCE??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:process.env.OMNIA_PROFILE_SOURCE?null:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),target:url.href,fixture:`12 selected ordinary nodes; edit-enabled UI; expanded Omnic library; ${moves} pointer moves over open canvas; ${expandImmediately?'drag immediately after expand; ':''} ${settings?'effects/bloom/atmosphere off; default blur retained':'template/default effects'}`,method:`Headless software-GPU drag, 16ms between acknowledged moves. CPU profiler ${profilePath?'enabled':'disabled'}. RAF intervals and CDP acknowledgements are not physical pointer-to-display latency.`,inputMs,frames,medianRafMs:median,maxRafMs:Math.max(...sorted),discovery:countDiscovery?await page.evaluate(()=>window.__dragDiscovery):undefined,checks:{livePayload:true,noMovementPersistedWhileHeld:true,committedOnRelease:true,...smokeChecks},userAgent:await page.evaluate(()=>navigator.userAgent)};
 await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,medianRafMs:report.medianRafMs,maxRafMs:report.maxRafMs,frames:frames.length}));
}finally{await browser.close();}
