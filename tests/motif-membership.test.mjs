import test from 'node:test';import assert from 'node:assert/strict';
import {extractScenePalette,sampleSceneGrid} from '../src/scene/palette.ts';
import {motifCandidates,imageColorCombo,matchedImageColors,comboPalette} from '../src/scene/colorCombo.ts';
import {focusPattern,focusPeriod} from '../src/properties/focusPalette.ts';
import {validPaletteSettings} from '../src/properties/textPalette.ts';
import {createAutoColors,configureAutoColors} from '../src/scene/autoColors.ts';
import {setMotifMembership,setThemeFocus} from '../src/scene/themeControls.ts';
import {createStore} from '../src/core/store.ts';
import {readPaint} from '../src/core/appearance.ts';
import {validateWorld} from '../src/core/model.ts';
function image(pixel,width=64,height=64){const pixels=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixels.set([...pixel(x,y),255],(y*width+x)*4);return {pixels,width,height};}
const accentImage=()=>image((x,y)=>(x%32>=14&&x%32<18&&y%32>=14&&y%32<18)?[255,0,0]:[70,85,100]);
const source={tones:{background:0,low:0,high:1,darkSupport:true},neutrals:[],accents:[{id:'h0',color:'#ff0000',weight:.6,salience:.3},{id:'h3',color:'#00ff00',weight:.3,salience:.5},{id:'h5',color:'#0000ff',weight:.1,salience:1}]};
test('a small recurring accent outranks a broad uniform tint and membership precedes occupation',()=>{
 const p=extractScenePalette(accentImage()),candidates=motifCandidates(p);assert.equal(candidates[0].id,'h0');assert.ok(candidates[0].weight<.02);assert.equal(candidates[0].enabled,true);assert.equal(candidates[0].occupation,1);const background=candidates.find(c=>c.id==='h5');assert.ok(background.weight>.98);assert.equal(background.enabled,false);assert.equal(background.occupation,undefined);
 const selected=motifCandidates(p,{motifOverrides:{h5:true}});assert.equal(selected[0].occupation,selected[0].weight);assert.equal(selected[1].occupation,selected[1].weight);
});
test('black remains eligible as a structured motif and is not forced into every dark image',()=>{
 const structured=motifCandidates(extractScenePalette(image((x,y)=>(Math.floor(x/4)+Math.floor(y/4))%2?[255,0,0]:[0,0,0])));assert.deepEqual(new Set(structured.filter(c=>c.enabled).map(c=>c.id)),new Set(['h0','n0']));
 const space=motifCandidates(extractScenePalette(image((x,y)=>x%32>=14&&x%32<18&&y%32>=14&&y%32<18?[0,180,255]:[0,0,0])));assert.equal(space.find(c=>c.id==='n0').enabled,false);assert.equal(motifCandidates(extractScenePalette(accentImage()),{motifOverrides:{h5:true}}).find(c=>c.id==='h5').enabled,true);
});
test('occupation inversion reverses share assignments independently of attention order',()=>{
 const normal=motifCandidates(source),inverse=motifCandidates(source,{inverseOccupation:true});assert.deepEqual(normal.map(c=>c.id),['h5','h3','h0']);assert.deepEqual(normal.map(c=>c.occupation),[.1,.3,.6]);assert.deepEqual(inverse.map(c=>c.id),normal.map(c=>c.id));assert.deepEqual(inverse.map(c=>c.occupation),[.6,.3,.1]);
 const selected=motifCandidates(source,{motifOverrides:{h3:false},inverseOccupation:true});assert.equal(selected.find(c=>c.id==='h3').occupation,undefined);assert.ok(Math.abs(selected.find(c=>c.id==='h5').occupation-6/7)<1e-12);
});
test('distribution inverses rearrange identical occupation proportions without changing scale or coupled ink/glow',()=>{
 const base={...imageColorCombo(new Uint8ClampedArray([255,0,0,255])),source};
 for(const distribution of ['balanced','growing'])for(const inverseOccupation of [false,true]){
  const settings={distribution,inverseOccupation,ink:'pale'},combo=matchedImageColors(base,settings),p=comboPalette(combo,settings),inverse={...p,inverseDistribution:true},a=focusPattern(p),b=focusPattern(inverse),histogram=pattern=>p.colors.map((_,i)=>pattern.indices.filter(n=>n===i).length/pattern.indices.length);
  assert.deepEqual(histogram(a),histogram(b));assert.notDeepEqual(a.indices,b.indices);assert.equal(focusPeriod({...inverse,scale:3}),b.indices.length*3);assert.equal(focusPattern({...inverse,scale:3}),b);
  for(const pattern of [a,b])for(let i=0;i<pattern.indices.length;i++)for(let channel=0;channel<3;channel++)assert.ok(Math.abs(pattern.ink[i*4+channel]-(255*.75+pattern.glow[i*4+channel]*.25))<=1);
 }
});
test('spatial sampling retains dimensions, bounded storage and the source byte grid',()=>{
 const original=image((x,y)=>[x%256,y%256,0],320,180),sample=sampleSceneGrid(original.pixels,original.width,original.height);assert.ok(sample.width*sample.height<=4096);assert.equal(sample.pixels.length,sample.width*sample.height*4);assert.ok(Math.abs(sample.width/sample.height-320/180)<.05);assert.notEqual(sample.pixels[0],sample.pixels[(sample.width-1)*4]);assert.notEqual(sample.pixels[1],sample.pixels[(sample.height-1)*sample.width*4+1]);
});
test('membership edits persist as deltas, retain inherited rendering and reuse cached spatial evidence',async()=>{
 const store=createStore({getItem:()=>null,setItem(){}});let samples=0,notifications=0;const errors=[],auto=createAutoColors({read:()=>store.world,change:edit=>store.change(edit),sample:async()=>{samples++;return accentImage();},error:e=>errors.push(e)}),stop=auto.subscribe(()=>notifications++);store.subscribe(auto.update);
 store.change(w=>configureAutoColors(w,undefined,true));await auto.settle();let candidates=auto.motifs(store.world);assert.equal(candidates[0].occupation,1);assert.equal(notifications,1);
 store.change(w=>setMotifMembership(w,undefined,'h5',true,candidates));await auto.settle();candidates=auto.motifs(store.world);assert.equal(candidates.filter(c=>c.enabled).length,2);assert.equal(samples,1);assert.ok(readPaint(store.world,'text').palette.weights.some(n=>n>.98));
 store.change(w=>setThemeFocus(w,undefined,{inverseOccupation:true,inverseDistribution:true,distribution:'growing',scale:2}));await auto.settle();const p=readPaint(store.world,'text').palette;assert.equal(p.inverseOccupation,true);assert.equal(p.inverseDistribution,true);assert.equal(p.distribution,'growing');assert.equal(p.scale,2);assert.equal(samples,1);
 const saved=JSON.parse(JSON.stringify(store.world));validateWorld(saved);assert.deepEqual(saved.appearance.imageColors.default.palette.motifOverrides,{h5:true});assert.deepEqual(errors,[]);
 store.change(w=>setMotifMembership(w,undefined,'h5',false,auto.motifs(store.world)));await auto.settle();assert.equal(auto.motifs(store.world).find(c=>c.id==='h5').enabled,false);assert.throws(()=>store.change(w=>setMotifMembership(w,undefined,'h0',false,auto.motifs(store.world))),/at least one/);stop();auto.dispose();
});
test('retired selectors migrate without losing existing ink, scale, direction or manual channels',()=>{
 const store=createStore({getItem:()=>null,setItem(){}});store.change(w=>configureAutoColors(w,undefined,true,false,{selection:'rare',top:1,distribution:'mirrored',scale:7,ink:'pale',distributionAxis:'vertical'}));const p=store.world.appearance.imageColors.default.palette;assert.equal(p.selection,undefined);assert.equal(p.top,undefined);assert.equal(p.distribution,'balanced');assert.equal(p.ink,'pale');assert.equal(p.scale,7);assert.equal(p.distributionAxis,'vertical');
 for(const bad of [{motifOverrides:{h0:'yes'}},{motifOverrides:['h0']},{motifOverrides:{alien:true}},{inverseOccupation:'yes'},{inverseDistribution:1}])assert.equal(validPaletteSettings(bad),false);
});

test('equal shares still support clustered inversion and growing runs rather than a phase-only flip',()=>{
 const p={mode:'text',colors:['#ff0000','#0000ff'],imageRatio:[1,1],distribution:'balanced'},normal=focusPattern(p),inverse=focusPattern({...p,inverseDistribution:true}),growing=focusPattern({...p,distribution:'growing'}),transitions=pattern=>pattern.indices.reduce((sum,c,i,all)=>sum+Number(c!==all[(i+1)%all.length]),0)/pattern.indices.length;
 assert.equal(transitions(normal),1);assert.ok(transitions(inverse)<.5);assert.ok(transitions(growing)<1);assert.ok(growing.indices.length<=4096);assert.equal(inverse.indices.filter(i=>i===0).length,inverse.indices.filter(i=>i===1).length);
});
