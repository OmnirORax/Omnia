import test from 'node:test';
import assert from 'node:assert/strict';
import {createFieldBinding,watchFields,requestFormSync} from '../src/ui/formState.ts';
import {createStore} from '../src/core/store.ts';
import {emptyWorld,addStructure} from '../src/core/model.ts';
import {readPaint,writePaint,resolveNodeAppearance} from '../src/core/appearance.ts';
import {NODE_VISUAL_PROPERTIES,validateNodePaint} from '../src/properties/nodeVisuals.ts';
import {propertyFor} from '../src/composer/runtime/appearance/registry.ts';

test('V1 body setters use the actual property definitions, exclude animation, and affect material values',()=>{
 assert.deepEqual(NODE_VISUAL_PROPERTIES.map(p=>p.id),['color','brightness','opacity','translucency','glow','translucencyRadius']);
 for(const property of NODE_VISUAL_PROPERTIES)assert.equal(property,propertyFor(property.id));
 const world=emptyWorld(),node=addStructure(world,[0,0,0],1);
 writePaint(world,'nodeDefaults',[],{color:'#204060',brightness:2,opacity:.4,glow:1.5,translucency:.25,translucencyRadius:.6});
 assert.equal(readPaint(world,'nodes',node.origin).color,'#204060');
 const material=resolveNodeAppearance(world,node);assert.equal(material.color,'#4080c0');assert.equal(material.opacity,.4);assert.equal(material.glow,1.5);assert.equal(material.translucencyRadius,.6);
 assert.equal(node.color,'#ffb000');assert.throws(()=>validateNodePaint({effect:'stars'}),/Invalid/);assert.throws(()=>validateNodePaint({brightness:3.1}),/Invalid/);assert.throws(()=>validateNodePaint({glow:2.1}),/Invalid/);
});
test('open boxes follow undo/redo and unrelated model changes preserve unfinished typing',()=>{
 const store=createStore({getItem:()=>null,setItem:()=>{}}),input={value:'1',type:'number',disabled:false};
 let value=1;store.change(world=>{world.settings.latticeScale=value;});
 const sync=createFieldBinding({input,read:()=>store.world.settings.latticeScale});
 input.value='2';store.change(world=>world.settings.latticeScale=2);sync();
 store.undo();sync();assert.equal(input.value,'1');store.redo();sync();assert.equal(input.value,'2');
 input.value='2.';store.change(world=>world.settings.names='all');sync();assert.equal(input.value,'2.');
});
test('checkboxes, selections, and removed/restored owners sync without new edit events',()=>{
 let value=false;const checkbox={value:'false',type:'checkbox',checked:false,disabled:false},check=createFieldBinding({input:checkbox,read:()=>value});value=true;check();assert.equal(checkbox.checked,true);value=false;check();assert.equal(checkbox.checked,false);
 let selected='auto';const input={value:'auto',type:'select-one',disabled:false},sync=createFieldBinding({input,read:()=>selected});selected='orbit';sync();assert.equal(input.value,'orbit');selected=undefined;sync();assert.equal(input.disabled,true);selected='walk';sync();assert.equal(input.value,'walk');assert.equal(input.disabled,false);
});
test('field refreshes coalesce before paint and drop disconnected forms',async()=>{
 let model=1,reads=0;const input={value:'1',type:'number',disabled:false},form={isConnected:true,closest:()=>null};
 watchFields(form,[{input,read:()=>{reads++;return model;}}]);model=2;requestFormSync();requestFormSync();requestFormSync();await Promise.resolve();assert.equal(input.value,'2');assert.equal(reads,2);
 form.isConnected=false;requestFormSync();await Promise.resolve();assert.equal(reads,2);
});
