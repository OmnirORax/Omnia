/** Untimed synthetic texture-path validation in the focused adaptive comparison scope. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.OMNIA_URL??'http://127.0.0.1:5182',output=process.env.OMNIA_ADAPTIVE_OUTPUT??'/workspace/work/adaptive-browser';if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Use localhost only.');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|glsl|validate_status/i.test(m.text()))errors.push(m.text());});
try{await page.goto(`${origin}/tests/adaptive-spheres.harness.html`);await page.waitForFunction(()=>typeof window.probeAdaptiveTexture==='function');const results=await page.evaluate(()=>window.probeAdaptiveTexture());assert.deepEqual(errors,[]);
 for(const r of results){assert.equal(r.hasImage,1);assert.ok(r.uv.max<=1,JSON.stringify(r));assert.ok(r.off.max<=1,JSON.stringify(r));assert.ok(r.zero.max<=1,JSON.stringify(r));assert.ok(r.on.changed>100,JSON.stringify(r));}
 await mkdir(output,{recursive:true});await writeFile(`${output}/texture-probe.json`,JSON.stringify({results,errors},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
