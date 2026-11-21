import test from 'node:test';import assert from 'node:assert/strict';
import {originAxisLayout} from '../src/ui/originAxisLayout.ts';
import {AXIS_DIAL,dialPoint,dialSegments,dialTickWidth,pickAxisDial} from '../src/properties/axisDial.ts';
import {DEFAULT_ORIGIN_DIRECTIONS,directionSlots} from '../src/core/originDirections.ts';

test('all axis combinations and refinements have bounded, separated geometry and retain placement keys',()=>{
 for(let mask=0;mask<8;mask++)for(let halves=0;halves<=6;halves++){
  const active=[0,1,2].filter(axis=>mask&(1<<axis)),settings={...DEFAULT_ORIGIN_DIRECTIONS,halves,disabled:['0:1']},{rays,targets}=originAxisLayout(active,settings);
  assert.equal(rays.filter(r=>r.kind==='axis').length,3);
  for(const ray of rays){
   for(const {a,b}of dialSegments(ray)){
    for(const point of [a,b])assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y)&&Math.hypot(point.x,point.y)>.15&&Math.hypot(point.x,point.y)<=1);
    const midpoint={x:(a.x+b.x)/2,y:(a.y+b.y)/2};assert.equal(pickAxisDial(midpoint,rays),ray);
   }
   const target=targets.get(ray.id);assert.ok(target);
   assert.equal(ray.selected,'axis'in target?active.includes(target.axis):!settings.disabled.includes(target.key));
  }
  const ticks=rays.filter(r=>r.kind==='direction');
  assert.equal(ticks.length,active.length===0?0:active.length===1?2:directionSlots(settings).length);
  assert.equal(new Set(ticks.map(r=>targets.get(r.id).key)).size,ticks.length);
  assert.equal(pickAxisDial({x:0,y:0},rays),undefined);
  assert.equal(pickAxisDial({x:2,y:0},rays),undefined);
 }
});
test('dense subdivisions scale their stroke width to keep visible gaps instead of merging into a disc',()=>{
 for(const count of [2,4,8,16,32,64,128,256]){
  const width=dialTickWidth(count),spacing=2*Math.PI*.85/count;
  assert.ok(width>0&&width<spacing*.5);
  for(const size of [64,144,168,320])assert.ok(width*size/2<spacing*size/2);
 }
});
test('Unit mode keeps base axis controls without an independent set of direction ticks',()=>{
 for(const rings of [1,2,3,4]){
  const {rays,targets}=originAxisLayout([0,2],{...DEFAULT_ORIGIN_DIRECTIONS,mode:'unit',rings});
  assert.equal(rays.length,3);assert.ok([...targets.values()].every(target=>'axis'in target));
  for(const ray of rays)for(const sign of [-1,1])assert.equal(pickAxisDial(dialPoint(ray.point,AXIS_DIAL.axisOuter*sign),rays),ray);
 }
});
