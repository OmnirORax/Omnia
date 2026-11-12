import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { emptyWorld, addStructure, validateWorld } from '../src/core/model.ts';
import { geometry, lattice, address, prepareTranslation, moveBranch, inherited, vector } from '../src/core/lattice.ts';
import { childNode, detachNode, removeNodes } from '../src/core/nodeOperations.ts';
import { nearestCell, cellAt } from '../src/graph/lattice.ts';
import { createNavigatorDrive } from '../src/navigation/navigatorDrive.ts';
import { capabilities } from '../src/core/capabilities.ts';
import { atomicCarrierMaterial, atomicCarrierGeometry } from '../src/atomicCarrier.ts';
import { SPHERE_VISUAL_DEFAULTS } from '../src/properties/sphereVisualDefaults.ts';
import { createStore } from '../src/core/store.ts';
import { normalizeSceneVfx, DEFAULT_SCENE_VFX, WAVE_PRESETS } from '../src/scene/vfx.ts';
import { appendWavePreset, readWavePresets } from '../src/scene/wavePresets.ts';
import sceneFunction from '../src/scene/vfx.function.ts';
import { imageSignatureMatches, resolveScenePrompt } from '../src/scene/contracts.ts';
import { validateAsset } from '../src/graph/assets.ts';
import { textHTML } from '../src/text/dom.ts';
import { decodePcmPacket, PcmQueue } from '../src/scene/nativePcm.ts';

