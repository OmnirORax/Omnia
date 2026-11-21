import test from 'node:test';import assert from 'node:assert/strict';
import {emptyWorld,addStructure,validateWorld} from '../src/core/model.ts';
import {setSpatialOrigin,aimFramePoint,axisCenter,axisPoint,operationSlot,projectionAxis} from '../src/core/axes.ts';
import {DEFAULT_ORIGIN_DIRECTIONS,planarOriginDirections,toggleOriginSide,sideAxes,originAreaMask,originAreaContains,changeOriginMode,hasOriginDirections} from '../src/core/originDirections.ts';
import {createPaintSession} from '../src/core/painting.ts';
import {snapSlots} from '../src/core/planePacking.ts';
import {paintNodes} from '../src/core/nodeOperations.ts';
const basis=[[1,0,0],[0,1,0],[0,0,1]],near=(a,b)=>a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<1e-7,`${a} != ${b}`));
function harness(settings={}){const world=emptyWorld(),frame=setSpatialOrigin(world,undefined,[0,0,0],basis[0],basis[1],'camera');frame.activeAxes=[0,1];frame.directions={...planarOriginDirections(undefined),...settings};return {world,frame,session:()=>createPaintSession(world,[0,0,0],basis,frame)};}

test('tap-origin explicitly resets a previously aimed frame to camera basis while inherited moves retain it',()=>{
 const h=harness(),node=addStructure(h.world,[3,4,5],1),before=structuredClone(h.world.nodes);
 aimFramePoint(h.world,h.frame.id,[8,0,0]);near(h.frame.z,[1,0,0]);
 setSpatialOrigin(h.world,node.origin,[1,2,3],basis[0],basis[1]);near(h.frame.z,[1,0,0]);
 setSpatialOrigin(h.world,node.origin,[1,2,3],basis[0],basis[1],'camera');near(h.frame.z,[0,0,1]);near(h.frame.x,basis[0]);near(h.frame.y,basis[1]);near(axisCenter(h.world,h.frame),[1,2,3]);assert.deepEqual(h.world.nodes,before);
 const saved=structuredClone(h.frame);assert.throws(()=>aimFramePoint(h.world,h.frame.id,[1,2,3]),/away/);assert.deepEqual(h.frame,saved);
 assert.equal(projectionAxis(h.frame,[0,-1,0]),2);
});
test('axis clicks cycle whole axis, clicked side, off and Z cannot be activated',()=>{
 let settings=planarOriginDirections(undefined);settings=toggleOriginSide(settings,[0,1],0,-1);assert.deepEqual(settings.sides,[1,2,3]);settings=toggleOriginSide(settings,[0,1],0,-1);assert.deepEqual(sideAxes(settings.sides),[1]);settings=toggleOriginSide(settings,[1],0);assert.deepEqual(settings.sides,[0,1,2,3]);assert.throws(()=>toggleOriginSide(settings,[0,1],2),/facing-only/);
 const h=harness({sides:[0],symmetry:false}),positive=h.session().candidate([3,0,20]);near(positive.anchor,[3,0,0]);assert.equal(positive.valid,true);const rejected=h.session().candidate([-3,0,0]);assert.equal(rejected.valid,false);assert.match(rejected.rejection,/behind/);
});
test('signed directions define quadrants, full axes define the full plane, and invert selects the complement',()=>{
 const h=harness({mode:'area',sides:[0,2]});assert.deepEqual(originAreaMask(h.frame.directions),[true,false,false,false]);assert.equal(h.session().candidate([2,3,0]).valid,true);assert.equal(h.session().candidate([-2,3,0]).valid,false);
 h.frame.directions={...h.frame.directions,invert:true};assert.deepEqual(originAreaMask(h.frame.directions),[false,true,true,true]);assert.equal(h.session().candidate([2,3,0]).valid,false);assert.equal(h.session().candidate([-2,3,0]).valid,true);
 h.frame.directions={...h.frame.directions,sides:[0,1,2,3],invert:false};assert.deepEqual(originAreaMask(h.frame.directions),[true,true,true,true]);
 h.frame.directions={...h.frame.directions,invert:true};assert.equal(h.session().candidate([2,3,0]).valid,false);assert.match(h.session().candidate([2,3,0]).rejection,/empty/);
 h.frame.directions={...h.frame.directions,sides:[0,1]};assert.match(h.session().candidate([2,3,0]).rejection,/two non-opposite directions/);
});
test('all 16 signed-side combinations and their inverse have coherent highlighted area membership',()=>{
 for(let bits=0;bits<16;bits++)for(const invert of [false,true]){
  const sides=[0,1,2,3].filter(side=>bits&(1<<side)),settings={...DEFAULT_ORIGIN_DIRECTIONS,mode:'area',sides,invert},mask=originAreaMask(settings);
  for(const [index,p]of [[2,2],[-2,2],[-2,-2],[2,-2]].entries())assert.equal(originAreaContains(mask,...p),mask[index]);
 }
});
test('Area grid and hex snapping, mirrored preview, relocation and persistence use the same rule',()=>{
 for(const pattern of ['grid','hex']){
  const h=harness({mode:'area',pattern,symmetry:true}),candidate=h.session().candidate([2.6,2.7,30]);assert.equal(candidate.valid,true);assert.equal(candidate.stamp.length,4);
  const expected=snapSlots([2.6,2.7,0],[0,1],pattern==='hex');near(candidate.anchor,expected);near(axisPoint(h.world,h.frame,operationSlot(h.world,h.frame,[2.6,2.7,30])),expected);
  for(const p of candidate.stamp)near(snapSlots(p,[0,1],pattern==='hex'),p);
  paintNodes(h.world,candidate.stamp,undefined,h.frame.id);assert.deepEqual(validateWorld(JSON.parse(JSON.stringify(h.world))).axes[0].directions,h.frame.directions);
 }
});
test('Area symmetry fills only selected areas and an occupied mirror rejects the atomic stamp',()=>{
 const h=harness({mode:'area',sides:[0,1,2],symmetry:true}),candidate=h.session().candidate([2,3,0]);assert.equal(candidate.stamp.length,2);assert.ok(candidate.stamp.every(p=>p[1]===3));addStructure(h.world,[-2,3,0],1);const rejected=h.session().candidate([2,3,0]);assert.equal(rejected.valid,false);assert.match(rejected.rejection,/overlap/);assert.equal(h.world.nodes.length,1);
});
test('an unprojectable drawing plane cannot silently paint its origin',()=>{
 const h=harness(),session=createPaintSession(h.world,[0,0,0],basis,h.frame,2,false,undefined,undefined,()=>false),candidate=session.candidate([0,0,0]);assert.equal(candidate.valid,false);assert.equal(candidate.stamp.length,0);assert.match(candidate.rejection,/Press P/);assert.equal(session.add([0,0,0]),false);
});

