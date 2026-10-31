import { createContextTargets, contextTargets } from '../src/ui/contextTargets.ts';
import { preferredFeatureKey } from '../src/workspaceActions.ts';
import { claimUIPress, finishUIPress } from '../src/ui/pointerOwnership.ts';
import { dismissContextDials } from "../src/ui/activeContextModel.ts";
import { activeToolCursor, cursorApplies, inCursorArea } from "../src/ui/toolCursorModel.ts";
import { PEN_SYMBOL, ERASER_SYMBOL } from "../src/ui/symbols.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { radialTree, radialSlot, radialDimensions, radialQuickSlot, radialLayout, radialRowLayout, radialRowAttachment } from '../src/ui/radialMenuModel.ts';
import { circularFrameExtent, fitFrameShape } from '../src/ui/frameShape.ts';
import {
  emptyUILayout,
  validateUILayout,
  normalizeLiveUILayout,
  groupFunctions,
  dockResident,
  detachFunction,
  ownerOf,
  fitWindow,
  nearestSlot,
} from "../src/ui/layout.ts";
test('shared target routing chooses the nearest supported scope and asks before multi-DOF execution',()=>{
  const registry=createContextTargets(),calls=[],element={contains:target=>target==='canvas'};
  let targets=[{id:'member',label:'Member',commands:{deleteSelected:{run:()=>calls.push('delete member')}}},
    {id:'group',label:'Group',commands:{resize:{degrees:[{id:'radius',label:'Radius',run:()=>calls.push('radius')},{id:'width',label:'Width',run:()=>calls.push('width')}]}}}];
  const source=registry.register({owner:'composer',element:()=>element,read:()=>targets});
  registry.context('composer','canvas');assert.equal(registry.active(),true);
  assert.equal(registry.invoke('deleteSelected'),true);assert.deepEqual(calls,['delete member']);
  assert.equal(registry.available('context.close'),false,'unsupported Close never becomes geometry deletion');
  registry.invoke('resize');assert.equal(calls.length,1,'ambiguous operation does not execute');
  assert.equal(registry.choice.getSnapshot().degrees.length,2);registry.choose('width');assert.equal(calls.at(-1),'width');
  registry.invoke('resize');targets=[{id:'other',label:'Other',commands:{resize:{degrees:[{id:'radius',label:'Radius',run:()=>calls.push('wrong target')}]}}}];
  assert.equal(registry.choose('radius'),false,'stale choices never affect a replacement target');
  registry.invoke('resize');assert.equal(calls.at(-1),'wrong target','one compatible DOF executes directly');
  registry.context('composer',null,true);assert.equal(registry.override('context.back'),false,'field/popup Escape retains priority');
  registry.context('other','canvas');assert.equal(registry.active(),false,'leaving the surface restores existing context behavior');source.dispose();
});
test('shared MC shortcuts own selected geometry while MS and held-gesture cancellation keep priority',()=>{
  const source=contextTargets.register({owner:'composer',element:()=>null,read:()=>[{id:'target',label:'Geometry',commands:{}}]});source.activate();
  try{
    assert.equal(preferredFeatureKey({},'D',id=>['context.descendants','atomnic.draw'].includes(id)),'context.descendants');
    assert.equal(preferredFeatureKey({'selector.pattern':'D'},'D',id=>['selector.pattern','context.descendants','atomnic.draw'].includes(id)),'selector.pattern');
    claimUIPress(999,'mouse',1);
    assert.equal(preferredFeatureKey({},'Esc',id=>['context.back','atomnic.cancel'].includes(id)),'atomnic.cancel');
  }finally{finishUIPress({pointerId:999,pointerType:'mouse',buttons:0});source.dispose();}
});
test('empty-space dismissal closes nested dials without closing unrelated context layers',()=>{
  const calls=[],layers=new Map();
  layers.set('other',{close:()=>calls.push('unrelated')});
  layers.set('parent',{close:()=>{},dismiss:()=>calls.push('parent')});
  layers.set('child',{close:()=>{},dismiss:()=>{calls.push('child');layers.delete('parent');}});
  assert.equal(dismissContextDials(layers.values()),true);
  assert.deepEqual(calls,['child','parent'],'all opened dial callbacks survive descendant cleanup');
  assert.equal(dismissContextDials([{close:()=>calls.push('unrelated')}]),false);
});
test('circular frame projection adapts old rectangles and preserves intentional resizes',()=>{
  const initial={width:360,height:360},legacy={width:600,height:650};
  assert.equal(circularFrameExtent(legacy,legacy,initial),360);
  assert.equal(circularFrameExtent({width:480,height:480},{width:480,height:480},initial),480);
  assert.equal(circularFrameExtent({width:300,height:240},legacy,initial),240);
  assert.deepEqual(legacy,{width:600,height:650},'projection does not overwrite stored layout');
  const viewport={x:10,y:20,width:600,height:400};
  assert.deepEqual(fitFrameShape(viewport,'circle'),{x:110,y:20,width:400,height:400});
  assert.equal(fitFrameShape(viewport,'rectangle'),viewport,'ordinary frame projections are unchanged');
});
test('quick radial tools stay adjacent on the rim and flattened wrappers preserve descendants',()=>{
  const leaf={id:'save',label:'Save',symbol:'▣',content:42};
  const object={id:'object',label:'Object',symbol:'◇',flatten:true},file={id:'file',label:'File',symbol:'📁'};
  const tree=radialTree([{...leaf,group:[object,file]},{...leaf,id:'retired',group:[object,{...file,hidden:true}]}]);
  assert.equal(tree.length,1);assert.equal(tree[0].id,'file');assert.equal(tree[0].children[0].content,42);
  for(const extent of [200,360,600]){
    const slots=Array.from({length:9},(_,index)=>radialQuickSlot(index,extent));
    assert.equal(slots[0].x,50);assert.ok(slots[0].y<50);assert.ok(slots[1].x>50);
    for(let i=0;i<slots.length;i++){
      const a=slots[i];assert.ok(a.x*extent/100>=a.size/2&&a.x*extent/100<=extent-a.size/2);
      assert.ok(a.y*extent/100>=a.size/2&&a.y*extent/100<=extent-a.size/2);
      for(const b of slots.slice(i+1))assert.ok(Math.hypot((a.x-b.x)*extent/100,(a.y-b.y)*extent/100)>=25.99);
    }
  }
});
test('radial projections group shared categories without changing leaf identities or controls',()=>{
  const save={id:'save',label:'Save',symbol:'▣'},file={id:'file',label:'Files',symbol:'⇅'};
  const action={run:'existing-owner'},field={value:'existing-name'};
  const tree=radialTree([
    {id:'save-shared',label:'Save shared',symbol:'▣',group:[save],content:action},
    {id:'name',label:'Name',symbol:'✎',group:[save],content:field},
    {id:'export',label:'Export',symbol:'⇧',group:[file],content:action},
  ]);
  assert.deepEqual(radialTree([{id:'hidden',label:'Hidden',symbol:'○',group:[{id:'retired',label:'Retired',symbol:'○',hidden:true}],content:action}]),[], 'retired radial categories expose no entries while preserving command owners');
  assert.equal(tree.length,2);assert.equal(tree[0].children.length,2);
  assert.equal(tree[0].children[0].id,'save-shared');assert.equal(tree[0].children[0].content,action);
  assert.equal(tree[0].children[1].content,field);
  const many=radialTree(Array.from({length:20},(_,i)=>({id:`tool-${i}`,label:`Tool ${i}`,symbol:'○',content:i})));
  const leaves=[];const visit=nodes=>{for(const node of nodes)if(node.children)visit(node.children);else leaves.push(node.content);};
  visit(many);assert.deepEqual(leaves,Array.from({length:20},(_,i)=>i),'all supplied entries retain direct slots; only declared categories nest');
  assert.equal(many.length,20);assert.ok(many.every(node=>!node.children));
  const without=radialLayout(many),withSetters=radialLayout(many.map(node=>({...node,setter:'value'})));
  assert.equal(withSetters.slots[0].setterAngle,-90);
  assert.ok(withSetters.slots[0].setterY<0,'top setter projects outward from its circle');
  assert.equal(without.radius,withSetters.radius,'outer setters cannot spread out the button ring');
  assert.deepEqual(without.slots.map(s=>s.size),withSetters.slots.map(s=>s.size));
  const top=radialSlot(0,6,0),next=radialSlot(1,6,0),inner=radialSlot(0,6,1);
  assert.equal(top.x,50);assert.ok(top.y<50);assert.ok(next.x>50,'clockwise from top');
  assert.ok(radialDimensions(1).radius<radialDimensions(0).radius&&inner.size<top.size,'progressively smaller category ring');
  assert.ok(radialDimensions(0,6).radius<=36,'sparse dials pack against their centre rather than a fixed 64px radius');
  for(let depth=0;depth<3;depth++)for(let index=0;index<6;index++){
    const slot=radialSlot(index,6,depth);
    const {extent}=radialDimensions(depth);
    assert.ok(slot.x*extent/100-slot.size/2>=0&&slot.x*extent/100+slot.size/2<=extent);
    assert.ok(slot.y*extent/100-slot.size/2>=0&&slot.y*extent/100+slot.size/2<=extent);
  }
  for(const count of [6,7,12,16]){
    const {extent}=radialDimensions(0,count),slots=Array.from({length:count},(_,i)=>radialSlot(i,count,0));
    for(let i=0;i<count;i++){const a=slots[i],b=slots[(i+1)%count];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)*extent/100>=a.size,'a flat target-DOF ring keeps all buttons separated');}
  }
});
test('radial outer value strips preserve compact button separation',()=>{
  for(const count of [6,12,24]){
    const {extent}=radialDimensions(0,count,12);
    const slots=Array.from({length:count},(_,i)=>radialSlot(i,count,0,12));
    for(let i=0;i<count;i++){
      const a=slots[i],b=slots[(i+1)%count];
      assert.ok(a.y*extent/100-a.size/2-12>=-1e-8);
      assert.ok(Math.hypot(a.x-b.x,a.y-b.y)*extent/100>=a.size-1e-9);
    }
  }
});
test("live coordinate moves preserve topology validation for other changes", () => {
  const previous = emptyUILayout();
  previous.windows.a = { x: 20, y: 30, width: 300, height: 400, collapsed: false, pinned: false };
  const moved = { ...previous, windows: { ...previous.windows, a: { ...previous.windows.a, x: 70, y: 90 } } };
  assert.equal(normalizeLiveUILayout(moved, previous), moved);
  assert.equal(normalizeLiveUILayout(previous, previous), previous);
  assert.throws(() => normalizeLiveUILayout({ ...moved, windows: { a: { ...moved.windows.a, x: Infinity } } }, previous));
  assert.throws(() => normalizeLiveUILayout({ ...moved, windows: { a: { ...moved.windows.a, members: [{ kind: 'window', id: 'missing' }] } } }, previous));
  assert.throws(() => normalizeLiveUILayout({ ...moved, windows: { a: { ...moved.windows.a, width: -1 } } }, previous));
});
test("grouping retains function identity and creates a named, initially collapsed UI frame", () => {
  const original = emptyUILayout(),
    grouped = groupFunctions(original, "focus", "undo", 96, 144);
  assert.equal(grouped.frames.length, 1);
  assert.equal(grouped.frames[0].collapsed, true);
  assert.equal(ownerOf(grouped, "function:focus"), ownerOf(grouped, "function:undo"));
  assert.deepEqual(original.items, {});
  const more = dockResident(grouped, "function:redo", `frame:${grouped.frames[0].id}`, 2, true);
  assert.deepEqual(more.frames[0].members, [
    { kind: "function", id: "focus" },
    { kind: "function", id: "undo" },
    { kind: "function", id: "redo", breakBefore: true },
  ]);
  assert.deepEqual(validateUILayout(JSON.parse(JSON.stringify(more))), more);
});
test("context-menu snapping stays deterministic, and removing a resident retains its neighbors", () => {
  assert.deepEqual(nearestSlot([{ x: 0, y: 0 }], { x: 0, y: 0 }), { x: 0, y: -1 });
  const grouped = groupFunctions(emptyUILayout(), "a", "b", 20, 30),
    id = grouped.frames[0].id;
  const left = dockResident(grouped, "function:c", `frame:${id}`, 0);
  assert.deepEqual(
    left.frames[0].members.map((m) => m.id),
    ["c", "a", "b"],
  );
  const detached = detachFunction(left, "c", 400, 300);
  assert.deepEqual(
    detached.frames[0].members.map((m) => m.id),
    ["a", "b"],
  );
  assert.equal(detached.frames[0].x, grouped.frames[0].x);
  assert.equal(detached.items.c.frameId, undefined);
  const occupied = left.frames[0].members.map((i) => `${i.kind}:${i.id}`);
  assert.equal(new Set(occupied).size, 3);
});
test("pinned functions and frames reject rearrangement", () => {
  let layout = groupFunctions(emptyUILayout(), "a", "b", 20, 30),
    id = layout.frames[0].id;
  layout.frames[0].pinned = true;
  assert.equal(dockResident(layout, "function:c", `frame:${id}`, 0), layout);
  layout.frames[0].pinned = false;
  layout.items.a.pinned = true;
  assert.equal(groupFunctions(layout, "a", "c", 0, 0), layout);
  assert.equal(dockResident(layout, "function:a", `frame:${id}`, 1), layout);
});
test("malformed templates reject missing frames, duplicate residents, invalid assets and unsafe geometry", () => {
  const valid = groupFunctions(emptyUILayout(), "a", "b", 20, 30),
    before = structuredClone(valid);
  assert.throws(
    () =>
      validateUILayout({
        ...valid,
        frames: [{ ...valid.frames[0], members: [{ kind: "frame", id: "missing" }] }],
      }),
    /Missing nested/,
  );
  assert.throws(
    () =>
      validateUILayout({
        ...valid,
        frames: [
          { ...valid.frames[0], members: [...valid.frames[0].members, valid.frames[0].members[0]] },
        ],
      }),
    /two frames/,
  );
  assert.throws(
    () =>
      validateUILayout({
        ...valid,
        windows: {
          w: { x: Infinity, y: 0, width: 400, height: 500, collapsed: false, pinned: false },
        },
      }),
    /window geometry/,
  );
  assert.throws(
    () =>
      validateUILayout({
        ...valid,
        items: {
          a: { x: 0, y: 0, style: { mode: "icon", geometry: "circle", assetId: "missing" } },
        },
      }),
    /appearance/,
  );
  assert.throws(
    () =>
      validateUILayout({
        ...valid,
        menus: { node: { createChild: { x: 0, y: 0 }, focus: { x: 0, y: 0 } } },
      }),
    /menu layout/,
  );
  assert.deepEqual(valid, before);
});
test("window fitting keeps resized and imported windows reachable without losing collapse or pin state", () => {
  const saved = { x: 1400, y: 900, width: 600, height: 700, pinned: true, collapsed: false };
  const fit = fitWindow(saved, 800, 600);
  assert.ok(fit.x >= 0 && fit.x + fit.width <= 800);
  assert.ok(fit.y >= 0 && fit.y + fit.height <= 600);
  assert.equal(fit.pinned, true);
  assert.equal(saved.width, 600);
  const collapsed = fitWindow({ ...saved, collapsed: true }, 800, 600);
  assert.equal(collapsed.collapsed, true);
  assert.equal(collapsed.height, fit.height);
});