function fixture() {
  const world=emptyWorld(),root=addStructure(world,[0,0,0],1),child=addStructure(world,[1,0,0],2),obstacle=addStructure(world,[3,0,0],3);
  child.parent=root.origin;child.hidden=true;return {world,root,child,obstacle};
}
test('V1 sparse nearest-cell search respects hidden global occupancy and stable exact addresses',()=>{
  const {world}=fixture(),index=lattice(world);
  assert.equal(index.occupied.size,3);assert.notDeepEqual(addStructure(world,[1,0,0],4).position,[1,0,0]);
  const occupied=new Set(['0,0,0','1,0,0']);
  const wanted={x:.4,y:.3,z:.2},found=nearestCell(wanted,p=>!occupied.has(`${p.x},${p.y},${p.z}`));
  const distance=p=>(p.x-wanted.x)**2+(p.y-wanted.y)**2+(p.z-wanted.z)**2;
  for(let x=-2;x<=2;x++)for(let y=-2;y<=2;y++)for(let z=-2;z<=2;z++)if(!occupied.has(`${x},${y},${z}`))assert.ok(distance(found)<=distance({x,y,z})+1e-12);
  assert.throws(()=>cellAt({x:Infinity,y:0,z:0}),/integer/);
});
test('whole-branch movement includes hidden children and rejects collisions atomically',()=>{
  const {world,root,child}=fixture(),plan=prepareTranslation(world,[root.origin]);
  assert.equal(plan([2,0,0]),undefined);
  assert.throws(()=>moveBranch(world,root.origin,[2,0,0]),/occupied/);
  assert.deepEqual(root.position,[0,0,0]);moveBranch(world,root.origin,[5,0,0]);
  assert.deepEqual(root.position,[5,0,0]);assert.deepEqual(child.position,[6,0,0]);validateWorld(world);
});
test('V1 navigator driving previews without commits, cancels, and parks once',()=>{
  const {world,root}=fixture(),hosts=new Map(world.nodes.map(node=>{const group=new THREE.Group();group.position.set(...node.position);return [address(node.origin),{group,anchor:group.position}];}));let commits=0;
  const drive=createNavigatorDrive({hosts:()=>hosts,commit:(_id,position)=>{commits++;const next=structuredClone(world);moveBranch(next,root.origin,vector(position));return geometry(next);}});
  drive.begin(geometry(world),address(root.origin));assert.equal(drive.move(new THREE.Vector3(2,0,0)),false);assert.equal(drive.park(),null);assert.equal(commits,0);
  assert.equal(drive.move(new THREE.Vector3(5,0,0)),true);assert.equal(hosts.get(address(root.origin)).group.position.x,5);assert.equal(commits,0);drive.cancel();assert.equal(hosts.get(address(root.origin)).group.position.x,0);
  drive.begin(geometry(world),address(root.origin));drive.move(new THREE.Vector3(5,0,0));drive.park();assert.equal(commits,1);assert.equal(drive.active,false);
});
test('variants inherit live values until a shared setter creates an explicit override',()=>{
  const {world,root}=fixture();root.label='Original';root.color='#123456';const variant=childNode(world,root.origin,true);
  assert.equal(inherited(variant,world).label,'Original');root.label='Changed';assert.equal(inherited(variant,world).label,'Changed');
  capabilities(variant).find(c=>c.key==='color').properties[0].write('#abcdef');assert.equal(inherited(variant,world).color,'#abcdef');assert.equal(root.color,'#123456');
  detachNode(world,variant.origin);root.label='Again';assert.equal(variant.label,'Changed');assert.equal(variant.parent,undefined);validateWorld(world);
});
test('removing an owner preserves children and materializes independent variant content',()=>{
  const {world,root,child}=fixture();root.text={version:1,content:['Authored']};const variant=childNode(world,root.origin,true);
  removeNodes(world,[root.origin]);assert.equal(child.parent,undefined);assert.equal(variant.variantOf,undefined);assert.deepEqual(variant.text,{version:1,content:['Authored']});validateWorld(world);
});
test('the inherited carrier uses the actual sphere shader and V1 orange/transmission defaults',()=>{
  const geometry=atomicCarrierGeometry(),material=atomicCarrierMaterial(SPHERE_VISUAL_DEFAULTS.color);
  assert.equal(geometry.type,'SphereGeometry');assert.equal(material.color.getHexString(),'ffb000');assert.equal(material.userData.translucency.value,.7);assert.equal(material.userData.translucencyRadius.value,.76);assert.equal(material.userData.edgeGlow.value,.35);geometry.dispose();material.dispose();
});
test('the extended world saves separately and preserves the first preview original',()=>{
  const old={format:'omnium-world',version:1,nodes:[]},data=new Map([['omnium.v2.world.1',JSON.stringify(old)]]);
  const store=createStore({getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)});
  store.change(world=>addStructure(world,[0,0,0],1));assert.equal(data.get('omnium.v2.world.1'),JSON.stringify(old));assert.equal(JSON.parse(data.get('omnium.v2.world.2')).version,2);
});
test('the original scene controls write independent settings through their declared bindings',()=>{
  const original={sceneVfx:normalizeSceneVfx(undefined)},changed=sceneFunction.inputs['scene.pulseTintHigh'].write(original,'#abcdef');
  assert.equal(changed.sceneVfx.pulseTintHigh,'#abcdef');assert.equal(original.sceneVfx.pulseTintHigh,DEFAULT_SCENE_VFX.pulseTintHigh);assert.equal(changed.sceneVfx.waveAmplitudeX,original.sceneVfx.waveAmplitudeX);
  assert.equal(WAVE_PRESETS[1].waveAmplitudeX,DEFAULT_SCENE_VFX.waveAmplitudeX);
});
test('wave presets preserve independent authored controls and round-trip',()=>{
  const settings=normalizeSceneVfx(undefined),values=appendWavePreset({},false,settings),saved=readWavePresets(values);
  assert.equal(saved.length,1);assert.equal(saved[0].waves,false);assert.equal(saved[0].values.waveSpeedY,settings.waveSpeedY);assert.deepEqual(readWavePresets({broken:'invalid'}),[]);
});
test('reused scene image validation and prompts reject active content and unbound input',()=>{
  assert.equal(imageSignatureMatches(new Uint8Array(20),'image/png'),false);
  assert.throws(()=>resolveScenePrompt('{{missing}}','subject','label',{id:'test',label:'Safe',notes:''}),/Unconnected/);
  assert.equal(resolveScenePrompt('{{subject}}','subject','label',{id:'test',label:'$& {{other}}',notes:''}),'$& {{other}}');
  assert.throws(()=>validateAsset({id:'test',name:'bad',kind:'image',dataUrl:'data:image/svg+xml;base64,'+Buffer.from('<svg><script>alert(1)</script></svg>').toString('base64')}),/self-contained/);
});
test('reused document rendering escapes authored HTML while preserving Markdown',()=>{
  const html=textHTML({version:1,content:['**Bold**\n<script>alert(1)</script>']},()=>'<span></span>');assert.match(html,/<strong|<b[ >]/);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
});
test('native system audio retains bounded queues and rejects malformed PCM',()=>{
  assert.equal(decodePcmPacket(new ArrayBuffer(1)),undefined);const queue=new PcmQueue();for(let i=0;i<100;i++)queue.push(new Float32Array(2048),2,48000);assert.ok(queue.count<=Math.ceil(48000*.06));queue.clear();assert.equal(queue.count,0);
});
