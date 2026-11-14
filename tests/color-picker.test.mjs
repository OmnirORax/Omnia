import test from 'node:test';
import assert from 'node:assert/strict';
import {channelColor,colorChannels,createColorSession} from '../src/ui/colorSession.ts';
import {createValueScrub} from '../src/composer/runtime/ui/valueScrub.ts';
import {horizontalValue} from '../src/ui/valueDrag.ts';
function fixture(){const frames=new Map(),events=[];let id=0;const session=createColorSession('#102030',{preview:value=>events.push(['preview',value]),commit:value=>events.push(['commit',value]),cancel:value=>events.push(['cancel',value])},run=>{frames.set(++id,run);return id;},key=>frames.delete(key));return {session,frames,events};}
test('every RGB channel value round trips and compact slider/readout drags retain single-unit precision',()=>{
 for(let channel=0;channel<3;channel++)for(let value=0;value<256;value++){const channels=[16,32,48];channels[channel]=value;assert.deepEqual(colorChannels(channelColor(channels)),channels);}
 const scrub=createValueScrub({origin:{x:100,y:0},width:150,value:128,min:0,max:255,step:1,pixelsPerStep:1,axis:{x:1,y:0}});
 for(let delta=-20;delta<=20;delta++){assert.equal(scrub.sample({x:100+delta,y:0}),128+delta);assert.equal(horizontalValue({value:128,min:0,max:255,step:1,pixelsPerStep:1},delta),128+delta);}
});
test('color previews coalesce before the owning input and accepting flushes the final color exactly once',()=>{
 const {session,frames,events}=fixture();session.set('#112030');session.set('#122030');assert.equal(frames.size,1);assert.deepEqual(events,[]);
 [...frames.values()][0]();assert.deepEqual(events,[['preview','#122030']]);
 session.set('#132030');session.finish(true);session.finish(true);assert.deepEqual(events.slice(1),[['preview','#132030'],['commit','#132030']]);assert.equal(frames.size,0);
});
test('Escape discards queued colors and restores the original without committing',()=>{
 const {session,frames,events}=fixture();session.set('#ffffff');session.finish(false);session.set('#000000');assert.deepEqual(events,[['cancel','#102030']]);assert.equal(frames.size,0);
 assert.throws(()=>colorChannels('#abc'));assert.throws(()=>channelColor([1,NaN,3]));
});
