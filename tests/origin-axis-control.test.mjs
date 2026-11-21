import test from 'node:test';import assert from 'node:assert/strict';
import {originAxisLayout} from '../src/ui/originAxisLayout.ts';
import {dialSegments,dialTickWidth,pickAxisDial} from '../src/properties/axisDial.ts';
import {DEFAULT_ORIGIN_DIRECTIONS,originAreaMask} from '../src/core/originDirections.ts';

test('all signed X/Y combinations have independent dial targets and preserve placement direction keys',()=>{
 for(let mask=0;mask<16;mask++)for(let halves=0;halves<=6;halves++){
  const sides=[0,1,2,3].filter(side=>mask&(1<<side)),settings={...DEFAULT_ORIGIN_DIRECTIONS,sides,halves,invert:false,pattern:'grid',disabled:['0:1']},{rays,targets}=originAxisLayout([0,1],settings);
  assert.equal(rays.filter(r=>r.kind==='axis').length,4);
  for(const ray of rays){
   for(const {a,b}of dialSegments(ray)){const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};assert.equal(pickAxisDial(mid,rays),ray);}
   const target=targets.get(ray.id);assert.ok(target);
   assert.equal(ray.selected,'axis'in target?sides.includes(target.axis*2+(target.sign===1?0:1)):!settings.disabled.includes(target.key));
   if('axis'in target)assert.ok(target.axis<2);
  }
  assert.equal(new Set(rays.map(ray=>ray.id)).size,rays.length);
  assert.equal(pickAxisDial({x:0,y:0},rays),undefined);assert.equal(pickAxisDial({x:2,y:0},rays),undefined);
 }
});
test('area highlights inherit exactly the placement mask for every signed-side combination and inversion',()=>{
 for(let bits=0;bits<16;bits++)for(const invert of [false,true]){
  const settings={...DEFAULT_ORIGIN_DIRECTIONS,mode:'area',sides:[0,1,2,3].filter(side=>bits&(1<<side)),invert};
  const layout=originAxisLayout([0,1],settings);assert.deepEqual(layout.areas,originAreaMask(settings));assert.equal(layout.rays.length,4);
 }
});
test('dense subdivision ticks retain gaps at every displayed size',()=>{
 for(const count of [2,4,8,16,32,64,128,256])for(const size of [64,144,168,320])assert.ok(dialTickWidth(count)*size/2<2*Math.PI*.85/count*size/2*.5);
});
test('Unit mode keeps signed-axis controls without a second set of axis refinement ticks',()=>{
 for(const rings of [1,2,3,4]){const {rays,targets}=originAxisLayout([0,1],{...DEFAULT_ORIGIN_DIRECTIONS,mode:'unit',rings,sides:[0,2]});assert.equal(rays.length,4);assert.ok([...targets.values()].every(target=>'axis'in target));}
});

test('Area exposes clickable enabled and disabled refinement ticks independently of colored axes',()=>{const value={...DEFAULT_ORIGIN_DIRECTIONS,mode:'area',halves:2,sides:[],disabled:['0:1']},layout=originAxisLayout([],value);assert.equal(layout.rays.length,16);const off=layout.rays.find(ray=>ray.id==='direction:0:1');assert.equal(off.selected,false);const segment=dialSegments(off)[0],point={x:(segment.a.x+segment.b.x)/2,y:(segment.a.y+segment.b.y)/2};assert.strictEqual(pickAxisDial(point,layout.rays),off);assert.deepEqual(layout.targets.get(off.id),{key:'0:1'});const on=originAxisLayout([],{...value,disabled:[]}).rays.find(ray=>ray.id===off.id);assert.equal(on.selected,true);});
