import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyDocument,validateDocument,parseDocument} from '../src/graph/structural.ts';
import {createRecipe} from '../src/omnic/presets.ts';
import {omnicAsset,structuralVisual} from '../src/omnic/presentation.ts';
import {saveOmnicDefinition} from '../src/omnic/document.ts';
test('canonical objects derive static views without storing SVG assets; presentations remain independent',()=>{
  const doc=emptyDocument(),recipe=createRecipe();doc.entities=[{id:'o',label:'Object',notes:'',aliases:[],omnic:recipe}];
  const a={id:'a',entityId:'o',parentId:null,position:{x:0,y:0},hidden:false,collapsed:false},b={...a,id:'b',visual:{character:'X'}};
  doc.placements=[a,b];validateDocument(doc);
  assert.equal(structuralVisual(doc,a).assetId,'omnic:o');assert.equal(structuralVisual(doc,a).showText,false);
  assert.deepEqual(structuralVisual(doc,b),b.visual);
  const asset=omnicAsset(doc,'o');assert.equal(omnicAsset(doc,'o'),asset);assert.match(asset.dataUrl,/^data:image\/svg\+xml;base64,/);
  assert.equal(doc.assets,undefined);assert.equal(parseDocument(JSON.stringify(doc)).entities[0].omnic.version,1);
  const changed={...recipe,components:recipe.components.map(c=>({...c,params:{...c.params,count:9}}))};
  const revised=saveOmnicDefinition(doc,'o',changed);assert.notEqual(omnicAsset(revised,'o').dataUrl,asset.dataUrl);
});
test('shared dependencies invalidate derived views while unrelated placement edits retain compiled source',()=>{
  const doc=emptyDocument();doc.entities=[{id:'child',label:'',notes:'',aliases:[],omnic:createRecipe()},{id:'parent',label:'',notes:'',aliases:[],omnic:{version:1,revision:1,components:[{id:'ref',generator:'reference',reference:'child',params:{}}],operations:[],frames:[]}}];validateDocument(doc);
  const before=omnicAsset(doc,'parent').dataUrl;
  assert.equal(omnicAsset({...doc,revision:2},'parent').dataUrl,before);
  const recipe=doc.entities[0].omnic;const next=saveOmnicDefinition(doc,'child',{...recipe,components:recipe.components.map(c=>({...c,params:{...c.params,count:3}}))});
  assert.notEqual(omnicAsset(next,'parent').dataUrl,before);
});

