/** Opt-in physical navigator diagnostic authorized 2026-11-07. Disposable local fixture only. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import * as THREE from 'three';
import {emptyDocument} from '../src/graph/structural.ts';
import {defaultSettings,SETTINGS_KEY} from '../src/workspaceActions.ts';
import {DEFAULT_CAMERA_POSITION,DEFAULT_CAMERA_FOV} from '../src/cameraGuideState.ts';
const origin=process.env.OMNIA_URL??'http://127.0.0.1:5182',output=process.env.OMNIA_NAVIGATOR_OUTPUT??'work/world-navigator';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Use disposable localhost data.');
await mkdir(output,{recursive:true});
const doc=emptyDocument();doc.entities=['car','child','other'].map(id=>({id,label:id,aliases:[],notes:''}));
doc.placements=[['car',2,null],['child',1,'car'],['other',-6,null]].map(([id,x,parentId])=>({id,entityId:id,parentId,position:{x:28,y:104},spatialPosition:{x,y:0,z:0},collapsed:true,hidden:false}));
const settings=defaultSettings();settings.appearance.theme='classic';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],report={checks:[]};page.setDefaultTimeout(12000);
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(origin).origin?route.continue():route.abort());
await page.addInitScript(([doc,settings,key])=>{if(!localStorage.getItem('navigator-fixture')){localStorage.clear();localStorage.setItem('omnium.atlas.v2',JSON.stringify(doc));localStorage.setItem(key,JSON.stringify(settings));localStorage.setItem('navigator-fixture','1');}},[doc,settings,SETTINGS_KEY]);
const tick=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const read=()=>page.evaluate(async()=>{const {readWorkspaceSlot}=await import('/src/omnic/workspaceStorage.ts');const workspace=await readWorkspaceSlot();return workspace?.atlases.find(a=>a.id===workspace.activeAtlasId)?.document;});
const hud=async name=>page.locator(`[data-camera="${name}"]`).first().textContent();
const coords=text=>(text?.match(/-?\d+(?:\.\d+)?/g)??[]).map(Number);
const check=(name)=>{report.checks.push(name);console.log(`PASS ${name}`);};
try{
 await page.goto(origin);const canvas=page.locator('.spatial-workspace > canvas');await canvas.waitFor();await tick();
 await page.waitForFunction(async()=>{const {readWorkspaceSlot}=await import('/src/omnic/workspaceStorage.ts');return !!await readWorkspaceSlot();});
 const before=await read(),box=await canvas.boundingBox(),camera=new THREE.PerspectiveCamera(DEFAULT_CAMERA_FOV,box.width/box.height,.001,100000);camera.position.copy(DEFAULT_CAMERA_POSITION);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const projected=new THREE.Vector3(2,0,0).project(camera),x=box.x+(projected.x+1)*box.width/2,y=box.y+(1-projected.y)*box.height/2;
 report.initial={box,point:{x,y},camera:await hud('position'),target:await hud('target')};
 await page.screenshot({path:`${output}/before.png`});
 assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.tagName,{x,y}),'CANVAS');
 const cameraBefore=coords(await hud('position')),targetBefore=coords(await hud('target')),zoomBefore=await hud('zoom'),directionBefore=await hud('direction');
 await page.mouse.click(x,y);await page.locator('.spatial-feedback').filter({hasText:'Driving selected node'}).waitFor();await tick();
 const cameraAfter=coords(await hud('position')),targetAfter=coords(await hud('target'));assert.ok(Math.abs(targetAfter[0]-2)<.02);for(let axis=0;axis<3;axis++)assert.ok(Math.abs((cameraAfter[axis]-targetAfter[axis])-(cameraBefore[axis]-targetBefore[axis]))<.03);
 assert.equal(await hud('zoom'),zoomBefore);assert.equal(await hud('direction'),directionBefore);assert.deepEqual((await read()).placements,before.placements);check('mount selects node; camera translates with unchanged offset, direction and zoom');
 const mounted=await hud('node');await page.mouse.move(x+1,y);await tick();assert.equal(await hud('node'),mounted,'one-pixel first movement must not jump the grabbed node');
 const start=await hud('node');await page.mouse.move(x-120,y+70,{steps:4});await tick();assert.notEqual(await hud('node'),start);assert.deepEqual((await read()).placements,before.placements);check('mouse drives renderer preview without saving');
 report.xyPreview=await hud('node');
 const xyPreview=await hud('node');await page.keyboard.press('ArrowUp');await tick();assert.notEqual(await hud('node'),xyPreview);report.depthPreview=await hud('node');const toward=coords(directionBefore).map(n=>-n),delta=coords(report.depthPreview).map((n,i)=>n-coords(xyPreview)[i]);assert.ok(delta.reduce((sum,n,i)=>sum+n*toward[i],0)<0,'Up advances away from the camera');assert.deepEqual((await read()).placements,before.placements);check('camera-relative depth changes the preview without saving');
 await page.mouse.click(x-120,y+70);await tick();await page.waitForFunction(async previous=>{const {readWorkspaceSlot}=await import('/src/omnic/workspaceStorage.ts');const w=await readWorkspaceSlot();return JSON.stringify(w.atlases.find(a=>a.id===w.activeAtlasId).document.placements)!==JSON.stringify(previous);},before.placements);
 const parked=await read();report.parked=parked.placements;assert.notDeepEqual(parked.placements,before.placements);assert.equal(await page.locator('.spatial-feedback').filter({hasText:'Driving selected node'}).count(),0);check('empty-slot click parks and commits placement');
 // Parking follows the car to the camera target, so it is centred on screen.
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.locator('.spatial-feedback').filter({hasText:'Driving selected node'}).waitFor();await page.mouse.move(box.x+box.width/2-80,box.y+box.height/2+80,{steps:4});await tick();
 const escapedPreview=await hud('node');await page.keyboard.press('Escape');await tick();assert.deepEqual((await read()).placements,parked.placements);assert.notEqual(await hud('node'),escapedPreview);check('Esc restores renderer anchors and leaves the saved placement unchanged');
 assert.deepEqual(errors,[]);await page.screenshot({path:`${output}/after.png`});report.errors=errors;await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
}catch(error){report.errors=errors;report.failure=String(error);await page.screenshot({path:`${output}/failure.png`});await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));throw error;}finally{await browser.close();}
