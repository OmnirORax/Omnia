import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyDocument,validateDocument,editorView} from '../src/graph/structural.ts';
import {worldPositions} from '../src/graph/coordinates.ts';
import {chartedBinders} from '../src/graph/binders.ts';
import {reconnectBinder} from '../src/graph/reconnectBinder.ts';
import {placeBinderText} from '../src/graph/binderLabels.ts';
const point=x=>({x,y:0,z:0});
function fixture(){const doc=emptyDocument();for(const [id,x] of [['a',10],['b',12],['c',30]]){doc.entities.push({id,label:id,aliases:[],notes:''});doc.placements.push({id,entityId:id,parentId:null,position:{x:28,y:104},spatialPosition:point(x),collapsed:false,hidden:false});}return doc;}
const binder=(doc,kind)=>chartedBinders(validateDocument(doc),editorView(doc,new Set(doc.placements.map(p=>p.id)))).find(b=>b.kind===kind);
const positionsEqual=(before,after)=>{for(const [id,point] of worldPositions(before))assert.deepEqual(worldPositions(after).get(id),point,`position preserved for ${id}`);};
function relationship(){const doc=fixture();doc.relationships=[{id:'rel',typeId:doc.relationshipTypes[0].id,label:'connects',participants:doc.relationshipTypes[0].roles.slice(0,2).map((role,i)=>({roleId:role.id,entityId:i?'b':'a'})),qualifierIds:[],text:'My binder',appearance:{color:'#abcdef',opacity:.7}}];return doc;}
function composition(){const doc=fixture();doc.placements[1].parentId='a';doc.placements[1].spatialPosition=point(2);doc.compositions=[{id:'comp',parentId:'a',childId:'b',text:'Contains',appearance:{color:'#abcdef',opacity:.6}}];return doc;}
function variant(){const doc=fixture();doc.variants=[{id:'var',ownerId:'a',entityId:'b',text:'Variant',appearance:{color:'#abcdef',opacity:.8}}];doc.variantPlacementsVersion=1;doc.placements[1].parentId='a';doc.placements[1].spatialPosition=point(2);doc.placements[1].variantOwner={placementId:'a',variantId:'var'};return doc;}
test('binder label root stays at its midpoint through rotations without side switching',()=>{
 for(let i=0;i<360;i++){
  const angle=i*Math.PI/180,anchor={x:200,y:150,dx:Math.cos(angle),dy:Math.sin(angle),width:80,height:16},label=placeBinderText(anchor);
  assert.ok(label);assert.ok(Math.abs(Math.hypot(label.x-anchor.x,label.y-anchor.y)-40)<1e-9);
  assert.ok(Math.abs((label.x-anchor.x)*anchor.dx+(label.y-anchor.y)*anchor.dy)<1e-9);
  assert.ok(Math.abs(label.angle)<=Math.PI/2);assert.deepEqual(placeBinderText(anchor),label);
  assert.ok(Math.abs(label.x-(200-Math.sin(angle)*40))<1e-9);
 }
});
test('degenerate projected binder does not produce invalid text transforms',()=>{
 assert.equal(placeBinderText({x:0,y:0,dx:0,dy:0,width:40,height:16}),undefined);
});
test('typed relationship reconnect preserves binder ID, participant roles, styling and other participants',()=>{
 for(const end of ['source','target']){const doc=relationship(),before=JSON.stringify(doc),edge=binder(doc,'relationship'),next=reconnectBinder(doc,edge,end,'c'),index=end==='source'?0:1;
 assert.equal(next.relationships[0].participants[index].entityId,'c');assert.equal(next.relationships[0].participants[index].roleId,doc.relationships[0].participants[index].roleId);
 assert.deepEqual({...next.relationships[0],participants:doc.relationships[0].participants},doc.relationships[0]);positionsEqual(doc,next);assert.equal(JSON.stringify(doc),before);}
});
test('nested containment reconnects the chosen endpoint without moving existing nodes or losing content',()=>{
 for(const end of ['source','target']){const doc=composition(),next=reconnectBinder(doc,binder(doc,'composition'),end,'c');
 assert.equal(next.compositions[0].id,'comp');assert.equal(next.compositions[0][end==='source'?'parentId':'childId'],'c');
 assert.deepEqual(next.compositions[0].appearance,doc.compositions[0].appearance);positionsEqual(doc,next);assert.deepEqual(next.entities,doc.entities);
 if(end==='source')assert.equal(next.placements.find(p=>p.id==='b').parentId,'c');else{assert.equal(next.placements.find(p=>p.id==='b').parentId,null);assert.equal(next.placements.find(p=>p.id==='c').parentId,'a');}}
});
test('non-nested canonical containment changes no independent visual parentage',()=>{
 const doc=composition();doc.placements[1].parentId=null;doc.placements[1].spatialPosition=point(12);const edge=binder(doc,'composition');assert.equal(edge.key,'comp');
 const next=reconnectBinder(doc,edge,'target','c');assert.deepEqual(next.placements,doc.placements);assert.equal(next.compositions[0].childId,'c');
});
test('visual nesting reconnect preserves world positions and its binder appearance without authoring containment',()=>{
 for(const end of ['source','target']){const doc=composition();doc.compositions=[];doc.placements[1].nestingBinder={text:'Visual',appearance:{color:'#abcdef',opacity:.9}};
 const next=reconnectBinder(doc,binder(doc,'visual'),end,'c');positionsEqual(doc,next);assert.equal(next.compositions.length,0);
 const child=next.placements.find(p=>p.id===(end==='target'?'c':'b'));assert.deepEqual(child.nestingBinder,doc.placements[1].nestingBinder);}
});
test('variant source and target reconnects preserve prior node content and shared reference metadata',()=>{
 for(const end of ['source','target']){const doc=variant(),before=JSON.stringify(doc),next=reconnectBinder(doc,binder(doc,'variant'),end,'c');
 positionsEqual(doc,next);assert.deepEqual(next.entities,doc.entities);assert.equal(next.variants[0].id,'var');assert.deepEqual(next.variants[0].appearance,doc.variants[0].appearance);
 const child=next.placements.find(p=>p.id===(end==='source'?'b':'c'));assert.equal(child.variantOwner.placementId,end==='source'?'c':'a');
 assert.equal(next.variants[0][end==='source'?'ownerId':'entityId'],'c');if(end==='target'){assert.equal(next.placements.find(p=>p.id==='b').variantOwner,undefined);assert.equal(next.placements.find(p=>p.id==='b').entityId,'b');}
 assert.equal(JSON.stringify(doc),before);validateDocument(JSON.parse(JSON.stringify(next)));}
});
test('variant reconnection leaves old independent occurrences intact instead of rebinding their content',()=>{
 const doc=variant();doc.placements.push({id:'a2',entityId:'a',parentId:null,position:{x:28,y:104},spatialPosition:point(50),collapsed:false,hidden:false},{id:'b2',entityId:'b',parentId:'a2',position:{x:28,y:104},spatialPosition:point(2),collapsed:false,hidden:false,variantOwner:{placementId:'a2',variantId:'var'}});
 const edge=chartedBinders(doc,editorView(doc,new Set(doc.placements.map(p=>p.id)))).find(b=>b.kind==='variant'&&b.target==='b'),next=reconnectBinder(doc,edge,'source','c');positionsEqual(doc,next);
 assert.equal(next.placements.find(p=>p.id==='b2').entityId,'b');assert.equal(next.placements.find(p=>p.id==='b2').variantOwner,undefined);
});
test('cycles, duplicate canonical edges, projected/stale endpoints and existing ownership reject atomically',()=>{
 const doc=composition(),edge=binder(doc,'composition');doc.compositions.push({id:'reverse',parentId:'b',childId:'c'});const before=JSON.stringify(doc);
 assert.throws(()=>reconnectBinder(doc,edge,'source','c'),/cycl/i);assert.equal(JSON.stringify(doc),before);
 const duplicate=composition();duplicate.compositions.push({id:'duplicate',parentId:'a',childId:'c'});assert.throws(()=>reconnectBinder(duplicate,edge,'target','c'),/Duplicate|duplicate/);
 const occupied=composition();occupied.placements[2].parentId='b';assert.throws(()=>reconnectBinder(occupied,edge,'target','c'),/Detach/);
 const rel=relationship(),r=binder(rel,'relationship');assert.throws(()=>reconnectBinder(rel,{...r,source:'c'},'target','a'),/actual.*endpoints/);
 assert.throws(()=>reconnectBinder(rel,r,'target','missing'),/no longer exists/);assert.equal(reconnectBinder(rel,r,'target','b'),rel);
});