test("custom UI fields retain values, names and placements through template round trips", async () => {
  const { customControl, addCustomControl, removeCustomControl } = await import("../src/ui/authoring.ts");
  const original = emptyUILayout();
  let layout = addCustomControl(original, "ui:custom:budget", customControl("Budget", "number"), 80, 120);
  layout.customControls["ui:custom:budget"].value = 31;
  layout.labels = { "function:ui:custom:budget": "Working budget" };
  layout = groupFunctions(layout, "ui:custom:budget", "focus", 100, 150);
  const restored = validateUILayout(JSON.parse(JSON.stringify(layout)));
  assert.equal(restored.customControls["ui:custom:budget"].value, 31);
  assert.equal(restored.labels["function:ui:custom:budget"], "Working budget");
  assert.ok(ownerOf(restored, "function:ui:custom:budget"));
  const removed = removeCustomControl(restored, "ui:custom:budget");
  assert.equal(removed.customControls["ui:custom:budget"], undefined);
  assert.equal(ownerOf(removed, "function:ui:custom:budget"), undefined);
  assert.equal(removed.items["ui:custom:budget"], undefined);
  assert.equal(removed.labels["function:ui:custom:budget"], undefined);
  assert.equal(original.customControls, undefined);
  assert.equal(restored.customControls["ui:custom:budget"].value, 31, "previous history entry stays intact");
});

