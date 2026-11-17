import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addStructure,validateWorld} from '../src/core/model.ts';
import {setSpatialOrigin,operationSlot,axisPoint} from '../src/core/axes.ts';
import {createPaintSession} from '../src/core/painting.ts';
import {paintNodes} from '../src/core/nodeOperations.ts';
import {DEFAULT_ORIGIN_DIRECTIONS,directionCount} from '../src/core/originDirections.ts';
const basis=[[1,0,0],[0,1,0],[0,0,1]];
function harness(settings={}){const world=emptyWorld(),frame=setSpatialOrigin(world,undefined,[0,0,0],basis[0],basis[1]);frame.activeAxes=[0,1];frame.directions={...DEFAULT_ORIGIN_DIRECTIONS,symmetry:true,...settings};return {world,frame,session:()=>createPaintSession(world,[0,0,0],basis,frame)};}
const rounded=points=>points.map(p=>p.map(n=>Math.round(n*1e6)/1e6).join(',')).sort();
test('symmetry repeats along all enabled directions with one shared preview and atomic paint commit',()=>{const h=harness(),candidate=h.session().candidate([2,.1,0]);assert.equal(candidate.valid,true);assert.deepEqual(rounded(candidate.stamp),['-2,0,0','0,-2,0','0,2,0','2,0,0']);paintNodes(h.world,candidate.stamp,undefined,h.frame.id);assert.deepEqual(rounded(h.world.nodes.map(n=>n.position)),rounded(candidate.stamp));assert.equal(h.session().candidate([2,0,0]).valid,false);assert.deepEqual(validateWorld(JSON.parse(JSON.stringify(h.world))).axes[0].directions,h.frame.directions);});
test('disabled directions constrain creation and relocation identically; half counts permit diagonals',()=>{const h=harness({halves:1,symmetry:false,disabled:['0:0']});assert.equal(directionCount(h.frame.directions),8);const preview=h.session().candidate([2,2,0]);assert.equal(preview.valid,true);assert.ok(Math.abs(preview.anchor[0]-preview.anchor[1])<1e-7);assert.deepEqual(axisPoint(h.world,h.frame,operationSlot(h.world,h.frame,[2,2,0])),preview.anchor);assert.equal(h.session().candidate([2,0,0]).stamp.some(p=>Math.abs(p[1])<1e-8&&p[0]>0),false);});
test('Unit rings fit six, twelve and eighteen neighbours and deduplicate the centre',()=>{const h=harness({mode:'unit',rings:3});addStructure(h.world,[0,0,0],1);for(const r of [1,2,3]){const next=h.session().candidate([r,0,0]);assert.equal(next.valid,true);assert.equal(next.stamp.length,6*r);}const empty=harness({mode:'unit'});assert.equal(empty.session().candidate([0,0,0]).stamp.length,1);});
test('one blocked symmetric copy rejects the full stamp and mutually overlapping copies are rejected',()=>{const h=harness();addStructure(h.world,[0,-2,0],1);const next=h.session().candidate([2,0,0]);assert.equal(next.valid,false);assert.throws(()=>paintNodes(h.world,next.stamp),/overlap/);assert.equal(h.world.nodes.length,1);const crowded=harness({halves:2});assert.equal(crowded.session().candidate([1,0,0]).valid,false);});
test('single-axis symmetry respects disabled sides and every plane inherits frame orientation',()=>{const h=harness();h.frame.activeAxes=[2];let next=h.session().candidate([0,0,2]);assert.deepEqual(rounded(next.stamp),['0,0,-2','0,0,2']);h.frame.directions={...h.frame.directions,disabled:['0:1']};next=h.session().candidate([0,0,-2]);assert.deepEqual(rounded(next.stamp),['0,0,2']);h.frame.activeAxes=[0,2];h.frame.directions={...h.frame.directions,disabled:[]};assert.ok(h.session().candidate([2,0,0]).stamp.every(p=>p[1]===0));});
test('invalid direction settings are rejected on load',()=>{const h=harness();h.frame.directions.halves=99;assert.throws(()=>validateWorld(h.world),/origin directions/);});

test('disabling every direction blocks placement and relocation instead of allowing free movement',()=>{const h=harness({disabled:['0:0','0:1','0:2','0:3']});assert.equal(h.session().candidate([2,0,0]).valid,false);assert.throws(()=>operationSlot(h.world,h.frame,[2,0,0]),/Enable a placement direction/);});

test('directions and symmetry follow activated axes, preserving diagonal subdivisions',()=>{
 const h=harness({halves:1});
 for(const axes of [[0,1],[0,2],[1,2]]){
  h.frame.activeAxes=axes;
  const position=[0,0,0];position[axes[0]]=3;
  const candidate=h.session().candidate(position);
  assert.equal(candidate.stamp.length,8);
  const inactive=[0,1,2].find(i=>!axes.includes(i));
  assert.ok(candidate.stamp.every(p=>Math.abs(p[inactive])<1e-8));
  assert.ok(candidate.stamp.some(p=>Math.abs(p[axes[0]])>1&&Math.abs(p[axes[1]])>1));
  assert.deepEqual(axisPoint(h.world,h.frame,operationSlot(h.world,h.frame,position)),candidate.anchor);
 }
});
test('old plane-button settings are retired on load and direction exclusions remain shared',()=>{
 const h=harness({planes:['XZ'],disabled:['XY:0:1','XZ:0:1']});
 validateWorld(h.world);
 assert.equal('planes' in h.frame.directions,false);
 assert.deepEqual(h.frame.directions.disabled,['0:1']);
 const candidate=h.session().candidate([2,0,0]);
 assert.deepEqual(rounded(candidate.stamp),['-2,0,0','0,-2,0','2,0,0']);
 h.frame.activeAxes=[0,2];
 assert.deepEqual(rounded(h.session().candidate([2,0,0]).stamp),['-2,0,0','0,0,-2','2,0,0']);
});

test('three active axes retain depth from projected mouse input and produce all spatial directions',()=>{const h=harness();h.frame.activeAxes=[0,1,2];const candidate=h.session().candidate([0,0,2]);assert.equal(candidate.valid,true);assert.ok(candidate.stamp.some(p=>p[2]>1.9));assert.equal(candidate.stamp.length,6);});
