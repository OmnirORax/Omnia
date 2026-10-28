import test from "node:test";
import assert from "node:assert/strict";
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
