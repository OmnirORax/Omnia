import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {emptyWorld,addStructure,validateWorld} from '../src/core/model.ts';
import {writePaint,readPaint,resetPaint,paintPreview,connectorPaint} from '../src/core/appearance.ts';
import {inherited} from '../src/core/lattice.ts';
import {childNode,detachNode} from '../src/core/nodeOperations.ts';
import {SceneGlow} from '../src/sceneGlow.ts';

test('glow color stays independent, inherits through variants and connectors, and survives saving',()=>{
 const world=emptyWorld(),parent=addStructure(world,[0,0,0],1),child=childNode(world,parent.origin,true);
 writePaint(world,'nodeDefaults',[],{glowColor:'#00ff00'});
 writePaint(world,'text',[],{color:'#ffffff',glowColor:'#ff0000'});
 assert.equal(readPaint(world,'nodes',parent.origin).glowColor,'#00ff00');
 writePaint(world,'nodes',[parent.origin],{glowColor:'#0000ff'});
 assert.equal(inherited(child,world).glowColor,'#0000ff');assert.equal(connectorPaint(world,child).glowColor,'#0000ff');
 writePaint(world,'nodeText',[child.origin],{glowColor:'#123456'});
 assert.equal(readPaint(world,'nodeText',child.origin).color,'#ffffff');assert.equal(readPaint(world,'nodeText',child.origin).glowColor,'#123456');
 validateWorld(JSON.parse(JSON.stringify(world)));
 detachNode(world,child.origin);assert.equal(child.glowColor,'#0000ff');
 resetPaint(world,'nodes',[parent.origin]);assert.equal(parent.glowColor,undefined);
 assert.throws(()=>writePaint(world,'text',[],{glowColor:'red'}),/Invalid/);
});
test('appearance previews share validation and inheritance while leaving authored objects untouched',()=>{
 const world=emptyWorld(),a=addStructure(world,[0,0,0],1),b=addStructure(world,[3,0,0],2),before=JSON.stringify(world);
 for(const color of ['#ff0000','#00ff00','#0000ff']){
  const preview=paintPreview(world,'nodes',[a.origin],{color,glowColor:'#ffffff'});
  assert.notEqual(preview.nodes[0],a);assert.equal(preview.nodes[1],b);assert.equal(readPaint(preview,'nodes',a.origin).color,color);
  assert.equal(JSON.stringify(world),before);
 }
 const global=paintPreview(world,'text',[],{glowColor:'#123456'});assert.equal(global.nodes,world.nodes);assert.equal(global.appearance.text.glowColor,'#123456');assert.equal(JSON.stringify(world),before);
});
test('glow emission uses its independent inherited tint without changing base colors',()=>{
 const scene=new T.Scene(),owner=new T.Group(),original=new T.MeshBasicMaterial({color:'red'}),mesh=new T.Mesh(new T.PlaneGeometry(),original);
 owner.userData.glowIntensity=.5;owner.userData.glowColor='#0000ff';owner.add(mesh);scene.add(owner);
 const glow=new SceneGlow(scene,new T.PerspectiveCamera(),4),read=new T.WebGLRenderTarget(1,1),write=read.clone(),color=new T.Color();
 const emitted=[];const renderer={autoClear:true,getClearColor:c=>c.copy(color),getClearAlpha:()=>1,setClearColor:c=>color.set(c),setRenderTarget(){},clear(){},render(object){if(object===scene)emitted.push(mesh.material.color.clone());}};
 try{
  glow.render(renderer,write,read,0);assert.equal(emitted[0].b,.5);assert.equal(emitted[0].r,0);assert.equal(mesh.material,original);assert.equal(original.color.getHexString(),'ff0000');
  owner.userData.glowColor='#00ff00';glow.render(renderer,write,read,0);assert.equal(emitted[1].g,.5);assert.equal(emitted[1].b,0);
 }finally{glow.dispose();read.dispose();write.dispose();mesh.geometry.dispose();original.dispose();}
});