test('Area rejects brushes that spill across its boundary instead of painting forbidden positions',()=>{
 const h=harness({mode:'area',sides:[0,2]});h.world.brush={kind:'sphere',radius:1};const rejected=h.session().candidate([0,3,0]);assert.equal(rejected.valid,false);assert.match(rejected.rejection,/outside the active area/);assert.equal(h.session().candidate([3,3,0]).valid,true);
});
test('P can face the drawing plane even when all placement sides are disabled, without changing the camera during planning',async()=>{
 const T=await import('three'),{userPositionPlan}=await import('../src/world/userPosition.ts'),h=harness({sides:[]});h.frame.activeAxes=[];aimFramePoint(h.world,h.frame.id,[4,0,0]);
 const camera=new T.PerspectiveCamera(50,1,.1,100);camera.position.set(3,4,5);camera.lookAt(0,0,0);const before=camera.position.clone(),plan=userPositionPlan(h.frame,new T.Vector3(),camera.position,new T.Box3(new T.Vector3(-1,-1,-1),new T.Vector3(1,1,1)),camera)(5);
 assert.ok(Math.abs(plan.position.clone().normalize().dot(new T.Vector3(...h.frame.z)))>.999);assert.ok(camera.position.equals(before));
});
test('Z stays visibly facing-only while the authorable axes remain XY',async()=>{
 const {createOriginGizmo,disposeOriginGizmo}=await import('../src/world/originGizmo.ts'),h=harness({mode:'area'}),gizmo=createOriginGizmo(1,true,[0,1],h.frame.directions);
 try{const facing=gizmo.children.find(object=>object.userData.directionIndicator&&object.userData.axisIndex===2);assert.equal(facing.material.opacity,1);assert.deepEqual(h.frame.activeAxes,[0,1]);}finally{disposeOriginGizmo(gizmo);}
});

