import test from 'node:test';import assert from 'node:assert/strict';
import {originModeDemo} from '../src/ui/originModeDemo.ts';
import {DEFAULT_ORIGIN_DIRECTIONS} from '../src/core/originDirections.ts';
test('mode examples use actual snapping and symmetry without editing their settings',()=>{
 const settings={...DEFAULT_ORIGIN_DIRECTIONS,sides:[0,1,2,3]},before=structuredClone(settings),axis=originModeDemo(settings,[0,1]),symmetric=originModeDemo({...settings,symmetry:true},[0,1]);
 assert.equal(axis.valid,true);assert.equal(axis.positions.length,1);assert.equal(symmetric.valid,true);assert.ok(symmetric.positions.length>axis.positions.length);assert.deepEqual(settings,before);
 for(const mode of ['axis','unit','area'])for(const pattern of ['grid','hex']){const result=originModeDemo({...settings,mode,pattern},[0,1]);assert.equal(result.valid,true);assert.ok(result.sites.length<=49);for(const p of [...result.positions,...result.sites])assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.hypot(p.x,p.y)<.68);}
 const grid=originModeDemo({...settings,mode:'area',pattern:'grid'},[0,1]),hex=originModeDemo({...settings,mode:'area',pattern:'hex'},[0,1]);assert.notDeepEqual(grid.sites,hex.sites);
});
test('empty area examples reject rather than invent allowed placement',()=>{const example=originModeDemo({...DEFAULT_ORIGIN_DIRECTIONS,mode:'area',sides:[0]},[0]);assert.equal(example.valid,false);assert.deepEqual(example.positions,[]);assert.ok(example.rejection);});