test("custom UI field imports reject invalid types, values and dropdown choices", async () => {
  const { customControl, addCustomControl } = await import("../src/ui/authoring.ts");
  const valid = addCustomControl(emptyUILayout(), "ui:custom:choice", customControl("Choice", "select", ["A", "B"]), 20, 30);
  assert.equal(validateUILayout(valid).customControls["ui:custom:choice"].value, "A");
  for (const change of [{ value: "missing" }, { kind: "script" }, { options: ["A", "A"] }, { min: 10, max: 1 }])
    assert.throws(() => validateUILayout({ ...valid, customControls: { "ui:custom:choice": { ...valid.customControls["ui:custom:choice"], ...change } } }));
});

test('render function index preserves explicit/inline ownership and invalidates changed snapshots', async () => {
  const {functionIndex}=await import('../src/ui/functionIndex.ts');
  const functions=[{id:'first'},{id:'second'}];
  const layout=groupFunctions(emptyUILayout(),'first','second',96,144);
  layout.windows.child={x:0,y:0,width:100,height:100,collapsed:false,pinned:false,inline:{parent:'window:parent'}};
  layout.items.first={...layout.items.first,anchorId:'home|second'};
  const index=functionIndex(functions,layout);
  assert.equal(index.byId.get('first'),functions[0]);assert.deepEqual(index.anchors.get('home|second'),[functions[0]]);
  for(const key of ['function:first','function:second','window:child'])assert.equal(index.owners.get(key),ownerOf(layout,key));
  assert.equal(functionIndex(functions,layout),index);
  const next={...layout,items:{...layout.items,first:{...layout.items.first,anchorId:'new|second'}}};
  assert.equal(functionIndex(functions,next).anchors.has('home|second'),false);
  assert.equal(index.anchors.has('home|second'),true);
  assert.equal(functionIndex([...functions,{id:'third'}],next).byId.has('third'),true);
});

