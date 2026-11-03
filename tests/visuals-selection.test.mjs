import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyDocument,
  ensureVariantPlacements,
  parseDocument,
  validateDocument,
  editorView,
} from "../src/graph/structural.ts";
import { deleteConceptSubtrees, deletionSummary } from "../src/graph/selection.ts";
import {
  createPlacement,
  compactLayout,
  siblingCollisions,
  DEFAULT_SPATIAL_SETTINGS as settings,
} from "../src/graph/layout3d.ts";
import { chartedBinders } from "../src/graph/presentation.ts";
import { defaultSettings, loadSettings, keyConflict } from "../src/workspaceActions.ts";
const entity = (id) => ({ id, label: id, aliases: [], notes: "" });
const image = {
  id: "icon",
  name: "AI icon",
  kind: "image",
  dataUrl: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0L24 24"/></svg>')}`,
};
function fixture() {
  let d = emptyDocument();
  d.entities = ["arm", "bone", "muscle", "variant", "outside", "unplaced"].map(entity);
  for (const id of ["arm", "outside"]) d = createPlacement(d, id, null, settings).next;
  const arm = d.placements.find((p) => p.entityId === "arm").id;
  d = createPlacement(d, "bone", arm, settings).next;
  d = createPlacement(d, "bone", null, settings).next;
  d.compositions = [
    { id: "a-b", parentId: "arm", childId: "bone" },
    { id: "b-m", parentId: "bone", childId: "muscle" },
  ];
  d.variants = [{ id: "v", ownerId: "arm", entityId: "variant" }];
  d.relationships = [
    {
      id: "external",
      typeId: "legacy-untyped",
      label: "signal",
      qualifierIds: [],
      participants: [
        { roleId: "source", entityId: "bone" },
        { roleId: "target", entityId: "outside" },
      ],
    },
  ];
  return { d: ensureVariantPlacements(d), arm };
}
test("global subtree deletion removes reused identities, unplaced structural contents and variants atomically", () => {
  const { d, arm } = fixture(),
    before = structuredClone(d);
  const summary = deletionSummary(d, [arm]);
  assert.deepEqual([...summary.entities].sort(), ["arm", "bone", "muscle", "variant"]);
  assert.equal(summary.otherReferences, 1);
  assert.equal(summary.crossLinks, 1);
  const next = deleteConceptSubtrees(d, [arm]);
  assert.deepEqual(
    next.entities.map((e) => e.id),
    ["outside", "unplaced"],
  );
  assert.ok(next.placements.every((p) => p.entityId === "outside"));
  assert.equal(next.relationships.length, 0);
  assert.equal(next.compositions.length, 0);
  assert.equal(next.variants.length, 0);
  assert.deepEqual(d, before, "the history snapshot retains everything for undo");
  assert.deepEqual(parseDocument(JSON.stringify(d)), parseDocument(JSON.stringify(before)));
});
test("shared assets and flexible node/binder visuals round trip without changing canonical meaning", () => {
  const { d } = fixture();
  d.assets = [image];
  d.placements[0].visual = { assetId: "icon", showText: false, size: 2 };
  d.compositions[0].visual = { assetId: "icon", showText: true };
  d.compositions[0].text = "is composed of";
  d.relationships[0].visual = { character: "⇆", size: 0.8 };
  const next = parseDocument(JSON.stringify(d));
  assert.deepEqual(next.entities, d.entities);
  assert.deepEqual(next.relationships, d.relationships);
  const binders = chartedBinders(next, editorView(next));
  assert.equal(binders.find((b) => b.id === "external").visual.character, "⇆");
  assert.equal(binders.find((b) => b.id === "a-b").label, "is composed of");
  assert.equal(next.assets.length, 1);
  assert.throws(() => validateDocument({ ...next, assets: [] }), /missing asset/);
});
test("invalid assets and visuals reject the entire document without mutating its original", () => {
  const { d } = fixture(),
    before = structuredClone(d);
  const bad = {
    ...image,
    dataUrl: `data:image/svg+xml;base64,${btoa("<svg><script>alert(1)</script></svg>")}`,
  };
  assert.throws(() => validateDocument({ ...d, assets: [bad] }), /self-contained/);
  assert.throws(
    () =>
      validateDocument({
        ...d,
        assets: [{ ...image, kind: "glb", dataUrl: "data:model/gltf-binary;base64,YWJj" }],
      }),
    /Invalid GLB/,
  );
  assert.throws(
    () =>
      validateDocument({
        ...d,
        assets: [image],
        placements: d.placements.map((p) => ({ ...p, visual: { assetId: "icon", size: -1 } })),
      }),
    /Invalid visual/,
  );
  assert.deepEqual(d, before);
});
test("compact text layout does not treat enormous empty subsystem envelopes as occupied volume", () => {
  let d = emptyDocument();
  d.entities = ["first", "second", "detail"].map(entity);
  const a = createPlacement(d, "first", null, settings);
  d = a.next;
  const b = createPlacement(d, "second", null, settings);
  d = b.next;
  d = createPlacement(d, "detail", a.placementId, settings, { x: 10000, y: 0, z: 0 }).next;
  d.placements[0].collapsed = false;
  const compact = compactLayout(d, { kind: "all" }, settings);
  assert.ok(
    compact.placements.every(
      (p) => Math.hypot(p.spatialPosition.x, p.spatialPosition.y, p.spatialPosition.z) < 30,
    ),
  );
  assert.equal(siblingCollisions(compact, settings).length, 0);
  assert.equal(
    d.placements.at(-1).spatialPosition.x,
    10000,
    "authored data changes only on explicit reflow",
  );
});
test("mouse history and selection defaults survive old settings, and rebinding detects conflicts", () => {
  const settings = defaultSettings();
  assert.equal(settings.mouse.backButton, "undo");
  assert.equal(settings.mouse.forwardButton, "redo");
  assert.equal(settings.mouse.selectionModifier, "ctrl");
  assert.equal(settings.mouse.nestModifier, "shift");
  assert.equal(settings.bindings.deleteSelected, "Delete");
  assert.equal(keyConflict(settings.bindings, "focus", "Ctrl+Z"), "undo");
  globalThis.localStorage = {
    getItem: () => JSON.stringify({ mouse: { subtreeModifier: "alt" }, bindings: { focus: "Q" } }),
  };
  const loaded = loadSettings();
  assert.equal(loaded.bindings.focus, "Q");
  assert.equal(loaded.mouse.subtreeModifier, "alt");
  assert.equal(loaded.mouse.selectionModifier, "ctrl");
  delete globalThis.localStorage;
});

