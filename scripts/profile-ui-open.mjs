/** Opt-in cold/warm frame diagnostic; isolated local storage, no normal CI hook. */
import {chromium} from 'playwright-core';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const [target='http://127.0.0.1:4173/',output='/tmp/omnia-ui-open.json']=process.argv.slice(2);
const url=new URL(target);if(!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Only a disposable local preview is supported.');
const master=process.env.OMNIA_OPEN_FRAME==='master',frame=master?'theme':'omnic-library',action=master?'appearance':'omnic.library',ready=master?'.appearance-controller':'[aria-label="Search library"]';
const browser=await chromium.launch({executablePath:process.env.OMNIA_CHROMIUM??'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).origin===url.origin?r.continue():r.abort());
 if(master){
  const {layout}=JSON.parse(await readFile(new URL('../src/ui/default-template.json',import.meta.url),'utf8'));
  layout.panels['@theme']=false;layout.windows.theme={x:992,y:90,width:350,height:600,collapsed:false,pinned:false};
  await page.addInitScript(layout=>localStorage.setItem('omnium.ui.layout.v1',JSON.stringify(layout)),layout);
 }
 await page.goto(url.href);await page.waitForSelector(`[data-ui-function="${action}"]`,{state:'attached'});await page.waitForTimeout(1500);
 const client=await page.context().newCDPSession(page);await client.send('Performance.enable');
 const metrics=async()=>Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 const difference=(before,after)=>Object.fromEntries(['RecalcStyleCount','LayoutCount','RecalcStyleDuration','LayoutDuration','ScriptDuration','TaskDuration'].map(key=>[key,after[key]-before[key]]));
 const phases=[],profilePrefix=process.env.OMNIA_PROFILE_CPU;
 if(profilePrefix)await client.send('Profiler.enable');
 for(const phase of ['first-open','collapse','re-expand']){
  const before=await metrics();if(profilePrefix)await client.send('Profiler.start');const start=await page.evaluate(()=>performance.now());
  await page.evaluate(({phase,action,frame})=>{
   const button=phase==='first-open'?document.querySelector(`[data-ui-function="${action}"]`):document.querySelector(`[data-ui-chrome="window:${frame}"] .ui-frame-handle button`);
   if(!button)throw Error('Frame control unavailable');button.click();
  },{phase,action,frame});
  if(phase==='first-open')await page.waitForSelector(ready,{state:'attached'});
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const ms=await page.evaluate(start=>performance.now()-start,start),after=await metrics();
  if(profilePrefix){const {profile}=await client.send('Profiler.stop');await writeFile(`${profilePrefix}-${phase}.cpuprofile`,JSON.stringify(profile));}
  phases.push({phase,ms,metrics:difference(before,after)});await page.waitForTimeout(500);
 }
 const before=await metrics();
 await page.evaluate(()=>{
  const root=document.createElement('section');root.id='cold-caption-probe';root.className='ui-workspace-overlay';root.dataset.uiResidentRoot='window:cold-caption-probe';
  root.style.cssText='position:fixed;left:0;top:0;max-height:600px;overflow:auto';
  for(let i=0;i<80;i++){const label=document.createElement('label');label.textContent=`Fresh caption ${i}`;label.style.fontSize='14px';root.append(label);}
  document.body.append(root);
 });
 await page.waitForFunction(()=>document.querySelectorAll('#cold-caption-probe label[data-ui-name-symbol]').length===80);
 const after=await metrics(),probe={captions:80,metrics:difference(before,after)};
 const invalid=await page.evaluate(()=>[...document.querySelectorAll('#cold-caption-probe label')].some(el=>el.style.getPropertyValue('--ui-name-size')!=='14px'));
 if(invalid)throw Error('Caption font sizes were not preserved');
 await page.locator('#cold-caption-probe').evaluate(el=>el.remove());
 if(errors.length)throw Error(errors.join('\n'));
 const report={source:process.env.OMNIA_PROFILE_SOURCE??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:process.env.OMNIA_PROFILE_SOURCE?null:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),target:url.href,fixture:`Fresh default workspace; first ${master?'Master controller':'Omnic library'} open, collapse and re-expand; then 80 newly inserted 14px captions`,method:`Local headless software-GPU; optional CPU profiler ${profilePrefix?'enabled':'disabled'}. CSS-only readiness query, two RAFs; timings include CDP round trips and are not physical input-to-display latency. Probe metrics also include other active app observers.`,phases,probe,checks:{captionSizes:true,noPageErrors:true},userAgent:await page.evaluate(()=>navigator.userAgent)};
 await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