for(const axis of [0,1])for(const sign of [1,-1])test(`signed axis cycle ${axis}:${sign} preserves the other axis`,()=>{
 let value={...planarOriginDirections(undefined),sides:axis===0?[2,3]:[0,1]};const preserved=[...value.sides],side=axis*2+(sign===1?0:1);
 value=toggleOriginSide(value,[0,1],axis,sign);assert.deepEqual(value.sides,[0,1,2,3]);
 value=toggleOriginSide(value,[0,1],axis,sign);assert.deepEqual(value.sides,[...preserved,side].sort());
 value=toggleOriginSide(value,[0,1],axis,sign);assert.deepEqual(value.sides,preserved);
 value={...value,sides:[...preserved,side^1].sort()};value=toggleOriginSide(value,[0,1],axis,sign);assert.deepEqual(value.sides,[0,1,2,3]);
});

function refinedArea(indices,halves=2,invert=false){const count=4*2**halves,quarter=count/4,cardinals=[0,2,1,3];return {...DEFAULT_ORIGIN_DIRECTIONS,mode:'area',halves,invert,sides:cardinals.filter((_,i)=>indices.includes(i*quarter)),disabled:Array.from({length:count},(_,i)=>i).filter(i=>i%quarter!==0&&!indices.includes(i)).map(i=>`0:${i}`)};}
test('refined rays bound area without either colored axis enabled, including wraparound and inversion',()=>{
 for(const indices of [[1,3],[15,1]]){const settings=refinedArea(indices),h=harness(settings),mask=originAreaMask(settings);assert.equal(mask.length,16);assert.equal(mask.filter(Boolean).length,2);assert.equal(hasOriginDirections(h.frame),true);const mid=(indices[0]+1)/16*Math.PI*2,p=[4*Math.cos(mid),4*Math.sin(mid),0];assert.equal(originAreaContains(mask,...p),true);assert.equal(h.session().candidate(p).valid,true);assert.equal(h.session().candidate(p.map(n=>-n)).valid,false);const inverse=originAreaMask({...settings,invert:true});for(let i=0;i<16;i++)assert.equal(inverse[i],!mask[i]);}
});
test('a refined area boundary controls brush spill, grid/hex snap and relocation together',()=>{
 for(const pattern of ['grid','hex']){const h=harness({...refinedArea([1,3]),pattern}),candidate=h.session().candidate([3,3,0]);assert.equal(candidate.valid,true);near(axisPoint(h.world,h.frame,operationSlot(h.world,h.frame,[3,3,0])),candidate.anchor);assert.equal(h.session().candidate([4,0,0]).valid,false);h.world.brush={kind:'sphere',radius:1};assert.equal(h.session().candidate([1,1,0]).valid,false);assert.match(h.session().candidate([1,1,0]).rejection,/outside the active area/);}
});
test('Axis-to-Area handoff preserves selected subdivisions instead of resetting them',()=>{const axis={...DEFAULT_ORIGIN_DIRECTIONS,halves:2,sides:[0,2],disabled:['0:1']},area=changeOriginMode(axis,'area');assert.ok(area.disabled.includes('0:1'));assert.ok(area.disabled.includes('0:7'));assert.deepEqual(area.sides,axis.sides);assert.deepEqual(changeOriginMode(area,'axis').disabled,area.disabled);assert.deepEqual(changeOriginMode(area,'unit').disabled,[]);assert.strictEqual(changeOriginMode(area,'area'),area);});
test('opposite refined rays alone remain an invalid area rather than choosing an arbitrary half plane',()=>{for(const invert of [false,true]){const settings=refinedArea([1,9],2,invert),h=harness(settings);assert.ok(originAreaMask(settings).every(on=>!on));assert.equal(hasOriginDirections(h.frame),false);assert.equal(h.session().candidate([3,3,0]).valid,false);}});

test('refined areas follow the oriented and translated origin plane',()=>{const h=harness(refinedArea([1,3]));h.frame.origin=[10,10,0];h.frame.x=[0,1,0];h.frame.y=[-1,0,0];assert.equal(h.session().candidate([7,13,0]).valid,true);assert.equal(h.session().candidate([13,7,0]).valid,false);near(axisPoint(h.world,h.frame,operationSlot(h.world,h.frame,[7,13,0])),[7,13,0]);});