test('temporary MS requests reject unsupported picks and restore selection exactly once',async()=>{
 const {selectionRequest}=await import('../src/appearance/selectionRequest.ts');
 let restores=0,cancels=0;
 const request=selectionRequest(value=>value==='supported',()=>cancels++,()=>restores++);
 assert.equal(request.accept('unsupported'),false);assert.equal(restores,0);
 assert.equal(request.accept('supported'),true);assert.equal(restores,1);
 request.cancel();assert.equal(request.accept('supported'),false);assert.equal(restores,1);assert.equal(cancels,0);
 const cancelled=selectionRequest(()=>true,()=>cancels++,()=>restores++);
 cancelled.cancel();cancelled.cancel();assert.equal(cancelled.accept('supported'),false);
 assert.equal(restores,2);assert.equal(cancels,1);
});

test('declared geometry boundaries retain identity through renderer replacement within their own surface',async()=>{
 const {boundaryFor,boundaryElement}=await import('../src/appearance/visualSelection.ts');
 const saved={document:globalThis.document,CSS:globalThis.CSS,getComputedStyle:globalThis.getComputedStyle};
 try{
  const scope={getAttribute:()=> 'composer-a'};
  const node=(attrs,connected=true)=>({isConnected:connected,hasAttribute:key=>key in attrs,getAttribute:key=>attrs[key]??null,closest:selector=>selector==='[data-selection-scope]'?scope:null,getClientRects:()=>[{}]});
  const previous=node({'data-selection-id':'component:unit'},false),replacement=node({'data-selection-id':'component:unit'});
  let queried='';globalThis.document={body:{},querySelectorAll:selector=>{queried=selector;return [replacement];}};
  globalThis.CSS={escape:value=>value};globalThis.getComputedStyle=()=>({visibility:'visible'});
  const boundary=boundaryFor(previous);
  assert.equal(boundary.key,'composer-a:data-selection-id:component:unit');
  assert.equal(boundaryFor(replacement).key,boundary.key);
  assert.equal(boundaryElement(boundary),replacement);
  assert.equal(queried,'[data-selection-scope="composer-a"] [data-selection-id="component:unit"]','another surface with the same component ID cannot steal the selection');
  const regular=node({'data-ui-function':'ordinary'});regular.closest=()=>null;
  assert.equal(boundaryFor(regular).key,'data-ui-function:ordinary','existing unscoped control identities stay unchanged');
 }finally{for(const [key,value] of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('selector Enter resumes the same aiming flow as the checkmark and owns reference confirmation before popup Enter',async()=>{
 const {selectionConfirmation,selectionRequest}=await import('../src/appearance/selectionRequest.ts');
 const {preferredFeatureKey}=await import('../src/workspaceActions.ts');
 const {createFeatureActionRuntime}=await import('../src/featureActions.ts');
 let phase='configure',restores=0,underlying=0,aims=0;
 const request=selectionRequest(value=>value==='target',()=>{},()=>restores++);
 const runtime=createFeatureActionRuntime();
 runtime.register('context.confirm',{enabled:()=>true,run:()=>underlying++});
 runtime.register('selector.confirm',{enabled:()=>!!selectionConfirmation(phase,restores===0,false),run:()=>{
  if(selectionConfirmation(phase,restores===0,false)==='aim'){phase='aim';aims++;}else request.accept('target');
 }});
 const enter=()=>{const id=preferredFeatureKey({},'Enter',id=>runtime.available(id));runtime.invoke(id);return id;};
 assert.equal(enter(),'selector.confirm');assert.equal(phase,'aim');assert.equal(aims,1);assert.equal(underlying,0);
 assert.equal(enter(),'selector.confirm');assert.equal(restores,1);assert.equal(underlying,0);
 assert.equal(enter(),'context.confirm');assert.equal(underlying,1,'ordinary popup Enter returns after request completes');
 assert.equal(selectionConfirmation('off',true,false),undefined);
 assert.equal(selectionConfirmation('aim',false,false),undefined);
 assert.equal(selectionConfirmation('locked',true,false),'accept');
 assert.equal(selectionConfirmation('aim',true,true),undefined,'polygon keeps its own Enter command');
 assert.equal(preferredFeatureKey({},'Enter',id=>['selector.finishGeometry','context.confirm'].includes(id)),'selector.finishGeometry');
 assert.equal(preferredFeatureKey({},'Enter',id=>['selector.confirm','context.confirm'].includes(id),true),null,'native text entry is preserved');
});

test('an old editor cannot cancel a newer MS request, and rejection text never accepts a pick',async()=>{
 const {cancelOwnedSelectionRequest,selectionRequest,selectionDecision}=await import('../src/appearance/selectionRequest.ts');
 const oldOwner=Symbol(),newOwner=Symbol(),events=[],pending={current:undefined};
 const old=selectionRequest(()=>true,()=>events.push('old cancel'),()=>events.push('old restore'));
 pending.current={owner:oldOwner,cancelMS:old.cancel,finish:()=>events.push('old finish')};
 assert.equal(cancelOwnedSelectionRequest(pending,oldOwner),true);
 const request=selectionRequest(value=>selectionDecision(value==='valid'?true:'No Rotation reference').accepted,()=>events.push('new cancel'),()=>events.push('new restore'));
 pending.current={owner:newOwner,cancelMS:request.cancel,finish:()=>events.push('new finish')};
 const current=pending.current;
 assert.equal(cancelOwnedSelectionRequest(pending,oldOwner),false,'stale unmount cleanup cannot stop the new cursor');
 assert.equal(pending.current,current);assert.deepEqual(events,['old restore','old cancel','old finish']);
 assert.deepEqual(selectionDecision('No Rotation reference'),{accepted:false,message:'No Rotation reference'});
 assert.equal(request.accept('unsupported'),false);assert.equal(events.includes('new restore'),false,'rejection leaves MS pending for another target');
 assert.equal(request.accept('valid'),true);assert.equal(events.filter(e=>e==='new restore').length,1);
 assert.deepEqual(selectionDecision(true),{accepted:true,message:null});
 assert.deepEqual(selectionDecision(false),{accepted:false,message:'Unsupported target'});
});

test('MS repeated entry configures, Escape returns to aiming, then cancels',async()=>{
 const {selectorOpenPhase,selectorEscapePhase}=await import('../src/appearance/selectionRange.ts');
 let phase='off';phase=selectorOpenPhase(phase);assert.equal(phase,'aim');
 phase=selectorOpenPhase(phase);assert.equal(phase,'configure');
 phase=selectorEscapePhase(phase);assert.equal(phase,'aim');
 phase=selectorEscapePhase(phase);assert.equal(phase,'off');
 assert.equal(selectorOpenPhase('locked'),'configure');
});
test('Shift range includes endpoints in either direction and handles missing anchors safely',async()=>{
 const {orderedSelectionRange}=await import('../src/appearance/selectionRange.ts');
 const items=['a','b','c','d','e'],key=item=>item;
 assert.deepEqual(orderedSelectionRange(items,'b','e',key),['b','c','d','e']);
 assert.deepEqual(orderedSelectionRange(items,'e','b',key),['b','c','d','e']);
 assert.deepEqual(orderedSelectionRange(items,'c','c',key),['c']);
 assert.deepEqual(orderedSelectionRange(items,'removed','d',key),['d']);
 assert.deepEqual(orderedSelectionRange(items,'a','removed',key),[]);
 assert.deepEqual(orderedSelectionRange(items.slice(2),'a','e',key),['e'],'another scope cannot drag an old anchor across unrelated content');
});

test('range can leave a pointed unit while retaining explicitly drawn working geometry',async()=>{
 const {rangeWorkingScope,selectorOpenPhase}=await import('../src/appearance/selectionRange.ts');
 const drawn={path:'authored geometry'},unit={ownerFrame:true,scope:drawn};
 assert.equal(rangeWorkingScope(unit),drawn);
 assert.equal(rangeWorkingScope({ownerFrame:true}),null,'a first unit does not constrain the next range to its own bounds');
 assert.equal(rangeWorkingScope(drawn),drawn);
 assert.equal(selectorOpenPhase('aim',true),'aim','a newly borrowed request starts picking, rather than interpreting its own opening as repeated Q');
});

test('spatial glyph range includes intervening objects by projected area rather than source order',async()=>{
 const {spatialSelectionRange}=await import('../src/appearance/selectionSurfaces.ts');
 const unit=(id,x,y)=>({id,box:{left:x-1,right:x+1,top:y-1,bottom:y+1}});
 const units=[unit('outside',30,0),unit('end',10,10),unit('between',5,5),unit('anchor',0,0),unit('below',5,20)];
 assert.deepEqual(spatialSelectionRange(units,'anchor','end'),['end','between','anchor']);
 assert.deepEqual(spatialSelectionRange(units,'end','anchor'),['end','between','anchor']);
 assert.deepEqual(spatialSelectionRange(units,'deleted','end'),['end']);
 assert.deepEqual(spatialSelectionRange([...units,unit('overlap',10,10)],undefined,'end'),['end'],'without an anchor only the endpoint is selected');
 assert.deepEqual(spatialSelectionRange(units,'anchor','missing'),[]);
});
test('MS surface adapters toggle exactly one target, retain anchors and isolate separate canvases',async()=>{
 const {createSelectionSurfaces}=await import('../src/appearance/selectionSurfaces.ts');
 const registry=createSelectionSurfaces(),first={contains:()=>false},second={};
 let selected=['a'],applied=[];
 const units=['a','b','c'].map((id,i)=>({id,box:{left:i*10-1,right:i*10+1,top:-1,bottom:1}}));
 const off=registry.register({element:()=>first,snapshot:()=>({units,selected,hit:p=>p.x===10?'b':'c'}),apply:ids=>{selected=[...ids];applied.push([...ids]);}});
 const toggle=registry.prepare(first,{x:10,y:0},'toggle');
 assert.deepEqual(toggle.before,['a']);assert.deepEqual(toggle.after,['a','b']);
 registry.apply(toggle.id,toggle.after);assert.deepEqual(selected,['a','b']);
 const range=registry.prepare(first,{x:20,y:0},'range');
 assert.deepEqual(range.after,['a','b','c']);
 registry.apply(range.id,range.after);registry.apply(range.id,toggle.before);assert.deepEqual(selected,['a'],'the existing MS timeline can apply before/after snapshots for undo');
 assert.equal(registry.prepare(second,{x:10,y:0},'toggle'),undefined);
 registry.apply(range.id,['a','removed']);assert.deepEqual(selected,['a'],'stale ids are filtered before native setters');
 off();assert.equal(registry.prepare(first,{x:10,y:0},'toggle'),undefined);
});

test('surface selection replay cannot affect a different atlas context',async()=>{
 const {createSelectionSurfaces}=await import('../src/appearance/selectionSurfaces.ts');
 const registry=createSelectionSurfaces(),element={contains:()=>false};let context='atlas-a',applies=0;
 registry.register({element:()=>element,context:()=>context,snapshot:()=>({units:[{id:'same-id',box:{left:0,top:0,right:2,bottom:2}}],selected:[],hit:()=> 'same-id'}),apply:()=>applies++});
 const transaction=registry.prepare(element,{x:1,y:1},'toggle');
 context='atlas-b';registry.apply(transaction.id,transaction.after);assert.equal(applies,0);
 context='atlas-a';registry.apply(transaction.id,transaction.after);assert.equal(applies,1);
});

test('native Ctrl/Shift selection claims registered surfaces before ordinary target editing',async()=>{
 const {selectionPointerMode,createSelectionSurfaces}=await import('../src/appearance/selectionSurfaces.ts');
 const event={button:0,ctrlKey:false,shiftKey:false,metaKey:false,altKey:false};
 assert.equal(selectionPointerMode(event),undefined);
 assert.equal(selectionPointerMode({...event,ctrlKey:true}),'toggle');
 assert.equal(selectionPointerMode({...event,metaKey:true}),'toggle');
 assert.equal(selectionPointerMode({...event,shiftKey:true}),'range');
 assert.equal(selectionPointerMode({...event,ctrlKey:true,shiftKey:true}),'range');
 assert.equal(selectionPointerMode({...event,ctrlKey:true,altKey:true}),undefined);
 assert.equal(selectionPointerMode({...event,ctrlKey:true,button:2}),undefined);
 const registry=createSelectionSurfaces(),root={contains:node=>node===child},child={},unrelated={};
 let selected=['a'];
 const units=['a','b','c'].map((id,i)=>({id,box:{left:i*10-1,right:i*10+1,top:-1,bottom:1}}));
 registry.register({element:()=>root,snapshot:()=>({units,selected,hit:p=>units.find(unit=>Math.abs((unit.box.left+1)-p.x)<2)?.id}),apply:ids=>{selected=[...ids];}});
 const click=registry.beginPointer(child,{x:10,y:0},selectionPointerMode({...event,ctrlKey:true}));
 assert.equal(typeof click,'function','descendant targets are claimed without opening MS first');
 assert.deepEqual(selected,['a'],'pointer down only owns the gesture; no single-target replacement');
 const added=click({x:10,y:0});assert.deepEqual(added.after,['a','b']);registry.apply(added.id,added.after);
 const removed=registry.beginPointer(child,{x:10,y:0},'toggle')({x:10,y:0});
 assert.deepEqual(removed.after,['a'],'Ctrl-click toggles only its target');registry.apply(removed.id,removed.after);
 const range=registry.beginPointer(child,{x:20,y:0},'range')({x:20,y:0});
 assert.deepEqual(range.after,['a','b','c'],'Shift-click adds the spatial objects between the anchor and endpoint');
 const miss=registry.beginPointer(child,{x:100,y:0},'toggle');assert.equal(miss({x:100,y:0}),undefined,'blank modified clicks do not clear selection');
 assert.equal(registry.beginPointer(unrelated,{x:10,y:0},'toggle'),undefined,'other controls retain native handling');
});
test('modified pointer drags add a bounded marquee and cancel on surface/context replacement',async()=>{
 const {createSelectionSurfaces}=await import('../src/appearance/selectionSurfaces.ts');
 const registry=createSelectionSurfaces(),root={};let context='first',selected=['keep'];
 const units=[{id:'keep',box:{left:50,right:51,top:50,bottom:51}},{id:'inside',box:{left:2,right:3,top:2,bottom:3}},{id:'outside',box:{left:20,right:21,top:20,bottom:21}}];
 const off=registry.register({element:()=>root,context:()=>context,snapshot:()=>({units,selected,hit:()=>undefined}),apply:()=>{}});
 const drag=registry.beginPointer(root,{x:0,y:0},'toggle');
 assert.deepEqual(drag({x:10,y:10}).after,['keep','inside'],'Ctrl marquee adds instead of replacing prior selection');
 const canceled=registry.beginPointer(root,{x:0,y:0},'range');context='second';assert.equal(canceled({x:10,y:10}),undefined);
 const removed=registry.beginPointer(root,{x:0,y:0},'toggle');off();assert.equal(removed({x:10,y:10}),undefined);
});
test('registered selection gestures run owner cleanup once and use precise renderer marquee hits',async()=>{
 const {createSelectionSurfaces}=await import('../src/appearance/selectionSurfaces.ts');
 const registry=createSelectionSurfaces(),root={};let starts=0;
 registry.register({element:()=>root,onStart:()=>starts++,snapshot:()=>({selected:['keep'],units:[{id:'bounding-box-only',box:{left:0,right:10,top:0,bottom:10}}],hit:()=>undefined,area:()=>['actual-ink']}),apply:()=>assert.fail('preparing must not commit')});
 const finish=registry.beginPointer(root,{x:0,y:0},'toggle');
 assert.equal(starts,1);assert.deepEqual(finish({x:10,y:10}).after,['keep','actual-ink']);assert.equal(starts,1);
});

test('surface completion notifications are optional and separate from membership/history',async()=>{
 const {createSelectionSurfaces}=await import('../src/appearance/selectionSurfaces.ts');
 const registry=createSelectionSurfaces(),root={},events=[];let selected=['a'],context='atlas-a';
 const units=['a','b','c'].map((id,i)=>({id,box:{left:i*10,right:i*10+2,top:0,bottom:2}}));
 const off=registry.register({element:()=>root,context:()=>context,snapshot:()=>({units,selected,hit:p=>units.find(unit=>p.x>=unit.box.left&&p.x<=unit.box.right)?.id}),apply:ids=>{selected=[...ids];events.push(['selection',...ids]);},onComplete:(ids,point)=>events.push(['complete',...ids,point.x])});
 const finish=registry.beginPointer(root,{x:11,y:1},'toggle');
 assert.deepEqual(events,[],'press alone does not open an editor or select a single target');
 const transaction=finish({x:11,y:1});registry.apply(transaction.id,transaction.after);registry.complete(transaction.id,transaction.after,{x:11,y:1});
 assert.deepEqual(events,[['selection','a','b'],['complete','a','b',11]],'optional observers receive the accepted full set and release point');
 registry.apply(transaction.id,transaction.before);
 assert.deepEqual(events.at(-1),['selection','a'],'history replay restores membership without emitting completion');
 const range=registry.beginPointer(root,{x:21,y:1},'range')({x:21,y:1});registry.apply(range.id,range.after);registry.complete(range.id,range.after,{x:21,y:1});
 assert.deepEqual(events.at(-1),['complete','a','b','c',21],'observation does not prevent another modifier selection');
 const count=events.length;context='atlas-b';registry.complete(range.id,range.after,{x:21,y:1});assert.equal(events.length,count,'old contexts cannot notify another atlas');
 off();registry.complete(range.id,range.after,{x:21,y:1});assert.equal(events.length,count,'removed owners cannot receive stale completion');
});

test('native selection resolves the physical event path and survives replacement of SVG descendants',async()=>{
 const {createSelectionSurfaces}=await import('../src/appearance/selectionSurfaces.ts');
 const registry=createSelectionSurfaces(),pressed={},replacement={},root={contains:node=>node===replacement};let currentRoot=root,selected=['first'];
 const units=['first','second'].map((id,i)=>({id,box:{left:i*10,right:i*10+2,top:0,bottom:2}}));
 registry.register({element:()=>currentRoot,snapshot:()=>({units,selected,hit:()=> 'second'}),apply:ids=>{selected=[...ids];}});
 assert.equal(registry.beginPointer(pressed,{x:11,y:1},'toggle'),undefined,'detached target containment alone loses the gesture');
 const finish=registry.beginPointer(pressed,{x:11,y:1},'toggle',[pressed,root]);assert.equal(typeof finish,'function','the original physical path retains its declared surface');
 const transaction=finish({x:11,y:1});assert.deepEqual(transaction.after,['first','second']);registry.apply(transaction.id,transaction.after);assert.deepEqual(selected,['first','second']);
 const canceled=registry.beginPointer(replacement,{x:11,y:1},'toggle',[replacement,root]);currentRoot={contains:()=>true};assert.equal(canceled({x:11,y:1}),undefined,'replacing the actual surface cancels instead of retargeting a new owner');
});