test('selective UI snapshots retain unrelated slices and event handlers read the latest committed owner',async()=>{
  const {createSelectiveStore,sameSlice}=await import('../src/ui/selectiveStore.ts');
  const first={section:{collapsed:false},other:0,run:()=>1},store=createSelectiveStore(first);
  let slice=[store.getSnapshot().section],renders=0;
  const stop=store.subscribe(()=>{const next=[store.getSnapshot().section];if(!sameSlice(slice,next)){slice=next;renders++;}});
  store.publish({...first,other:1,run:()=>2});assert.equal(renders,0);assert.equal(store.live.run(),2);
  assert.equal('section' in store.live,true);assert.equal({...store.live}.other,1);
  store.publish({...first,section:{collapsed:true}});assert.equal(renders,1);assert.equal(store.live.section.collapsed,true);
  stop();store.publish(first);assert.equal(renders,1);
});

test('window and native presentation subscriptions ignore unrelated collapse but retain actual dependencies',async()=>{
  const {residentRenderSlice,nativePresentationSlice}=await import('../src/ui/renderSubscriptions.ts');
  const {sameSlice}=await import('../src/ui/selectiveStore.ts');
  const layout=emptyUILayout();
  layout.windows.first={x:0,y:0,width:200,height:200,collapsed:false,pinned:false};
  layout.windows.other={x:0,y:0,width:200,height:200,collapsed:false,pinned:false};
  const ui={layout,functions:[],shortcutBindings:{}};
  const collapse={...ui,layout:{...layout,windows:{...layout.windows,other:{...layout.windows.other,collapsed:true}}}};
  assert.equal(sameSlice(residentRenderSlice(ui,'window:first'),residentRenderSlice(collapse,'window:first')),true);
  assert.equal(sameSlice(nativePresentationSlice(ui),nativePresentationSlice(collapse)),true);
  assert.equal(sameSlice(residentRenderSlice(ui,'window:other'),residentRenderSlice(collapse,'window:other')),false);
  const pin={...ui,layout:{...layout,windows:{...layout.windows,other:{...layout.windows.other,pinned:true}}}};
  assert.equal(sameSlice(nativePresentationSlice(ui),nativePresentationSlice(pin)),false);
  const renamed={...ui,layout:{...layout,labels:{'window:first':'Renamed'}}};
  assert.equal(sameSlice(residentRenderSlice(ui,'window:first'),residentRenderSlice(renamed,'window:first')),false);
  const rebind={...ui,shortcutBindings:{'button:@frame:window:first':'H'}};
  assert.equal(sameSlice(residentRenderSlice(ui,'window:first'),residentRenderSlice(rebind,'window:first')),false);
  const fn={id:'button',label:'Old',scope:'window:first'};
  const before={...ui,functions:[fn]};
  const caption={...before,functions:[{...fn,label:'New'}]};
  assert.equal(sameSlice(nativePresentationSlice(before),nativePresentationSlice(caption)),true);
  assert.equal(sameSlice(nativePresentationSlice(before),nativePresentationSlice({...before,functions:[{...fn,scope:'window:other'}]})),false);
});

