// Opt-in: user approved one built-worklet synthetic-tone connection check.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:5184/tests/system-audio.harness.html');
 await page.click('#connect');await page.waitForFunction(()=>window.audioProbe.audio.isSceneAudioConnected(),null,{timeout:10000});
 const trace=await page.evaluate(async()=>{
  const {audio,settings}=window.audioProbe,trace=[];
  for(let i=0;i<180;i++){trace.push({pulse:audio.sampleScenePulse(settings,1/120),...audio.sampleSceneAudio()});await new Promise(resolve=>setTimeout(resolve,1000/120));}
  return trace;
 });
 assert.ok(trace.some(s=>s.level>.1));assert.ok(trace.some(s=>s.bassAmplitude>.01));assert.ok(trace.some(s=>s.pulse>.1));assert.ok(trace.some(s=>s.level===0),'silence must clear the analyser, not hold old PCM');
 await page.click('#stop');assert.equal(await page.evaluate(()=>window.audioProbe.audio.isSceneAudioConnected()),false);
 await page.click('#connect');await page.waitForFunction(()=>window.audioProbe.audio.isSceneAudioConnected(),null,{timeout:10000});
 await page.click('#stop');assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>window.audioProbe.error),undefined);
 console.log(JSON.stringify({result:'PASS',samples:trace.length,maxLevel:Math.max(...trace.map(s=>s.level)),maxBass:Math.max(...trace.map(s=>s.bassAmplitude)),maxPulse:Math.max(...trace.map(s=>s.pulse)),silentSamples:trace.filter(s=>s.level===0).length}));
}finally{await browser.close();}
