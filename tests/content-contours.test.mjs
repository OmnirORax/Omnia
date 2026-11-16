import {expansionState,nodeContentVisible,toggleContent} from '../src/graph/nodePresentation.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {alphaHull,contentEnvelope} from '../src/world/contentEnvelope.ts';
import {createContentContour,collectContentHull} from '../src/world/contentContour.ts';
import {pushContours,contourClearance} from '../src/world/contourPush.ts';
import {pointerPlane} from '../src/navigation/pointerPlane.ts';
const circle=radius=>contentEnvelope([{x:0,y:0}],radius,32);
const node=(id,x,y,points=circle(.4))=>({id,x,y,points});
const moved=(items,positions)=>items.map(i=>({...i,...positions.get(i.id)}));
function clear(items){for(let n=0;n<items.length;n++)for(let m=n+1;m<items.length;m++){const a=items[n],b=items[m],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);assert.equal(contourClearance(a,b,{x:dx/(d||1),y:dy/(d||1)},0),0,`overlap ${a.id}/${b.id}`);}}

test('one padded ink envelope bridges letters/holes without including bounding-box corners',()=>{
 const width=80,height=40,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if([20,60].some(cx=>Math.hypot(x-cx,y-20)<10&&Math.hypot(x-cx,y-20)>5))data[(y*width+x)*4+3]=255;
 const hull=alphaHull(data,width,height),contour=createContentContour();contour.update(hull,1);assert.equal(contour.points.length,64);
 contour.hit.updateMatrixWorld();const ray=new T.Raycaster(new T.Vector3(0,0,2),new T.Vector3(0,0,-1));assert.ok(ray.intersectObject(contour.hit).length,'gap between letters belongs to one node');
 const right=Math.max(...contour.points.map(p=>p.x)),top=Math.max(...contour.points.map(p=>p.y));ray.ray.origin.set(right-.002,top-.002,2);assert.equal(ray.intersectObject(contour.hit).length,0,'no rectangular hit box');
 const before=structuredClone(hull);contour.update(hull,1);assert.deepEqual(hull,before);contour.update([],1);assert.equal(contour.outline.visible,false);assert.equal(contour.hit.visible,false);contour.dispose();
});
test('hull collection applies content-local transforms and never reads parent push/camera transforms',()=>{
 const parent=new T.Group(),glyph=new T.Group();parent.position.set(20,30,40);parent.add(glyph);glyph.position.set(.3,.2,0);glyph.scale.setScalar(2);const points=[{x:-.5,y:0},{x:.5,y:0},{x:0,y:.5}];glyph.userData.contentHull=()=>points;
 const hull=collectContentHull(glyph);assert.ok(hull.some(p=>p.x===-.7&&p.y===.2));const before=structuredClone(hull);parent.position.set(-100,400,20);parent.rotation.z=1;assert.deepEqual(collectContentHull(glyph),before);
});
test('hovered middle contour stays anchored and pushes only intersecting neighbors along their row',()=>{
 const items=[node('left',-1,0),node('middle',0,0,contentEnvelope([{x:-2,y:0},{x:2,y:0}],.2)),node('right',1,0),node('unrelated',100,30)],before=structuredClone(items);
 const result=pushContours(items,{id:'middle',x:0,y:0},.03);assert.deepEqual(result.get('middle'),{x:0,y:0});assert.ok(result.get('left').x< -2.5);assert.ok(result.get('right').x>2.5);assert.equal(result.get('left').y,0);assert.equal(result.get('right').y,0);assert.deepEqual(result.get('unrelated'),{x:100,y:30});clear(moved(items,result));assert.deepEqual(items,before);
});
test('local pushes cascade and recomputing smaller contours restores the baseline without drift',()=>{
 const items=[-3,-2,-1,0,1,2,3].map(n=>node(String(n),n,0,n?circle(.4):contentEnvelope([{x:-2,y:0},{x:2,y:0}],.2)));
 const result=pushContours(items,{id:'0',x:0,y:0},.02);clear(moved(items,result));for(let n=1;n<items.length;n++)assert.ok(result.get(items[n].id).x>result.get(items[n-1].id).x);
 const small=items.map(i=>({...i,points:circle(.4)})),restored=pushContours(small,{id:'0',x:0,y:0},.02);for(const i of small)assert.deepEqual(restored.get(i.id),{x:i.x,y:i.y});assert.deepEqual(pushContours(items,{id:'0',x:0,y:0},.02),result);
});
test('a previously displaced active node remains fixed and neighbors keep their original side',()=>{
 const items=[node('left',-1,0),node('root',0,0,circle(2)),node('right',1,0)];const result=pushContours(items,{id:'root',x:3,y:0},.01);assert.deepEqual(result.get('root'),{x:3,y:0});assert.ok(result.get('right').x>3);assert.ok(result.get('left').x<3);clear(moved(items,result));
});
test('large contents spill beyond the viewport without changing their sizes, directions or anchors',()=>{
 const items=[node('root',0,0,circle(1e5)),node('neighbor',1,1)];const before=structuredClone(items),result=pushContours(items,{id:'root',x:0,y:0},.03),p=result.get('neighbor');assert.ok(p.x>1000&&p.y>1000);assert.ok(Math.abs(p.x-p.y)<1e-7);clear(moved(items,result));assert.deepEqual(items,before);
});
test('dense/tied contours remain deterministic, separated and finite under bounded solving',()=>{
 const shared=circle(3),items=Array.from({length:100},(_,n)=>node(String(n),n%10,Math.floor(n/10),shared)),result=pushContours(items,{id:'55',x:5,y:5},.02);clear(moved(items,result));assert.deepEqual(result,pushContours([...items].reverse(),{id:'55',x:5,y:5},.02));
 const tied=[node('a',0,0),node('b',0,0),node('c',0,0)];clear(moved(tied,pushContours(tied,{id:'b',x:0,y:0},.03)));
});
test('temporary parent displacement keeps picking, drag deltas and canonical coordinates consistent through camera moves',()=>{
 const scene=new T.Scene(),host=new T.Group(),group=new T.Group(),presentation=new T.Group(),contour=createContentContour();scene.add(host);host.add(group);group.add(presentation);presentation.add(contour.hit,contour.outline);group.position.set(1,0,0);host.position.set(3,1,0);contour.hit.userData.origin='node';contour.update([{x:-1,y:0},{x:1,y:0}],1);
 const camera=new T.PerspectiveCamera(55,1,.01,100);camera.position.set(2,4,10);camera.lookAt(0,0,0);camera.updateMatrixWorld();presentation.quaternion.copy(camera.quaternion);scene.updateMatrixWorld(true);
 const shown=group.getWorldPosition(new T.Vector3()),p=shown.clone().project(camera),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(p.x,p.y),camera);assert.equal(ray.intersectObject(contour.hit)[0].object.userData.origin,'node');
 const viewport={left:0,top:0,width:800,height:800},project=pointerPlane(camera,viewport,shown),start={x:(p.x+1)*400,y:(1-p.y)*400},delta=project({x:start.x+20,y:start.y}).sub(project(start));const baseline=group.position.clone();group.position.add(delta);assert.ok(group.getWorldPosition(new T.Vector3()).distanceTo(shown.clone().add(delta))<1e-8);assert.deepEqual(host.position,new T.Vector3(3,1,0));group.position.copy(baseline);
 const hull=structuredClone(contour.points);camera.position.set(-6,3,8);camera.lookAt(0,0,0);camera.updateMatrixWorld();presentation.quaternion.copy(camera.quaternion);scene.updateMatrixWorld(true);assert.deepEqual(host.position,new T.Vector3(3,1,0));assert.deepEqual(contour.points,hull);assert.deepEqual(group.position,baseline);contour.dispose();
});