test('mutation discovery scans an inserted branch once, retaining independent siblings',async()=>{
  const {minimalMutationRoots}=await import('../src/ui/mutationRoots.ts');
  const outer={parentElement:null},inner={parentElement:outer},leaf={parentElement:inner},sibling={parentElement:null};
  assert.deepEqual(minimalMutationRoots([inner,leaf,outer,sibling,leaf]),[outer,sibling]);
  assert.deepEqual(minimalMutationRoots([leaf,sibling]),[leaf,sibling]);
});

test('registry publication coalesces discovery and preserves the final active source per command',async()=>{
  const {createRegistrationBatch}=await import('../src/ui/registrationBatch.ts');
  const scheduled=[],published=[];
  const stage=createRegistrationBatch(value=>published.push(value),flush=>scheduled.push(flush));
  stage('field',{available:true,label:'First'});stage('field',{available:false});stage('field',{available:true,label:'Latest'});
  for(let i=0;i<100;i++)stage(`button-${i}`,{available:true});
  assert.equal(scheduled.length,1);assert.equal(published.length,0);
  scheduled.shift()();assert.equal(published.length,1);assert.equal(Object.keys(published[0]).length,101);
  assert.equal(published[0].field.label,'Latest');
  stage('field',{available:false});assert.equal(scheduled.length,1);scheduled.shift()();
  assert.deepEqual(published[1],{field:{available:false}});
});

