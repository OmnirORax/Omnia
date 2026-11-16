import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createNavigatorDrive} from '../src/navigation/navigatorDrive.ts';
const doc={freePositions:true,placements:[{id:'moving',parentId:null,position:{x:0,y:0},spatialPosition:{x:0,y:0,z:0}},{id:'blocker',parentId:null,position:{x:2,y:0},spatialPosition:{x:2,y:0,z:0}}]};
test('rejected moves report the blocker at the attempted position and retain the session',()=>{const drive=createNavigatorDrive({hosts:()=>new Map(),commit:()=>{throw Error('must not commit');}});drive.begin(doc,'moving',1,1,false);assert.equal(drive.move(new T.Vector3(2,0,0)),false);assert.deepEqual(drive.rejection,{reason:'Occupied position',moving:'moving',blocker:'blocker',point:{x:2,y:0,z:0}});assert.equal(drive.park(),null);assert.equal(drive.active,true);drive.move(new T.Vector3(0,3,0));assert.equal(drive.rejection,undefined);});
test('constraint rejections have a reason without occupancy scans',()=>{const drive=createNavigatorDrive({hosts:()=>new Map(),commit:()=>doc,constrain:()=>undefined});drive.begin(doc,'moving',1,1,false);drive.move(new T.Vector3(5,0,0));assert.match(drive.rejection.reason,/axis/);assert.equal(drive.active,true);});
