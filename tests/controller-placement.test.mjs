import test from 'node:test';
import assert from 'node:assert/strict';
import {controllerCenter} from '../src/composer/runtime/ui/popupPlacement.ts';
test('clicking a construction keeps the replacement radial menu centered on the cursor',()=>{
 const cursor={x:72,y:87},parent={x:0,y:0,width:170,height:170},button={x:57,y:72,width:30,height:30},menu={width:160,height:160};
 assert.deepEqual(controllerCenter(cursor,menu,[parent],button,true,false),cursor);
 assert.deepEqual(controllerCenter(cursor,menu,[parent],button,true,true),cursor);
});
test('rectangular button editors retain their button-below placement',()=>{
 const button={x:20,y:30,width:30,height:20};
 assert.deepEqual(controllerCenter({x:25,y:35},{width:100,height:80},[],button,false,false),{x:35,y:94});
});

test('scene dial chooses a clear nearby edge, staying inside the viewport',async()=>{
 const {popupBesideTarget}=await import('../src/composer/runtime/ui/popupPlacement.ts');
 const viewport={x:8,y:8,width:784,height:584},child={width:180,height:140};
 for(const target of [{x:300,y:220,width:120,height:120},{x:0,y:0,width:120,height:120},{x:680,y:480,width:120,height:120}]){
  const p=popupBesideTarget(target,child,viewport);assert.ok(p.x>=8&&p.y>=8);assert.ok(p.x+child.width<=792&&p.y+child.height<=592);
  assert.ok(p.x+child.width<=target.x||p.x>=target.x+target.width||p.y+child.height<=target.y||p.y>=target.y+target.height);
 }
 const target={x:300,y:220,width:120,height:120},small=popupBesideTarget(target,child,viewport,{x:420,y:280}),large=popupBesideTarget(target,{width:300,height:220},viewport,{x:420,y:280});assert.equal(small.x,428);assert.ok(large.x>=428||large.y+220<=220||large.y>=340);
});