test('subscriber reads evaluate once per committed snapshot and selector identity',async()=>{
  const {createSliceReader}=await import('../src/ui/selectiveStore.ts');
  let source={count:1,other:0},calls=0;
  const select=value=>{calls++;return [value.count];};
  const read=createSliceReader(()=>source),first=read(select);
  assert.equal(read(select),first);assert.equal(read(select),first);assert.equal(calls,1);
  source={count:1,other:1};assert.equal(read(select),first);assert.equal(calls,2);
  source={count:2,other:1};const changed=read(select);assert.notEqual(changed,first);assert.deepEqual(changed,[2]);
  // A selector may capture changed props even when owner state is unchanged.
  const replacement=value=>{calls++;return [value.other];};
  assert.deepEqual(read(replacement),[1]);assert.equal(calls,4);
  assert.deepEqual(read(select),[2]);assert.equal(calls,5);
});

test('drag read cache preserves policy results and invalidates on the next layout snapshot',async()=>{
  const {createDragQueries}=await import('../src/ui/dragQueries.ts');
  const {canDock,ownerOf,residentPinned,residentContextScope}=await import('../src/ui/layout.ts');
  const queries=createDragQueries(),layout=emptyUILayout();
  const window=()=>({x:0,y:0,width:200,height:200,collapsed:false,pinned:false});
  let pinReads=0;
  layout.windows.a=window();layout.windows.b={...window(),get pinned(){pinReads++;return false;}};
  assert.equal(queries.canDock(layout,'window:a','window:b'),true);const measured=pinReads;assert.ok(measured>0);
  for(let i=0;i<20;i++)assert.equal(queries.canDock(layout,'window:a','window:b'),true);
  assert.equal(pinReads,measured,'unchanged pointer previews reuse the permission result');
  const pinned={...layout,windows:{...layout.windows,b:{...window(),pinned:true}}};
  const nested={...layout,windows:{...layout.windows,a:{...window(),members:[{kind:'window',id:'b'}]}}};
  const scoped={...layout,windows:{...layout.windows,a:{...window(),inline:{parent:'window:context:node'}}}};
  for(const snapshot of [layout,pinned,nested,scoped,layout]){
    for(const key of ['window:a','window:b','window:missing']){
      assert.equal(queries.ownerOf(snapshot,key),ownerOf(snapshot,key));
      assert.equal(queries.residentPinned(snapshot,key),residentPinned(snapshot,key));
      assert.equal(queries.residentContextScope(snapshot,key),residentContextScope(snapshot,key));
      for(const target of ['window:a','window:b','window:missing'])assert.equal(queries.canDock(snapshot,key,target),canDock(snapshot,key,target));
    }
  }
});

