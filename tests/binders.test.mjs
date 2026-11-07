import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyDocument,validateDocument,editorView} from '../src/graph/structural.ts';
import {worldPositions} from '../src/graph/coordinates.ts';
import {chartedBinders} from '../src/graph/binders.ts';
import {reconnectBinder} from '../src/graph/reconnectBinder.ts';
import {createLabelSpace,placeBinderText,screenBoxesOverlap} from '../src/graph/binderLabels.ts';
const point=x=>({x,y:0,z:0});
function fixture(){const doc=emptyDocument();for(const [id,x] of [['a',10],['b',12],['c',30]]){doc.entities.push({id,label:id,aliases:[],notes:''});doc.placements.push({id,entityId:id,parentId:null,position:{x:28,y:104},spatialPosition:point(x),collapsed:false,hidden:false});}return doc;}
const binder=(doc,kind)=>chartedBinders(validateDocument(doc),editorView(doc,new Set(doc.placements.map(p=>p.id)))).find(b=>b.kind===kind);
const positionsEqual=(before,after)=>{for(const [id,point] of worldPositions(before))assert.deepEqual(worldPositions(after).get(id),point,`position preserved for ${id}`);};
function relationship(){const doc=fixture();doc.relationships=[{id:'rel',typeId:doc.relationshipTypes[0].id,label:'connects',participants:doc.relationshipTypes[0].roles.slice(0,2).map((role,i)=>({roleId:role.id,entityId:i?'b':'a'})),qualifierIds:[],text:'My binder',appearance:{color:'#abcdef',opacity:.7}}];return doc;}
function composition(){const doc=fixture();doc.placements[1].parentId='a';doc.placements[1].spatialPosition=point(2);doc.compositions=[{id:'comp',parentId:'a',childId:'b',text:'Contains',appearance:{color:'#abcdef',opacity:.6}}];return doc;}
function variant(){const doc=fixture();doc.variants=[{id:'var',ownerId:'a',entityId:'b',text:'Variant',appearance:{color:'#abcdef',opacity:.8}}];doc.variantPlacementsVersion=1;doc.placements[1].parentId='a';doc.placements[1].spatialPosition=point(2);doc.placements[1].variantOwner={placementId:'a',variantId:'var'};return doc;}
test('binder labels start at the edge and run perpendicular into the available side',()=>{
 const obstacle={x:200,y:200,width:60,height:50},space=createLabelSpace([obstacle],400,300),anchor={x:200,y:150,dx:100,dy:0,width:80,height:16};
 const placed=placeBinderText(space,[anchor]);assert.ok(placed);assert.ok(placed.y<anchor.y);
 assert.ok(Math.abs(Math.cos(placed.angle))<1e-9);assert.equal(Math.hypot(placed.x-anchor.x,placed.y-anchor.y)-placed.width/2,space.gap);
 assert.equal(screenBoxesOverlap(placed,obstacle,space.gap),false);
});
test('diagonal label placement uses projected normal and reserves its rotated footprint for other labels',()=>{
 const space=createLabelSpace([],500,400),anchor={x:250,y:200,dx:1,dy:1,width:70,height:14},a=placeBinderText(space,[anchor]),b=placeBinderText(space,[anchor]);
 assert.ok(a&&b);assert.ok(Math.abs(Math.cos(a.angle)+Math.sin(a.angle))<1e-9);assert.equal(screenBoxesOverlap(a,b,space.gap),false);
 assert.equal(placeBinderText(space,[anchor]),undefined);
});
test('label packing tries another binder attachment and never falls back over a node or outside viewport',()=>{
 const blocked={x:80,y:80,width:150,height:150},space=createLabelSpace([blocked],400,300);
 const anchors=[{x:80,y:80,dx:1,dy:0,width:60,height:12},{x:270,y:150,dx:1,dy:0,width:60,height:12}];
 assert.equal(placeBinderText(space,anchors).anchor,1);
 assert.equal(placeBinderText(createLabelSpace([{x:100,y:100,width:200,height:200}],200,200),anchors),undefined);
 assert.equal(placeBinderText(createLabelSpace([],200,200),[{x:100,y:100,dx:0,dy:0,width:60,height:12}]),undefined);
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
