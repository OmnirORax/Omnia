import test from 'node:test';import assert from 'node:assert/strict';
import {imageColorCombo,matchedImageColors,comboPalette} from '../src/scene/colorCombo.ts';
import {focusPattern,focusRatio,focusPeriod} from '../src/properties/focusPalette.ts';
import {addRelationRow,relationCounts,relationProfile,relationError} from '../src/properties/colorRelations.ts';
import {createAutoColors,configureAutoColors} from '../src/scene/autoColors.ts';
import {setThemeFocus} from '../src/scene/themeControls.ts';
import {createStore} from '../src/core/store.ts';
import {readPaint} from '../src/core/appearance.ts';
import {validateWorld} from '../src/core/model.ts';
import {validTextPalette} from '../src/properties/textPalette.ts';
const colors=[[255,0,0],[0,0,255],[0,255,0],[255,255,0]];
function image(pixel){const width=64,height=64,pixels=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixels.set([...(typeof pixel(x,y)==='number'?colors[pixel(x,y)]:pixel(x,y)),255],(y*width+x)*4);return {pixels,width,height};}
function paint(sample,settings={}){const combo=imageColorCombo(sample);delete combo.source.spatial.rgb;for(const c of [...combo.source.accents,...combo.source.neutrals])c.salience=1;return comboPalette(matchedImageColors(combo,{distribution:'image',...settings}),{distribution:'image',...settings});}
function profile(p){const counts=relationCounts(p.colors.length);addRelationRow(counts,focusPattern(p).indices);return relationProfile(counts);}
const proportions=p=>{const indices=focusPattern(p).indices;return p.colors.map((_,i)=>indices.filter(c=>c===i).length/indices.length);};
test('equal occupation with broad alternating versus clustered image structure produces different matched layouts',()=>{
 const alternating=paint(image(x=>Math.floor(x/8)%2)),clustered=paint(image(x=>Number(x<32)));assert.deepEqual(focusRatio(alternating),focusRatio(clustered));assert.notDeepEqual(alternating.relations.horizontal,clustered.relations.horizontal);assert.notDeepEqual(focusPattern(alternating).indices,focusPattern(clustered).indices);
 for(const p of [alternating,clustered]){assert.ok(relationError(profile(p),p.relations.horizontal)<.02);assert.deepEqual(proportions(p),[.5,.5]);}
});
test('spatial inverse offsets the source while preserving grouping, pairing and shares',()=>{
 for(const sample of [image(x=>x%2),image(x=>Number(x<32))]){const matched=paint(sample),inverse={...matched,inverseDistribution:true};assert.deepEqual(proportions(inverse),proportions(matched));assert.deepEqual(profile(matched),profile(inverse));}
});
test('multicolor adjacency is matched independently of equal color shares',()=>{
 const a=paint(image(x=>Math.floor(x/8)%4)),b=paint(image(x=>[0,2,1,3][Math.floor(x/8)%4]));assert.deepEqual(a.colors,b.colors);assert.deepEqual(focusRatio(a),focusRatio(b));assert.notDeepEqual(a.relations.horizontal.pairs,b.relations.horizontal.pairs);assert.notDeepEqual(focusPattern(a).indices,focusPattern(b).indices);
 for(const p of [a,b]){const own=relationError(profile(p),p.relations.horizontal),other=relationError(profile(p),(p===a?b:a).relations.horizontal);assert.ok(own<other);assert.deepEqual(proportions(p),[.25,.25,.25,.25]);}
});
test('two-dimensional fields retain both axes independently of legacy strip direction',()=>{
 const p=paint(image(x=>x%2)),vertical={...p,distributionAxis:'vertical'};assert.notDeepEqual(p.relations.horizontal,p.relations.vertical);assert.deepEqual(focusPattern(p).indices,focusPattern(vertical).indices);assert.equal(focusPattern(p).width,64);assert.equal(focusPattern(p).height,64);
});
test('unselected colors do not create partners or consume relation positions',()=>{
 const compact=paint(image(x=>x%2)),gaps=paint(image(x=>x%2?[0,0,0]:colors[Math.floor(x/2)%2]),{motifOverrides:{h0:true,h5:true,n0:false}});assert.deepEqual(gaps.colors,compact.colors);assert.deepEqual(gaps.relations,compact.relations);assert.deepEqual(proportions(gaps),proportions(compact));
});
test('relation projection and layout caches survive tonal and scale edits; quotas survive occupation inversion',()=>{
 const combo=imageColorCombo(image(x=>x<32?0:x<48?1:2));delete combo.source.spatial.rgb;const settings={distribution:'image',ink:'color'},a=matchedImageColors(combo,settings),b=matchedImageColors(combo,{...settings,saturation:.4}),p=comboPalette(a,settings),q=comboPalette(b,{...settings,saturation:.4});assert.equal(a.textRelations,b.textRelations);assert.equal(focusPattern(p).indices,focusPattern(q).indices);assert.equal(focusPattern({...p,scale:3}),focusPattern(p));assert.equal(focusPeriod({...p,scale:3}),focusPattern(p).indices.length*3);
 for(const inverseOccupation of [false,true])for(const inverseDistribution of [false,true]){const settings={distribution:'image',inverseOccupation,inverseDistribution},paint=comboPalette(matchedImageColors(combo,settings),settings),ratio=focusRatio(paint),total=ratio.reduce((a,b)=>a+b,0);assert.deepEqual(proportions(paint),ratio.map(n=>n/total));}
});
test('automatic image relations persist through shared rendering without replacing explicit manual arrangements',async()=>{
 const store=createStore({getItem:()=>null,setItem(){}}),errors=[];let samples=0;const auto=createAutoColors({read:()=>store.world,change:edit=>store.change(edit),sample:async()=>{samples++;return image(x=>x%2);},error:e=>errors.push(e)});store.subscribe(auto.update);store.change(w=>configureAutoColors(w,undefined,true));await auto.settle();let p=readPaint(store.world,'text').palette;assert.equal(p.distribution,'image');assert.equal(p.inverseDistribution,true);assert.ok(p.relations);assert.equal(validTextPalette(p),true);const saved=validateWorld(JSON.parse(JSON.stringify(store.world)));assert.deepEqual(readPaint(saved,'text').palette.relations,p.relations);
 store.change(w=>setThemeFocus(w,undefined,{distribution:'growing'}));await auto.settle();p=readPaint(store.world,'text').palette;assert.equal(p.distribution,'growing');assert.equal(p.relations,undefined);store.change(w=>setThemeFocus(w,undefined,{distribution:'image',inverseDistribution:true}));await auto.settle();assert.ok(readPaint(store.world,'text').palette.relations);assert.equal(samples,1);assert.deepEqual(errors,[]);auto.dispose();
});
test('stored relation dimensions and numeric bounds reject malformed or oversized profiles',()=>{
 const p=paint(image(x=>x%4));for(const relations of [[],{}, {horizontal:{clustering:[0],pairs:[]},vertical:p.relations.vertical},{...p.relations,horizontal:{...p.relations.horizontal,clustering:[256,0,0]}},{...p.relations,vertical:{...p.relations.vertical,pairs:Array(100).fill(0)}}])assert.equal(validTextPalette({...p,relations}),false);
});
