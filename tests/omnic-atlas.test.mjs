import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addStructure,validateWorld,locate,specification,bind,setInvariant} from '../src/core/model.ts';
import {childNode,detachNode} from '../src/core/nodeOperations.ts';
import {inherited} from '../src/core/lattice.ts';
import {createStore} from '../src/core/store.ts';
import {saveDefinition,definitionRecipe,pinDefinition,addReference,visibleInAtlas} from '../src/omnic/atlas.ts';
import {atlasRecipeResolver,referenceKey} from '../src/omnic/bindings.ts';
import {createRecipe} from '../src/omnic/presets.ts';
import {recipeDelta,applyRecipeDelta} from '../src/omnic/delta.ts';
import {createPartsFile,fullChoice,preparePartsImport} from '../src/core/transferParts.ts';
import {prepareGeometrySelection,defaultGeometrySelection,combineGeometrySelection} from '../src/omnic/selection.ts';
import {evaluateRecipe} from '../src/omnic/evaluate.ts';
function definition(world,preset='line'){return saveDefinition(world,undefined,createRecipe(preset),preset);}
test('drafts are recoverable without invariant promotion; accepting equivalent geometry reuses the canonical structure',()=>{
 const world=emptyWorld(),a=addStructure(world,[0,0,0],1),b=addStructure(world,[2,0,0],2);world.version=3;a.omnicDraft=createRecipe('line');b.omnicDraft=createRecipe('line');
 assert.throws(()=>setInvariant(world,a,true),/Define/);assert.equal(world.nodes.filter(n=>n.invariant).length,0);
 const origin=saveDefinition(world,a.origin,a.omnicDraft,'line'),copy=structuredClone(b.omnicDraft);copy.components[0].id='renamed';copy.revision=7;
 assert.deepEqual(saveDefinition(world,b.origin,copy,'same'),origin);assert.equal(b.invariant,false);assert.equal(world.nodes.filter(n=>n.invariant).length,1);validateWorld(world);
});
test('variant stores only changed inputs, follows later base changes, and renders its own definition',()=>{
 const world=emptyWorld(),origin=definition(world),base=locate(world,origin),variant=childNode(world,origin,true),recipe=structuredClone(base.omnic);recipe.components[0].params.length=160;
 saveDefinition(world,variant.origin,recipe,'long');assert.equal(variant.omnic,undefined);assert.ok(variant.omnicEdits.length<5);
 base.omnic.components[0].params.color='#ff0000';const actual=definitionRecipe(variant,world);assert.equal(actual.components[0].params.length,160);assert.equal(actual.components[0].params.color,'#ff0000');
 assert.equal(inherited(variant,world).visual.omnicEntityId,JSON.stringify(variant.origin));assert.notEqual(specification(variant,world),specification(base,world));validateWorld(world);
 detachNode(world,variant.origin);assert.equal(variant.omnicEdits,undefined);assert.equal(variant.omnic.components[0].params.length,160);validateWorld(world);
});
test('deltas preserve newly inherited siblings and reject lost edit targets instead of retargeting',()=>{
 const base=createRecipe('line'),edited=structuredClone(base);edited.components[0].params.length=100;const delta=recipeDelta(base,edited),next=structuredClone(base);next.components.push({id:'extra',generator:'dot',params:{}});
 assert.equal(applyRecipeDelta(next,delta).components.length,2);next.components.shift();assert.throws(()=>applyRecipeDelta(next,delta),/no longer resolves/);
});
test('circular Omnic dependencies cannot be committed and unresolved definitions remain inspectable',()=>{
 const world=emptyWorld(),a=locate(world,definition(world)),b=locate(world,definition(world,'radial'));
 a.omnic=addReference(a.omnic,b,world,'follow');b.omnic=addReference(b.omnic,a,world,'follow');assert.throws(()=>validateWorld(world),/Circular/);
 b.omnic=createRecipe('radial');a.omnic.components.find(c=>c.generator==='reference').reference=JSON.stringify({mode:'follow',origin:{born:900,at:[9,0,0]}});validateWorld(world);
});
test('pins freeze nested live dependencies while current references continue to update',()=>{
 const world=emptyWorld(),leaf=locate(world,definition(world)),root=locate(world,definition(world,'radial'));root.omnic=addReference(root.omnic,leaf,world,'follow');
 const pinned=pinDefinition(world,root.origin);leaf.omnic.components[0].params.length=180;
 const resolve=atlasRecipeResolver(world),key=referenceKey(root,'follow',world),old=resolve(key,pinned),ref=old.components.find(c=>c.generator==='reference');assert.notEqual(ref.referenceRevision,undefined);assert.notEqual(resolve(ref.reference,ref.referenceRevision).components[0].params.length,180);assert.equal(resolve(ref.reference).components[0].params.length,180);validateWorld(world);
});
test('atlas views filter one universe without changing coordinates or duplicating definitions',()=>{
 const world=emptyWorld(),a=locate(world,definition(world)),b=locate(world,definition(world,'radial'));a.catalog={tags:['a'],collections:[]};const positions=world.nodes.map(n=>structuredClone(n.position));world.atlases=[{name:'A',filter:{tags:['a']}}];world.activeAtlas=0;
 assert.deepEqual([...visibleInAtlas(world)],[JSON.stringify(a.origin)]);assert.equal(world.nodes.length,2);assert.deepEqual(world.nodes.map(n=>n.position),positions);
 world.atlases[0].roots=[{mode:'follow',origin:{born:999,at:[0,0,0]}}];assert.equal(visibleInAtlas(world).size,0);assert.ok(b);validateWorld(world);
});
test('version 3 storage survives undo, reload, older-world import and recovery without overwriting the v2 recovery slot',()=>{
 const legacy=JSON.stringify(emptyWorld()),data=new Map([['omnium.v2.world.2',legacy]]),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},store=createStore(storage);
 store.change(world=>definition(world));assert.equal(store.world.version,3);store.undo();assert.equal(store.world.version,3);assert.equal(createStore(storage).world.version,3);store.redo();store.replace(emptyWorld());assert.equal(store.world.version,3);store.recover();assert.equal(store.world.nodes.length,1);assert.equal(data.get('omnium.v2.world.2'),legacy);
});
test('partial exports include Omnic dependencies and pins; additive imports rebind them and reuse existing invariants',()=>{
 const world=emptyWorld(),leaf=locate(world,definition(world)),root=locate(world,definition(world,'radial'));root.omnic=addReference(root.omnic,leaf,world,'follow',true);
 const choice={nodes:[JSON.stringify(root.origin)],settings:false,scene:false,appearance:false},file=createPartsFile(world,choice);assert.equal(file.world.version,3);assert.equal(file.world.nodes.length,2);
 const existing=emptyWorld();const target=locate(existing,definition(existing));target.position=[10,0,0];const imported=preparePartsImport(existing,file,choice,false);validateWorld(imported);
 assert.equal(imported.nodes.filter(n=>n.invariant).length,2);assert.equal(imported.nodes.length,2);const composite=imported.nodes.find(n=>n.label==='radial'),reference=definitionRecipe(composite,imported).components.find(c=>c.generator==='reference'),resolve=atlasRecipeResolver(imported);assert.ok(resolve(reference.reference));assert.ok(resolve(reference.reference,reference.referenceRevision));
});
test('full version 3 replacement retains atlas views and the shared coordinate authority',()=>{
 const world=emptyWorld();definition(world);world.atlases=[{name:'Lines',filter:{generator:'line'}}];world.activeAtlas=0;const file=createPartsFile(world,fullChoice(world)),next=preparePartsImport(emptyWorld(),file,fullChoice(file.world),true);assert.deepEqual(next.atlases,world.atlases);assert.deepEqual(next.nodes.map(n=>n.position),world.nodes.map(n=>n.position));validateWorld(next);
});
test('local composer selection keeps ink connectivity, property patterns and include/exclude semantics',()=>{
 const recipe={version:2,revision:0,components:[{id:'a',generator:'dot',params:{x:0,y:0,size:10}},{id:'b',generator:'dot',params:{x:20,y:0,size:10}},{id:'c',generator:'dot',params:{x:100,y:0,size:10,color:'#ff0000'}}],operations:[],frames:[]},evaluation=evaluateRecipe(recipe),config={...defaultGeometrySelection(),mode:'continuity'},selection=prepareGeometrySelection(evaluation,config).pick({x:0,y:0});assert.equal(selection.size,2);
 const pattern=prepareGeometrySelection(evaluation,{...config,mode:'pattern',criteria:[{property:'color',value:'#ff0000'}]}).pick({x:0,y:0});assert.equal(pattern.size,1);assert.equal(combineGeometrySelection(selection,pattern,'include').size,3);assert.equal(combineGeometrySelection(selection,selection,'exclude').size,0);
});
test('canonical definitions treat omitted defaults and explicit defaults equally, independently of brush/view state',()=>{
 const world=emptyWorld(),a=createRecipe('line'),origin=saveDefinition(world,undefined,a,'line'),b=structuredClone(a);b.components[0].params.x=0;b.atomnic={active:true,viewSize:500,color:'#ff0000'};
 assert.deepEqual(saveDefinition(world,undefined,b,'same'),origin);assert.equal(world.nodes.length,1);
});
test('structural queries include facts reached through references and persist valid filters',async()=>{
 const {libraryEntry}=await import('../src/omnic/libraryIndex.ts'),world=emptyWorld(),leaf=locate(world,definition(world)),root=locate(world,definition(world,'radial'));root.omnic=addReference(root.omnic,leaf,world,'follow');
 const facts=libraryEntry(world,root);assert.ok(facts.facts.generators.includes('line'));assert.equal(libraryEntry(world,root),facts);world.atlases=[{name:'All',filter:{countMin:1,motion:false,parameter:{property:'omnic.count',min:5,max:8}}}];validateWorld(world);assert.ok(visibleInAtlas(world).has(JSON.stringify(root.origin)));world.atlases[0].filter.countMin=-1;assert.throws(()=>validateWorld(world),/Count filter/);
});
test('boundary selection distinguishes enclosure and ink connectivity, and polygon bounds use the complete path',()=>{
 const recipe={version:2,revision:0,components:[{id:'boundary',generator:'ring',params:{radius:50}},{id:'inside',generator:'dot',params:{x:0,y:0,size:2}},{id:'outside',generator:'dot',params:{x:100,y:0,size:2}}],operations:[],frames:[]},evaluation=evaluateRecipe(recipe),config={...defaultGeometrySelection(),mode:'boundary',contour:false};
 const selected=prepareGeometrySelection(evaluation,config).pick({x:50,y:0});assert.equal(selected.size,1);assert.ok([...selected][0].includes('inside'));
 const polygon=prepareGeometrySelection(evaluation,{...config,mode:'polygon'}).pick({x:-20,y:-20},{x:-20,y:-19},[{x:-20,y:-20},{x:20,y:-20},{x:20,y:20},{x:-20,y:20}]);assert.equal(polygon.size,1);
});
test('numeric state references use compatible measurements and keep halving candidate counts bounded',async()=>{
 const {operationGeometry}=await import('../src/omnic/operationContext.ts'),{targetEditorDegrees}=await import('../src/omnic/targetDegrees.ts'),{measuredReferenceFor}=await import('../src/omnic/referenceMeasures.ts'),{stateFieldDomain}=await import('../src/omnic/stateFieldAdapter.ts'),{targetParameter}=await import('../src/omnic/targetDegrees.ts'),{createStateField}=await import('../src/properties/stateField.ts');
 const recipe=createRecipe('radial'),degree=targetEditorDegrees(recipe,[recipe.components[0].id]).find(d=>d.properties.includes('omnic.radius')),snapshot=operationGeometry(recipe,evaluateRecipe(recipe));assert.ok(degree);assert.ok(measuredReferenceFor(snapshot,degree,undefined));const domain=stateFieldDomain(targetParameter(degree));assert.ok(domain);assert.ok(createStateField(domain,{mode:'halving',count:8,step:1,reference:40}).candidates.length<=8);assert.equal(createStateField(domain,{mode:'halving',count:1000,step:1,reference:40}).candidates.length,0);
});
test('importing variants against an equivalent base rebinds local editor handles before applying deltas',()=>{
 const source=emptyWorld(),base=locate(source,definition(source)),variant=childNode(source,base.origin,true),recipe=structuredClone(base.omnic);recipe.components[0].params.length=150;saveDefinition(source,variant.origin,recipe,'long');
 const target=emptyWorld(),canonical=locate(target,definition(target));canonical.omnic.components[0].id='other-local-handle';const file=createPartsFile(source,fullChoice(source)),result=preparePartsImport(target,file,fullChoice(file.world),false);validateWorld(result);assert.equal(result.nodes.length,2);const imported=result.nodes.find(n=>n.label==='long');assert.equal(definitionRecipe(imported,result).components[0].params.length,150);assert.equal(definitionRecipe(imported,result).components[0].id,'other-local-handle');
});
test('reusing a definition does not overwrite a different pin with the same revision number',()=>{
 const source=emptyWorld(),leaf=locate(source,definition(source)),root=locate(source,definition(source,'radial'));root.omnic=addReference(root.omnic,leaf,source,'follow',true);
 const target=emptyWorld(),canonical=locate(target,definition(target));canonical.omnicHistory=[{...createRecipe('boundary'),revision:1}];const file=createPartsFile(source,fullChoice(source)),result=preparePartsImport(target,file,fullChoice(file.world),false),imported=result.nodes.find(n=>n.label==='radial'),reference=definitionRecipe(imported,result).components.find(c=>c.generator==='reference');assert.equal(reference.referenceRevision,2);assert.equal(atlasRecipeResolver(result)(reference.reference,2).components[0].generator,'line');validateWorld(result);
});
test('world and composer use the same centered glyph surface projection across non-square glyph bounds',async()=>{
 const {glyphSurfacePoint}=await import('../src/omnic/surface.ts');assert.deepEqual(glyphSurfacePoint({x:10,y:20,width:100,height:50},{x:0,y:0}),{x:60,y:45});assert.deepEqual(glyphSurfacePoint({x:10,y:20,width:100,height:50},{x:.5,y:.5}),{x:110,y:-5});
});
test('render caches survive unrelated scene changes and separate published glyphs from editable drafts',async()=>{
 const {createGlyphPresentation}=await import('../src/omnic/presentation.ts'),world=emptyWorld(),node=locate(world,definition(world)),normal=createGlyphPresentation(world),asset=normal(node);assert.ok(asset);const recolored=structuredClone(world);recolored.appearance.text.color='#ffffff';assert.equal(createGlyphPresentation(recolored),normal);assert.equal(normal(node),asset);
 node.omnicDraft=createRecipe('radial');const preview=createGlyphPresentation(world,true)(node,0,{recipe:node.omnicDraft,evaluation:evaluateRecipe(node.omnicDraft)});assert.notEqual(preview.asset.dataUrl,asset.asset.dataUrl);assert.equal(createGlyphPresentation(recolored)(node).asset.dataUrl,asset.asset.dataUrl);
});