test('activating the front window reuses its layer while other windows still rise',async()=>{
  const {nextWindowLayer,raiseWindowLayer,nextMenuLayer}=await import('../src/ui/layers.ts');
  const first=nextWindowLayer(),second=nextWindowLayer();
  assert.equal(raiseWindowLayer(second),second);
  assert.equal(raiseWindowLayer(second),second);
  const raised=raiseWindowLayer(first);assert.ok(raised>second);
  assert.equal(raiseWindowLayer(raised),raised);
  assert.ok(nextMenuLayer()>raised);
});


test('content right-click ownership preserves function handlers before UI editing fallbacks',async()=>{
  const {ownsContextMenu,routeContextMenu}=await import('../src/ui/contextMenuOwnership.ts');
  const event=()=>({defaultPrevented:true,stopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},isPropagationStopped(){return this.stopped;}});
  const calls=[];
  // Browser-menu prevention is global, so it cannot distinguish a domain menu.
  routeContextMenu(event(),e=>{calls.push('rotation-settings');e.stopPropagation();},()=>calls.push('ui-edit'),false);
  assert.deepEqual(calls,['rotation-settings'],'registered local behavior survives projection outside its original parent');
  calls.length=0;
  const contentEvent=event();
  routeContextMenu(contentEvent,undefined,()=>calls.push('ui-edit'),true);
  assert.equal(contentEvent.stopped,true);assert.deepEqual(calls,[],'owned menu whitespace never opens a second UI menu');
  routeContextMenu(event(),undefined,()=>calls.push('ui-edit'),false);
  assert.deepEqual(calls,['ui-edit'],'ordinary frame/button customization remains available despite defaultPrevented');
  assert.equal(ownsContextMenu(null),false);assert.equal(ownsContextMenu({}),false);
  for(const owner of ['data-context-menu-owner','data-context-controller']){
    const nested={closest:selector=>selector.includes('['+owner+']')?{}:null};
    assert.equal(ownsContextMenu(nested),true,'descendants inherit ownership from '+owner);
  }
});

test('shared active cursor gives MS priority, restores other tools, and pen/erase icons reverse both halves',()=>{
  const pen={priority:0,key:'pen'},erase={priority:0,key:'erase'},selector={priority:100,key:'selector'};
  assert.equal(activeToolCursor([pen,erase]),erase);
  assert.equal(activeToolCursor([pen,selector,erase]),selector);
  assert.equal(activeToolCursor([erase]),erase);assert.equal(activeToolCursor([]),null);
  const svg=url=>decodeURIComponent(url.slice(url.indexOf(',')+1));
  const fills=url=>[...svg(url).matchAll(/<path fill="(#[a-z0-9]+)"/g)].map(match=>match[1]);
  assert.deepEqual(fills(PEN_SYMBOL),['#000','#fff']);assert.deepEqual(fills(ERASER_SYMBOL),['#fff','#000']);
  assert.equal((svg(PEN_SYMBOL).match(/<path/g)||[]).length,2,'two body halves only, no underline');
});