test('content on/off applies to all content; focus stays visible without hover reveal or sticky click-hiding',()=>{
 const state=expansionState();assert.equal(nodeContentVisible(state,'a','all',false,false),true);assert.equal(nodeContentVisible(state,'a','selection',false,false),false);assert.equal(nodeContentVisible(state,'a','selection',true,false),true);assert.equal(nodeContentVisible(state,'a','selection',false,true),false);
 toggleContent(state,'a',true);assert.equal(nodeContentVisible(state,'a','all',true,true),true);assert.equal(nodeContentVisible(state,'a','selection',true,false),true);toggleContent(state,'a',true);assert.equal(nodeContentVisible(state,'a','selection',false,false),true);
});

test('untouched closed-node overlaps outside the activated component do not trigger unrelated rearrangement',()=>{
 const root=node('root',0,0,circle(2)),near={...node('near',1,0),passive:true},far=[{...node('far-a',100,0),passive:true},{...node('far-b',100.5,0),passive:true}];
 const items=[root,near,...far],result=pushContours(items,{id:'root',x:0,y:0},0);assert.ok(result.get('near').x>2);for(const i of far)assert.deepEqual(result.get(i.id),{x:i.x,y:i.y});clear(moved([root,near],result));
});

test('relocation temporarily uses the carrier and restores content without leaving a hiding record',()=>{
 const state=expansionState(),before=structuredClone(state);
 for(const mode of ['all','selection']){assert.equal(nodeContentVisible(state,'a',mode,true,true,true),false);assert.equal(nodeContentVisible(state,'a',mode,true,false,false),true);}
 assert.deepEqual(state,before);assert.equal(nodeContentVisible(state,'a','selection',false,true),false);
});
test('reference endpoints remain at canonical centers while mobile content clears both',()=>{
 const a={...node('a',0,0,circle(2)),fixed:true},b={...node('b',3,0,circle(2)),fixed:true},c=node('c',1,0,circle(1));
 for(const pin of [undefined,{id:'a',x:0,y:0}]){
  const positions=pushContours([c,b,a],pin,0);assert.deepEqual(positions.get('a'),{x:0,y:0});assert.deepEqual(positions.get('b'),{x:3,y:0});
  const mobile={...c,...positions.get('c')};assert.equal(contourClearance(a,mobile,{x:1,y:0}),0);assert.equal(contourClearance(b,mobile,{x:1,y:0}),0);
 }
});
