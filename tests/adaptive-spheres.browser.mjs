/** One focused synthetic comparison and paired timing run; authorized by user go.
 * Local disposable fixtures only; never a default suite or hardware GPU claim. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {defaultSettings,SETTINGS_KEY} from '../src/workspaceActions.ts';
import {emptyDocument} from '../src/graph/structural.ts';
const origin=process.env.OMNIA_URL??'http://127.0.0.1:5182',output=process.env.OMNIA_ADAPTIVE_OUTPUT??'/workspace/work/adaptive-browser';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Use disposable localhost data.');
await mkdir(output,{recursive:true});const settings=defaultSettings();settings.appearance.nodes.color='#0044ff';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage',...(process.env.OMNIA_SWIFTSHADER==='1'?['--use-angle=swiftshader']:[])]});
const page=await browser.newPage({viewport:{width:1800,height:1100}}),errors=[],report={checks:[]};page.setDefaultTimeout(30000);
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|glsl|validate_status|WebGLProgram/i.test(m.text()))errors.push(m.text());});
await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(origin).origin?route.continue():route.abort());
await page.addInitScript(([settings,key,doc])=>{localStorage.setItem(key,JSON.stringify(settings));localStorage.setItem('omnium.atlas.v2',JSON.stringify(doc));},[settings,SETTINGS_KEY,emptyDocument()]);
const tick=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const pixels=async(a,b)=>page.evaluate(async([a,b])=>{
 const bitmap=async encoded=>createImageBitmap(new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:'image/png'}));
 const [left,right]=await Promise.all([bitmap(a),bitmap(b)]);if(left.width!==right.width||left.height!==right.height)throw Error('Comparison image dimensions differ.');
 const canvas=new OffscreenCanvas(left.width,left.height),ctx=canvas.getContext('2d');ctx.drawImage(left,0,0);const la=ctx.getImageData(0,0,left.width,left.height).data;ctx.clearRect(0,0,left.width,left.height);ctx.drawImage(right,0,0);const ra=ctx.getImageData(0,0,right.width,right.height).data;let sum=0,changed=0;
 for(let i=0;i<la.length;i+=4){let max=0;for(let j=0;j<3;j++){const d=Math.abs(la[i+j]-ra[i+j]);sum+=d;max=Math.max(max,d);}if(max>2)changed++;}left.close();right.close();return {meanChannelDelta:sum/(la.length/4*3),changedPixelsOver2:changed};
},[a.toString('base64'),b.toString('base64')]);
const pair=async(name,panes)=>{const [left,right]=await Promise.all([panes.nth(0).screenshot({path:`${output}/${name}-left.png`}),panes.nth(1).screenshot({path:`${output}/${name}-right.png`})]);const result=await pixels(left,right);(report.pixels??={})[name]=result;if(['off','orbit','zero'].includes(name))assert.ok(result.meanChannelDelta<.25,JSON.stringify(result));else assert.ok(result.changedPixelsOver2>100,JSON.stringify(result));return left;};
const check=name=>{report.checks.push(name);console.log(`PASS ${name}`);};
const graph=()=>page.evaluate(async()=>{const {readWorkspaceSlot}=await import('/src/omnic/workspaceStorage.ts');const w=await readWorkspaceSlot();return w?.atlases.find(a=>a.id===w.activeAtlasId)?.document;});
try{
 await page.goto(origin);await page.locator('.toolbar').getByRole('button',{name:'Toggle frame View',exact:true}).click();await page.locator('[data-ui-function="ui:blendComparison"]').first().click();
 await page.locator('[data-blend-status]').filter({hasText:'Ready.'}).waitFor();await tick();assert.deepEqual(errors,[],'both standard and experimental shader paths must compile');
 const before=await graph(),beforeAppearance=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).appearance,SETTINGS_KEY);
 const panes=page.locator('.sphere-blend-pane canvas');assert.equal(await panes.count(),2);assert.equal(await page.getByRole('checkbox',{name:'Adapt right view'}).isChecked(),false);
 const off=await pair('off',panes);check('comparison opens disabled with two compiled production-material views');
 const box=await panes.nth(0).boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+35,box.y+box.height/2+20,{steps:5});await page.mouse.up();await tick();
 const orbit=await pair('orbit',panes);assert.ok((await pixels(off,orbit)).changedPixelsOver2>100,'orbit changes the rendered camera');check('physical orbit updates the linked comparison camera');
 await page.getByRole('checkbox',{name:'Adapt right view'}).check();await page.getByRole('slider',{name:'Adaptation strength'}).press('End');await tick();
 for(const [value,name] of [['1','dark'],['2','bright'],['3','same-hue'],['4','busy']]){
  await page.getByRole('combobox',{name:'Comparison background'}).selectOption(value);await tick();await pair(name,panes);assert.deepEqual(errors,[]);check(`whole-surface adaptive shader renders ${name} comparison`);
 }
 await page.getByRole('slider',{name:'Adaptation strength'}).press('Home');await tick();await pair('zero',panes);check('zero-strength endpoint renders for pixel-parity validation');
 await page.getByRole('slider',{name:'Adaptation strength'}).press('End');await page.getByRole('button',{name:'Measure 100 / 1,000 / 5,000 spheres'}).click();
 await page.locator('[data-blend-timings][data-measurement-state="complete"]').waitFor({timeout:300000});report.timings=await page.locator('[data-blend-timings]').innerText();report.renderer=await page.locator('[data-blend-status]').innerText();check('one paired 100/1000/5000 run completes with explicit GPU availability');
 assert.deepEqual(await graph(),before);assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).appearance,SETTINGS_KEY),beforeAppearance);check('trial and measurements preserve authored atlas and appearance');
 assert.deepEqual(errors,[]);report.errors=errors;await page.screenshot({path:`${output}/comparison.png`});await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
}catch(e){report.errors=errors;report.failure=String(e);await page.screenshot({path:`${output}/failure.png`});await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));throw e;}finally{await browser.close();}
