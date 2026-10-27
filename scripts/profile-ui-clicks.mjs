/** Opt-in synthetic diagnostic, never run by normal CI/browser suites. */
import {chromium} from 'playwright-core';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {emptyDocument} from '../src/graph/structural.ts';
const [target='http://127.0.0.1:4173/',output='/tmp/omnia-ui-clicks.json']=process.argv.slice(2);
const url=new URL(target);
if(!['127.0.0.1','localhost'].includes(url.hostname))throw Error('This diagnostic only targets a local disposable preview.');
const browser=await chromium.launch({executablePath:process.env.OMNIA_CHROMIUM??'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
  const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===url.origin?route.continue():route.abort());
  const fixture=emptyDocument();
  for(let i=0;i<12;i++){
    fixture.entities.push({id:`e${i}`,label:`Node ${i}`,aliases:[],notes:''});
    fixture.placements.push({id:`p${i}`,entityId:`e${i}`,parentId:null,position:{x:i*100,y:0},spatialPosition:{x:(i%4)*3,y:Math.floor(i/4)*2,z:0},collapsed:false,hidden:false});
  }
  await page.addInitScript(data=>localStorage.setItem('omnium.atlas.v2',JSON.stringify(data)),fixture);
  await page.goto(url.href);await page.waitForSelector('[data-ui-function="omnic.library"]',{state:'attached'});
  await page.keyboard.press('Control+a');
  await page.evaluate(()=>document.querySelector('[data-ui-function="omnic.library"]').click());
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(e=>e.textContent==='Structural filters'&&e.getClientRects().length));
  await page.waitForTimeout(2000);
  // Optional attribution only; keep this off for ordinary timing comparisons.
  const countDiscovery=process.env.OMNIA_PROFILE_DOM==='1';
  if(countDiscovery)await page.evaluate(()=>{
    const original=Document.prototype.querySelectorAll;
    window.__omniaDiscoveryCounts={uiSelectionScans:0};
    Document.prototype.querySelectorAll=function(selector){
      if(selector==='[data-ui-function]:not([data-ui-palette]),[data-ui-drag^="window:"],[data-ui-drag^="frame:"]')window.__omniaDiscoveryCounts.uiSelectionScans++;
      return original.call(this,selector);
    };
  });
  const profilePath=process.env.OMNIA_PROFILE_CPU;
  const client=profilePath?await page.context().newCDPSession(page):null;
  if(client){await client.send('Profiler.enable');await client.send('Profiler.start');}
  const samples=await page.evaluate(async()=>{
    const result=[];
    for(let i=0;i<8;i++){
      const button=[...document.querySelectorAll('button')].find(e=>e.textContent==='Structural filters'&&e.getClientRects().length);
      if(!button)throw Error('Structural filters control unavailable.');
      const expanded=button.getAttribute('aria-expanded'),start=performance.now();button.click();const handlerMs=performance.now()-start;
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      result.push({handlerMs,twoRafMs:performance.now()-start,toggled:button.getAttribute('aria-expanded')!==expanded});
    }return result;
  });
  if(client){const {profile}=await client.send('Profiler.stop');await writeFile(profilePath,JSON.stringify(profile));}
  if(samples.some(s=>!s.toggled))throw Error('A toggle did not change its expanded state.');
  if(errors.length)throw Error(errors.join('\n'));
  const sorted=samples.map(s=>s.twoRafMs).sort((a,b)=>a-b);
  const report={version:1,source:process.env.OMNIA_PROFILE_SOURCE??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:process.env.OMNIA_PROFILE_SOURCE?null:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),target:url.href,fixture:'12 ordinary nodes; Ctrl+A selection; default UI; 8 Structural filters toggles',method:`Programmatic handler and two RAFs; CPU profiler ${client?'enabled':'disabled'}. Not physical input-to-display latency. Fresh headless browser; nonlocal requests blocked. No timing pass/fail threshold.`,discovery:countDiscovery?await page.evaluate(()=>window.__omniaDiscoveryCounts):undefined,samples,medianTwoRafMs:(sorted[3]+sorted[4])/2,userAgent:await page.evaluate(()=>navigator.userAgent)};
  await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,medianTwoRafMs:report.medianTwoRafMs,toggles:samples.length}));
}finally{await browser.close();}