test('parent reconnection rebases every saved view while preserving its world arrangement and recovery flag',()=>{
 const doc=composition();doc.layoutViews=[{id:'saved',name:'Saved',rule:'manual',preservePositions:true,positions:[{placementId:'a',position:point(100)},{placementId:'b',position:point(2)},{placementId:'c',position:point(300)}]}];
 const before=JSON.stringify(doc),next=reconnectBinder(doc,binder(doc,'composition'),'source','c');
 const view=next.layoutViews[0];assert.equal(view.preservePositions,true);assert.equal(view.positions.find(p=>p.placementId==='b').position.x,-198);
 const positions=new Map(view.positions.map(p=>[p.placementId,p.position]));const restored={...next,placements:next.placements.map(p=>({...p,spatialPosition:positions.get(p.id)}))};
 assert.equal(worldPositions(restored).get('b').x,102);assert.equal(JSON.stringify(doc),before);
});

test('rewiring a low legacy root into nesting keeps XYZ and fits existing 2D child constraints',()=>{
 const doc=composition();doc.placements[2].position={x:0,y:0};const before=worldPositions(doc),next=reconnectBinder(doc,binder(doc,'composition'),'target','c');
 assert.deepEqual(worldPositions(next),before);assert.ok(next.placements.find(p=>p.id==='c').position.x>=24);assert.ok(next.placements.find(p=>p.id==='c').position.y>=96);
});


test('reconnection reveals a closed new parent instead of hiding the connected branch',()=>{
 for(const kind of ['composition','visual','variant']){
  const doc=kind==='variant'?variant():composition();if(kind==='visual')doc.compositions=[];
  doc.placements.find(p=>p.id==='c').collapsed=true;
  const next=reconnectBinder(doc,binder(doc,kind),'source','c');assert.equal(next.placements.find(p=>p.id==='c').collapsed,false);positionsEqual(doc,next);
 }
});


test('compact binder wrapping preserves every word without shrinking line height',async()=>{
 const {labelLines,labelSize}=await import('../src/graph/labels.ts');
 assert.deepEqual(labelLines('contains inverse',14),['contains','inverse']);
 const size=labelSize('contains inverse',14);assert.equal(size.height,1);assert.equal(size.width,labelSize('contains').width);
});