test('cursor applicability follows operation zones and restores native behavior outside them',()=>{
  const pen={priority:0,key:'pen',zone:'composer-a'},other={priority:1,key:'other',zone:'composer-b'},selector={priority:100,key:'selector',zone:'*'};
  const pick=(zone,blocked=false)=>activeToolCursor([pen,other],request=>cursorApplies(request,zone,blocked));
  assert.equal(pick('composer-a'),pen);assert.equal(pick('composer-b'),other);
  assert.equal(pick(undefined),null,'toolbars and other controls keep their native cursor');
  assert.equal(pick('composer-a',true),null,'settings controllers suspend tools');
  assert.equal(cursorApplies({},'composer-a'),false,'unscoped tools never leak globally');
  assert.equal(cursorApplies(selector,undefined),true);assert.equal(cursorApplies(selector,undefined,true),false);
  assert.equal(cursorApplies({...selector,parked:{x:0,y:0}},undefined,true),true,'parked MS remains a stationary marker');
  const circle={left:100,top:100,width:200,height:200,circle:true};
  assert.equal(inCursorArea({x:200,y:200},circle),true);
  assert.equal(inCursorArea({x:110,y:110},circle),false,'circular corners/rim are outside editing');
  assert.equal(inCursorArea({x:310,y:200},circle),false,'pointer capture cannot extend applicability');
  assert.equal(inCursorArea({x:110,y:110},{...circle,circle:false}),true);
});

test('outside-zone DOF settings dismiss outside controls but preserve popup interiors',async()=>{
 const {dismissOutsideContext}=await import('../src/ui/activeContextModel.ts');
 const inside={},outside={},calls=[];
 const layers=new Map([[{contains:t=>t===inside},{close:()=>{},dismiss:()=>calls.push('settings'),dismissOutside:true}],[{contains:()=>false},{close:()=>{},dismiss:()=>calls.push('ordinary') }]]);
 assert.equal(dismissOutsideContext(layers,inside),false);assert.deepEqual(calls,[]);
 assert.equal(dismissOutsideContext(layers,outside),true);assert.deepEqual(calls,['settings']);
});

test('child rows preserve upright nonoverlapping controls along every parent axis',()=>{
 for(const count of [1,2,7,20])for(const axis of [{x:1,y:0},{x:0,y:-1},{x:-3,y:4}]){
  const nodes=Array.from({length:count},(_,i)=>({id:String(i),label:String(i),symbol:'○',setter:i}));
  const row=radialRowLayout(nodes,axis),ux=row.axis.x,uy=row.axis.y;
  for(const [i,slot] of row.slots.entries()){
   const x=(slot.x-50)*row.extent/100,y=(slot.y-50)*row.extent/100;
   assert.ok(Math.abs(x*uy-y*ux)<1e-8,'every child lies on the parent axis');
   assert.equal(slot.size,24);
   assert.ok(Math.abs(x)+slot.size/2<=row.extent/2&&Math.abs(y)+slot.size/2<=row.extent/2);
   if(i){const prev=row.slots[i-1];assert.ok(Math.hypot(slot.x-prev.x,slot.y-prev.y)*row.extent/100>=25.99);}
   const setterX=slot.setterX-slot.size/2,setterY=slot.setterY-slot.size/2;
   assert.ok(Math.abs(setterX*ux+setterY*uy)<1e-8,'held value setters extend perpendicular to the row, away from siblings');
  }
 }
});

test('automatic child rows attach to the parent button centre without shell-dependent offsets',()=>{
 for(const scale of [1,1.5,2])for(const axis of [{x:1,y:0},{x:0,y:-1},{x:-.6,y:.8}]){
  const center={x:130,y:90},button={x:center.x+axis.x*37,y:center.y+axis.y*37,width:32*scale};
  const length=76,anchor=radialRowAttachment(center,button,length,scale);
  const first={x:anchor.x-axis.x*(length-24)*scale/2,y:anchor.y-axis.y*(length-24)*scale/2};
  assert.ok(Math.abs((first.x-button.x)*axis.y-(first.y-button.y)*axis.x)<1e-8,'button and child centres are collinear');
  assert.ok(Math.abs(Math.hypot(first.x-button.x,first.y-button.y)-(button.width/2+12*scale+2))<1e-8,'exact button-to-child gap at every scale');
  const next=radialRowAttachment(anchor,first,50,scale,{axis,length});
  assert.ok(Math.abs(Math.hypot(next.x-anchor.x,next.y-anchor.y)-(length*scale/2+25*scale+2))<1e-8,'nested rows clear the parent row');
 }
});
