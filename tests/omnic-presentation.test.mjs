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
