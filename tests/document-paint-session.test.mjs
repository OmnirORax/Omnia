import test from 'node:test';import assert from 'node:assert/strict';
import {createDocumentPaintSession} from '../src/text/paintSession.ts';
import {createStore} from '../src/core/store.ts';import {addStructure} from '../src/core/model.ts';import {readPaint,writePaint} from '../src/core/appearance.ts';
test('refresh restores authored document color and glow after a stale preview, even when the model paint has not changed',()=>{
 const applied=[],session=createDocumentPaintSession(paint=>applied.push({...paint})),authored={color:'#ff5500',glowColor:'#ff2200',glow:1};
 session.render(authored);session.render({color:'#fff0df',glowColor:'#ffffff',glow:1});assert.equal(session.render(authored),true);assert.deepEqual(applied.at(-1),authored);assert.equal(session.render(authored),false);assert.equal(applied.length,3);
});
test('open document follows global text changes across repeated previews and committed image colors',()=>{
 const store=createStore({getItem:()=>null,setItem(){}});let origin;store.change(world=>{origin=addStructure(world,[0,0,0],1).origin;});let displayed;
 const session=createDocumentPaintSession(paint=>displayed=paint),refresh=()=>session.render(readPaint(store.world,'nodeText',origin));refresh();
 for(const color of ['#ff3300','#22dd55','#aa22ff']){store.change(world=>writePaint(world,'text',[],{color,glowColor:color},'automatic'));refresh();session.render({color:'#ffffff',glowColor:'#ffffff',glow:1});refresh();assert.equal(displayed.color,color);assert.equal(displayed.glowColor,color);}
});
test('failed paint application does not poison the displayed-paint cache',()=>{let fail=true;const session=createDocumentPaintSession(()=>{if(fail)throw Error('failed');});assert.throws(()=>session.render({color:'#00ff00'}));fail=false;assert.equal(session.render({color:'#00ff00'}),true);});

test('document stroke transmission follows inherited node controls through preview, cancellation and commit',async()=>{
 const {readNodeTextPresentation,paintPreview}=await import('../src/core/appearance.ts');
 const {childNode}=await import('../src/core/nodeOperations.ts');
 const store=createStore({getItem:()=>null,setItem(){}});let origin,variant;
 store.change(world=>{
  origin=addStructure(world,[0,0,0],1).origin;
  variant=childNode(world,origin,true).origin;
  writePaint(world,'nodeDefaults',[],{opacity:.8,translucency:.25,translucencyRadius:.76});
 });
 const colors=[],opacities=[];
 const session=createDocumentPaintSession(paint=>colors.push(paint.color),value=>opacities.push(value));
 const render=world=>{
  const {paint,transmission}=readNodeTextPresentation(world,variant);
  session.render(paint,transmission);
 };
 render(store.world);
 const preview=paintPreview(store.world,'nodes',[origin],{translucency:.625,translucencyRadius:.3});
 render(preview);
 render(store.world);
 store.change(world=>writePaint(world,'nodes',[variant],{opacity:.4,translucency:.5,translucencyRadius:1}));
 render(store.world);
 assert.equal(colors.length,1);
 assert.deepEqual(opacities,[
  {opacity:.8,translucency:.25,radius:.76},
  {opacity:.8,translucency:.625,radius:.3},
  {opacity:.8,translucency:.25,radius:.76},
  {opacity:.4,translucency:.5,radius:1},
 ]);
});

test('document stroke mask keeps the rim stronger than the interior and responds to the radius',async()=>{
 const {boundaryOpacity}=await import('../src/properties/translucency.ts');
 const {createDocumentTransmission}=await import('../src/ui/palettePaint.ts');
 class Element{
  attrs={};children=[];
  style={setProperty(name,value){this[name]=value;},removeProperty(name){delete this[name];}};
  setAttribute(name,value){this.attrs[name]=value;}
  append(...nodes){this.children.push(...nodes);}
  remove(){}
 }
 const previous=globalThis.document,body=new Element(),host=new Element();
 globalThis.document={body,createElementNS:()=>new Element()};
 const paint=createDocumentTransmission(host);
 try{
  paint.render({opacity:.8,translucency:.7,radius:.76});
  const filter=body.children[0].children[0],edge=filter.children[3].children[0];
  const rim=Number(edge.attrs.slope),middle=Number(filter.children[4].attrs.k3),inner=Number(filter.children[5].attrs.k3);
  assert.equal(host.style['--document-transmission-opacity'],'0.8');
  assert.ok(rim>rim+middle&&rim+middle>rim+middle+inner);
  assert.ok(Math.abs(rim+middle+inner-boundaryOpacity(.7,.76,0))<1e-9);
  paint.render({opacity:.8,translucency:.7,radius:1});
  assert.ok(Number(edge.attrs.slope)<rim);
  assert.equal(body.children.length,1);
  paint.render({opacity:.8,translucency:0,radius:1});
  assert.equal(host.style['--document-transmission-filter'],undefined);
 }finally{paint.dispose();globalThis.document=previous;}
});
