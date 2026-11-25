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

test('document opacity follows inherited node controls through preview, cancellation and commit',async()=>{
 const {readNodeTextPresentation,paintPreview}=await import('../src/core/appearance.ts');
 const {childNode}=await import('../src/core/nodeOperations.ts');
 const store=createStore({getItem:()=>null,setItem(){}});let origin,variant;
 store.change(world=>{
  origin=addStructure(world,[0,0,0],1).origin;
  variant=childNode(world,origin,true).origin;
  writePaint(world,'nodeDefaults',[],{opacity:.8,translucency:.25});
 });
 const colors=[],opacities=[];
 const session=createDocumentPaintSession(paint=>colors.push(paint.color),value=>opacities.push(value));
 const render=world=>{
  const {paint,opacity}=readNodeTextPresentation(world,variant);
  session.render(paint,opacity);
 };
 render(store.world);
 const preview=paintPreview(store.world,'nodes',[origin],{translucency:.625});
 render(preview);
 render(store.world);
 store.change(world=>writePaint(world,'nodes',[variant],{opacity:.4,translucency:.5}));
 render(store.world);
 assert.equal(colors.length,1);
 assert.deepEqual(opacities.map(value=>Math.round(value*100)),[60,30,60,20]);
});