test('derived glyph images use XML-valued selection attributes for saved and live renderers',async()=>{
  const {PRESETS}=await import('../src/omnic/presets.ts');
  const {omnicDraftAssets}=await import('../src/omnic/presentation.ts');
  for(const preset of PRESETS){
    const doc={...emptyDocument(),entities:[{id:'glyph',label:'Glyph',notes:'',aliases:[],omnic:preset.recipe}]};
    const asset=omnicAsset(doc,'glyph'),draft=omnicDraftAssets(doc,'glyph',preset.recipe)('glyph');
    for(const output of [asset,draft]){
      const svg=Buffer.from(output.dataUrl.split(',')[1],'base64').toString('utf8');
      assert.match(svg,/<svg\s+xmlns="http:\/\/www.w3.org\/2000\/svg"/);
      assert.match(svg,/data-selection-environment=""/);
      assert.match(svg,/data-selection-boundary=""/);
      assert.doesNotMatch(svg,/\sdata-[\w:-]+(?=\s|\/?>)/,'HTML boolean attributes cannot be decoded as an SVG image');
    }
    assert.equal(doc.assets,undefined,'derived render data never replaces the canonical glyph');
  }
});

 test('eligible canonical glyph assets carry a bounded transient native plan without changing portable SVG bytes',async()=>{
 const {vectorAsset,glyphVectorPlan}=await import('../src/omnic/vectorPlan.ts');const {evaluateRecipe}=await import('../src/omnic/evaluate.ts');const {RENDER_BUDGET}=await import('../src/renderBudget.ts');
 const doc=emptyDocument();doc.entities=[{id:'native',label:'Native',notes:'',aliases:[],omnic:createRecipe('ring')}];
 const asset=omnicAsset(doc,'native'),plan=vectorAsset(asset);assert.ok(plan);assert.ok(plan.nodes.length);assert.equal('vector' in JSON.parse(JSON.stringify(asset)),false);
 assert.equal(vectorAsset(JSON.parse(JSON.stringify(asset))),undefined,'ordinary imported/exported images cannot impersonate a canonical render capability');
 const evaluated=evaluateRecipe(doc.entities[0].omnic);const {renderSVG}=await import('../src/omnic/svg.ts');assert.equal(atob(asset.dataUrl.split(',')[1]),renderSVG(evaluated),'portable SVG output remains byte-equivalent');assert.deepEqual(plan.nodes,evaluated.nodes.filter(n=>n.kind!=='group'));
 assert.equal(glyphVectorPlan({...evaluated,motion:true}),undefined);assert.equal(glyphVectorPlan({...evaluated,nodes:Array(RENDER_BUDGET.omnicVectorPrimitives+1).fill(plan.nodes[0])}),undefined);
 assert.equal(glyphVectorPlan({...evaluated,nodes:[{...plan.nodes[0],highlight:{fraction:.5,start:0,color:'#ff0000',opacity:1}}]}),undefined,'unsupported decoration keeps SVG fidelity');
 assert.equal(glyphVectorPlan({...evaluated,nodes:[{...plan.nodes[0],glow:true}]}),undefined);
 });
 test('native world glyph batches circles and lines, keeps style/opacity, and defers draft-ready notification',async()=>{
 const THREE=await import('three');const {rememberVectorAsset}=await import('../src/omnic/vectorPlan.ts');const {visualObject,disposeVisual}=await import('../src/visualScene.ts');const {inheritMaterialCoverage}=await import('../src/materialCoverage.ts');
 const asset={id:'omnic:synthetic',name:'synthetic',kind:'image',dataUrl:'data:image/svg+xml;base64,unused'};
 const nodes=[{id:'ring',componentId:'r',kind:'ring',x:0,y:0,radius:20,fill:false,thickness:1,color:'#ff0000',opacity:.7},{id:'stroke',componentId:'l',kind:'line',x:-10,y:0,x2:10,y2:0,radius:0,fill:false,thickness:2,color:'#00ff00',opacity:1,cap:'butt'}];
 rememberVectorAsset(asset,{nodes,bounds:{x:-32,y:-32,width:64,height:64}});let renders=0;
 const group=visualObject({assetId:asset.id},[asset],()=>assert.fail('native glyph must not use text/image fallback'),()=>renders++);
 assert.equal(renders,0,'draft handoff cannot run before the caller assigns its pending view');
 assert.equal(group.children[0].userData.vectorGlyph,true);const mesh=group.children[0].children[0];assert.equal(mesh.geometry.instanceCount,2);assert.equal(mesh.geometry.isInstancedBufferGeometry,true);assert.equal(mesh.material.map,null);
 assert.equal(mesh.geometry.getAttribute('glyphShape').getZ(1),3,'butt caps keep their existing SVG semantics');
 group.userData.setAppearance({color:'#0000ff',opacity:.4,brightness:.8});assert.equal(mesh.material.opacity,.4);assert.equal(mesh.geometry.getAttribute('glyphColor').getZ(0),1);assert.equal(mesh.geometry.getAttribute('glyphColor').getX(1),0);
 const mask=new THREE.MeshBasicMaterial();inheritMaterialCoverage(mesh.material,mask);
 const compile=material=>{const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <alphatest_fragment>'};material.onBeforeCompile(shader,{});return shader;};
 const base=compile(mesh.material),glow=compile(mask);assert.equal(base.vertexShader,glow.vertexShader);assert.equal(base.fragmentShader,glow.fragmentShader);assert.equal(mesh.geometry.getAttribute('glyphEnds').getX(1),-10/64);assert.equal(mesh.geometry.getAttribute('glyphEnds').getZ(1),10/64);
 await Promise.resolve();assert.equal(renders,1);disposeVisual(group);
 const disposed=visualObject({assetId:asset.id},[asset],()=>assert.fail(),()=>renders++);disposeVisual(disposed);await Promise.resolve();assert.equal(renders,1,'disposed draft/native views cannot request a late handoff');
 });

 test('texture-dependent effects can switch native glyphs to raster and back without stale async handoffs',async()=>{
 const THREE=await import('three');const {rememberVectorAsset}=await import('../src/omnic/vectorPlan.ts');const {visualObject,disposeVisual}=await import('../src/visualScene.ts');
 const load=THREE.TextureLoader.prototype.load;THREE.TextureLoader.prototype.load=function(_url,ready){const texture=new THREE.Texture();texture.image={width:256,height:256};queueMicrotask(()=>ready(texture));return texture;};
 try{
  const asset={id:'omnic:switch',name:'synthetic',kind:'image',dataUrl:'data:image/png;base64,synthetic'};
  rememberVectorAsset(asset,{nodes:[{kind:'ring',x:0,y:0,radius:10,fill:false,thickness:1,color:'#ff0000',opacity:1}],bounds:{x:-22,y:-22,width:44,height:44}});
  const group=visualObject({assetId:asset.id},[asset],()=>assert.fail(),()=>{});await Promise.resolve();assert.equal(group.children[0].userData.vectorGlyph,true);
  group.userData.setAppearance({textureOnly:true});await Promise.resolve();assert.equal(group.children.length,1);assert.ok(group.children[0].children[0].material.map,'texture effects retain their original bitmap substrate');
  group.userData.setAppearance({textureOnly:false});await Promise.resolve();assert.equal(group.children[0].userData.vectorGlyph,true);
  group.userData.setAppearance({textureOnly:true});group.userData.setAppearance({textureOnly:false});await Promise.resolve();assert.equal(group.children.length,1);assert.equal(group.children[0].userData.vectorGlyph,true,'late raster loads cannot replace a newer native mode');disposeVisual(group);
 }finally{THREE.TextureLoader.prototype.load=load;}
 });
