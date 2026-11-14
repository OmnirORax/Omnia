import {resolveNodeAppearance,nodePaint} from './core/appearance.ts';
import {brightHex} from './composer/runtime/appearance/resolve.ts';
import {arrangeExpansions,labelSize} from './composer/runtime/graph/labels.ts';
import {visualFootprint} from './composer/runtime/graph/assets.ts';
import type {TextScene} from './world/v1/types.ts';
import {universalHistory} from './core/universalHistory.ts';
import {createNudgeGesture} from './navigation/nudgeGesture.ts';
import type {NudgeActionId} from './composer/runtime/workspaceActions.ts';
import {createNavigationGesture} from './navigation/gesture.ts';
import {NAV_DEFAULTS} from './navigation/options.ts';
import {rebindOrbitControls} from './navigation/orbit.ts';
import {DEFAULT_CAMERA_POSITION,DEFAULT_CAMERA_FOV} from './cameraGuideState.ts';
import {cameraHUD,type CameraAction} from './world/cameraHUD.ts';
import {frontOnPose} from './navigation/model.ts';
import {guardCameraPointer} from './cameraPointer.ts';
import {prepareLatticeTransform} from './graph/lattice.ts';
import type {Rotation} from './navigation/transforms.ts';
import { createSecondaryRelease } from './composer/runtime/ui/secondaryRelease.ts';
import {glyphSurfacePoint,type OmnicSurface} from './omnic/surface.ts';
import {createGlyphPresentation} from './omnic/presentation.ts';
import {RENDER_BUDGET} from './renderBudget.ts';
import * as T from 'three';
import {pointerPlane} from './navigation/pointerPlane.ts';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { prepareWorld, sameOrigin, type Origin, type Structure, type Vec3, type World } from './core/model.ts';
import { geometry, lattice, inherited, prepareTranslation, address as key, point, vector } from './core/lattice.ts';
import { cellAt, cellPoint } from './graph/lattice.ts';
import { atomicCarrierGeometry, atomicCarrierMaterial, updateAtomicCarrier } from './atomicCarrier.ts';
import { analyticSelectionRing } from './materialCoverage.ts';
import { SPHERE_VISUAL_DEFAULTS as defaults } from './properties/sphereVisualDefaults.ts';
import { createWorldNavigator } from './navigation/worldNavigator.ts';
import { createNavigatorDrive } from './navigation/navigatorDrive.ts';
import { expansionState, toggleContent, contentExpanded } from './graph/nodePresentation.ts';
import { latticeFrame } from './latticeField.ts';
import { visualObject, disposeVisual } from './visualScene.ts';
import { paintSamples } from './omnic/paintStroke.ts';
import { createPipeline } from './world/render.ts';
import { label, disposeLabel } from './world/labels.ts';
import { createSceneSession } from './scene/session.ts';
import type { Document } from './graph/geometryTypes.ts';
import { TEXT_DEFAULTS } from './properties/visual.ts';
import { branch } from './core/nodeOperations.ts';

export type Edge = { kind: 'part'; owner: Origin; index: number } | { kind: 'relationship'; index: number } | { kind: 'variant'; owner: Origin };
type Point = { x: number; y: number };
type Input = { pick: (origin: Origin, extend: boolean, toggle: boolean) => void;
  range: (origins: Origin[], extend: boolean) => void; clear: () => void;
  menu: (origin: Origin | undefined, point: Point, position: Vec3, edge?: Edge) => void;
  move: (origins: readonly Origin[], delta: Vec3) => void;
  adopt: (origins: readonly Origin[], owner: Origin, delta: Vec3) => void;
  park: (origin: Origin, position: Vec3) => World;
  paint: (positions: Vec3[], source?: Origin) => void;
  subtree: (origin: Origin) => void;
  expand: (origin: Origin) => void; edge: (edge: Edge) => void;
  transform: (origins:readonly Origin[],rotation:Rotation,pivot: {x:number;y:number;z:number},layout:boolean)=>void;
  navigationSettings:()=>void;
  feedback: (message: string) => void; picking: () => boolean };
type Visual = { node: Structure; actual: Structure; anchor: T.Vector3; group: T.Group; presentation:T.Group;
  body: T.Mesh<T.SphereGeometry, T.MeshPhongMaterial>; slot: T.Mesh; ring: T.Mesh; text: ReturnType<typeof label>; caption: string; textKey?:string; object?: T.Group; visualKey?: string };
const xyz = (v: T.Vector3): Vec3 => [v.x, v.y, v.z];

export function createWorld(host: HTMLElement, input: Input) {
  const renderer = new T.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true }); renderer.setClearColor('#101927');
  const canvas = renderer.domElement; canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Omnium lattice world');canvas.setAttribute('data-context-menu-owner',''); host.append(canvas);
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(DEFAULT_CAMERA_FOV, 1, .05, 100000);
  camera.position.copy(DEFAULT_CAMERA_POSITION);camera.near=.001;
  let controls = new OrbitControls(camera, canvas); controls.enableDamping = false; controls.minDistance = .2; controls.maxDistance = 100000;
  controls.mouseButtons = { LEFT: T.MOUSE.PAN, MIDDLE: T.MOUSE.DOLLY, RIGHT: null! }; controls.update();
  scene.add(new T.AmbientLight('#ffffff',2.1));
  const light = new T.DirectionalLight('#ffffff', 2.2); light.position.set(5, 12, 9); scene.add(light);
  const sphere = atomicCarrierGeometry(), slotMaterial = new T.MeshBasicMaterial({ visible: false });
  const ringGeometry = new T.RingGeometry(.835, 1.125, 64), ringMaterial = new T.MeshBasicMaterial({ color: '#ffb000',opacity:.75, transparent: true, side: T.DoubleSide, depthWrite: false, depthTest: false }); analyticSelectionRing(ringMaterial);
  const visuals = new Map<string, Visual>(), ray = new T.Raycaster(), edges = new T.Group(); scene.add(edges);
  const retained = expansionState(), variants = new Set<string>(), navigator = createWorldNavigator();
  const rectangle = document.createElement('div'); rectangle.className = 'marquee'; rectangle.hidden = true; host.append(rectangle);
  let world: World, doc: Document, prepared: ReturnType<typeof prepareWorld>, grid: ReturnType<typeof lattice>;
  let selectedKeys=new Set<string>();
  let selected: readonly Origin[] = [], selectedEdges: readonly Edge[] = [], filter: ReadonlySet<string> | undefined;
  let scale = 1, frame = 0, inputFrame = 0, hover: string | undefined, lastPoint: Point | undefined, picks: T.Object3D[] = [];
  let mountedWorld: World | undefined,omnic:OmnicSurface|undefined,omnicGesture:{surface:OmnicSurface;id:number;bounds:OmnicSurface['bounds']}|undefined;
  const omnicPoint=new T.Vector3(),omnicCenter=new T.Vector3(),omnicQuaternion=new T.Quaternion(),omnicScale=new T.Vector3();
  function editPoint(event:PointerEvent|MouseEvent,surface:OmnicSurface,inside=false){
    const origin=surface.origin,visual=origin&&visuals.get(key(origin));if(!visual?.group.visible||!visual.object?.visible)return;
    pointer({x:event.clientX,y:event.clientY});visual.object.getWorldPosition(omnicCenter);visual.object.getWorldQuaternion(omnicQuaternion);visual.object.getWorldScale(omnicScale);
    if(!ray.ray.intersectPlane(new T.Plane().setFromNormalAndCoplanarPoint(new T.Vector3(0,0,1).applyQuaternion(omnicQuaternion),omnicCenter),omnicPoint))return;
    omnicPoint.sub(omnicCenter).applyQuaternion(omnicQuaternion.invert()).divide(omnicScale);if(inside&&(Math.abs(omnicPoint.x)>.5||Math.abs(omnicPoint.y)>.5))return;const bounds=omnicGesture?.bounds??surface.bounds,point=glyphSurfacePoint(bounds,omnicPoint),depth=omnicCenter.clone().applyMatrix4(camera.matrixWorldInverse).z;return {...point,scenePerPixel:Math.abs(2*depth*Math.tan(camera.fov*Math.PI/360)/canvas.clientHeight/omnicScale.y)*Math.max(bounds.width,bounds.height)};
  }
  function cancelOmnic(){if(!omnicGesture)return false;const surface=omnicGesture.surface;omnicGesture=undefined;surface.cancel();controls.enabled=!drive.active;request();return true;}
  let glyphs:ReturnType<typeof createGlyphPresentation>,glyphFrame=0;
  function glyph(visual:Visual,now=0){
    const editing=omnic?.origin&&sameOrigin(omnic.origin,visual.node.origin)?omnic.preview:undefined,result=glyphs?.(visual.actual,now/1000,editing);if(!result){if(visual.object?.userData.omnic){visual.presentation.remove(visual.object);disposeVisual(visual.object);visual.object=undefined;}return false;}
    if(visual.object?.userData.glyphKey!==result.key){
      if(visual.object){visual.presentation.remove(visual.object);disposeVisual(visual.object);}
      visual.object=visualObject({...visual.actual.visual,assetId:result.asset.id,character:undefined},[result.asset],text=>label(text),request,{},RENDER_BUDGET.omnicTextureEdge);
      visual.object.userData.glyphKey=result.key;visual.object.userData.omnic=true;visual.object.userData.motion=result.motion;visual.object.userData.origin=visual.node.origin;visual.object.scale.setScalar(visual.actual.visual?.size??1.4);visual.presentation.add(visual.object);
    }
    visual.object.quaternion.identity();return result.motion;
  }
  const drive = createNavigatorDrive({ hosts: () => visuals,
    commit(id, position) { const result = input.park(visuals.get(id)!.node.origin, vector({x:position.x / scale,y:position.y / scale,z:position.z / scale})); return geometry(result); },
  });
  const effectNodes:TextScene['nodes']=new Map(),effectConnectors:TextScene['connectors']=[];
  const effectSource:TextScene={nodes:effectNodes,connectors:effectConnectors,animateSelection(camera,seconds,animate){
    const pulse=animate?(Math.sin(seconds*Math.PI*1.5)+1)/2:.5;
    for(const item of effectNodes.values())if(item.outline.visible){item.outline.quaternion.copy(item.group.quaternion).invert().multiply(camera.quaternion);item.outline.scale.setScalar(scale*.8*(item.selected?1+pulse*.1:1));item.outline.material.opacity=item.opacity*(item.selected?.45+pulse*.4:.45);}
  }};
  const pipeline = createPipeline(renderer, scene, camera, request,()=>effectSource), session = createSceneSession(pipeline.wallpaper, input.feedback);
  let fontRevision=0,layoutKey='';
  document.fonts.addEventListener('loadingdone',()=>{fontRevision++;if(world)update(world,selected,filter,selectedEdges);});
  function arrangePresentations(){
    const width=canvas.clientWidth,height=canvas.clientHeight;
    if(!width||!height)return;
    const open=[...visuals].filter(([,v])=>v.group.visible&&(v.text.visible||v.object?.visible));
    const signature=JSON.stringify([width,height,camera.position.toArray(),camera.quaternion.toArray(),...open.map(([id,v])=>[id,v.group.position.toArray(),v.group.quaternion.toArray(),v.caption,v.text.visible,v.object?.visible,v.actual.visual?.size])]);
    if(signature===layoutKey)return;layoutKey=signature;
    const units=(anchor:T.Vector3)=>Math.max(.00001,-anchor.clone().applyMatrix4(camera.matrixWorldInverse).z)*2*Math.tan(T.MathUtils.degToRad(camera.fov/2))/height;
    const rects=open.flatMap(([id,v])=>{
      v.presentation.position.set(0,0,0);const p=v.group.position.clone().project(camera);if(p.z < -1||p.z>1)return [];
      const size=v.text.visible?labelSize(v.caption):{width:0,height:0};
      const box=visualFootprint(size,v.object?.visible?{character:'visual',size:v.actual.visual?.size??1.4,showText:v.text.visible}:undefined,1);
      const unit=units(v.group.position);return [{id,x:(p.x+1)*width/2,y:(1-p.y)*height/2,width:box.width/unit,height:box.height/unit}];
    });
    const positions=arrangeExpansions(rects,width,height),right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion);
    for(const rect of rects){const v=visuals.get(rect.id)!,p=positions.get(rect.id)!,unit=units(v.group.position);v.presentation.position.copy(right).multiplyScalar((p.x-rect.x)*unit).addScaledVector(up,(rect.y-p.y)*unit).applyQuaternion(v.group.quaternion.clone().invert());}
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function request() {
    if (frame) return;
    frame = requestAnimationFrame(now => {
      frame = 0;

      for (const visual of visuals.values()) { visual.ring.quaternion.copy(visual.group.quaternion).invert().multiply(camera.quaternion);visual.presentation.quaternion.copy(visual.group.quaternion).invert().multiply(camera.quaternion); }
      for (const child of edges.children) if (child instanceof T.Mesh && child.userData.isLabel && child.userData.ends) {
        const [a,b] = child.userData.ends as T.Vector3[], p = a.clone().project(camera), q = b.clone().project(camera);
        let angle = Math.atan2((q.x - p.x) * camera.aspect, q.y - p.y); const reversed = angle > Math.PI / 2 || angle < -Math.PI / 2;
        if (reversed) angle += angle > 0 ? -Math.PI : Math.PI; child.quaternion.copy(camera.quaternion).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),angle));
      }
      camera.updateMatrixWorld();arrangePresentations();
      navigator.orientation.copy(camera.quaternion);
      let animated=false;if(omnic?.origin){const visual=visuals.get(key(omnic.origin));if(visual?.group.visible&&visual.object?.visible)glyph(visual,now);}
      if(now-glyphFrame>=1000/RENDER_BUDGET.omnicFps){glyphFrame=now;let sources=0;for(const visual of visuals.values())if(visual.group.visible&&(visual.object?.visible||selectedKeys.has(key(visual.node.origin)))){if(visual.object?.userData.omnic&&sources++>=RENDER_BUDGET.omnicSceneSources)continue;animated= glyph(visual,now)||animated;}}
      for(const visual of visuals.values())if(visual.object?.userData.omnic&&visual.object.visible)visual.object.quaternion.identity();
      hud.update(camera,controls.target,selected[0]?visuals.get(key(selected[0]))?.group.position:undefined);
      edges.visible=!navigation.active&&!(gesture?.dragged&&gesture.mode==='move');
      pipeline.render();
      if((animated||[...visuals.values()].some(v=>v.group.visible&&v.object?.visible&&v.object.userData.motion))&&!document.hidden)request();
      if (selected.length && !reduced.matches && !document.hidden) request();
    });
  }
  const resize = new ResizeObserver(() => { const box = host.getBoundingClientRect(); pipeline.resize(box.width, box.height); camera.aspect = box.width / Math.max(1, box.height); camera.updateProjectionMatrix(); request(); }); resize.observe(host);
  controls.addEventListener('change', () => { navigator.orientation.copy(camera.quaternion); request(); });
  function pointer(p: Point) { const r = canvas.getBoundingClientRect(); ray.setFromCamera(new T.Vector2((p.x-r.left)/r.width*2-1, -(p.y-r.top)/r.height*2+1), camera); }
  function pointed(p: Point, exclude?: ReadonlySet<string>): { origin?: Origin; edge?: Edge } {
    pointer(p); ray.params.Line!.threshold = scale * .15;
    for (const hit of ray.intersectObjects(picks, true)) {
      let owner: T.Object3D | null = hit.object;
      while (owner && !owner.userData.origin && !owner.userData.edge) owner = owner.parent;
      if (owner?.userData.origin) { if (exclude?.has(key(owner.userData.origin))) continue; return { origin: owner.userData.origin }; }
      if (owner?.userData.edge && !exclude) return { edge: owner.userData.edge };
    }
    return {};
  }
  function at(p: Point, anchor = controls.target) {
    pointer(p); const result = ray.ray.intersectPlane(new T.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new T.Vector3()), anchor), new T.Vector3()); return result ?? anchor.clone();
  }
  function creationPoint(p: Point) {
    pointer(p); const orientation = latticeFrame(camera.quaternion), normal = new T.Vector3(0,0,1).applyQuaternion(orientation);
    const hit = ray.ray.intersectPlane(new T.Plane().setFromNormalAndCoplanarPoint(normal, controls.target), new T.Vector3());
    return xyz((hit ?? controls.target).clone().divideScalar(scale));
  }
  function rebuildPicks() {
    picks = [];
    for (const [id, visual] of visuals) if (visual.group.visible && !drive.owns(id)) { picks.push(visual.slot); if (visual.text.visible) picks.push(visual.text); if (visual.object?.visible) picks.push(visual.object); }
    for (const child of edges.children) if (child.userData.edge) picks.push(child);
  }
  function presentation() {
    let sources=0;const hovered=hover&&visuals.get(hover);if(hovered)glyph(hovered,performance.now());
    for (const [id, visual] of visuals) {
      const chosen = selectedKeys.has(id);
      const expanded = chosen || contentExpanded(retained, id, false);
      visual.body.visible = !expanded; visual.ring.visible = chosen;
      visual.text.visible = !!visual.caption.trim() && (expanded || hover === id || world.settings?.names === 'all') && visual.actual.visual?.showText !== false;
      if (world.settings?.names === 'selection' && !chosen && !expanded) visual.text.visible = false;
      if((expanded||hover===id)&&(!visual.actual.omnic&&!visual.actual.omnicDraft&&!visual.actual.visual?.omnicEntityId||sources++<RENDER_BUDGET.omnicSceneSources))glyph(visual,performance.now());
      if (visual.object) visual.object.visible = expanded || hover === id;
      if(!expanded&&hover!==id&&visual.object?.userData.omnic){visual.presentation.remove(visual.object);disposeVisual(visual.object);visual.object=undefined;}
      visual.text.position.y = visual.object ? -((visual.actual.visual?.size ?? 1.4) + .3) / 2 : 0;
      if(visual.object)visual.object.position.y=(visual.text.scale.y+.3)/2;
    }
    rebuildPicks(); request();
  }
  function clearEdges() {
    effectConnectors.length=0;
    for (const child of [...edges.children]) {
      if (child instanceof T.Mesh && child.userData.isLabel) disposeLabel(child as ReturnType<typeof label>); else { const item = child as T.Line; item.geometry?.dispose(); for (const m of Array.isArray(item.material) ? item.material : [item.material]) m.dispose(); }
      edges.remove(child);
    }
  }
  function connection(source: Structure, target: Structure, text: string, edge: Edge) {
    const aVisual = visuals.get(key(source.origin)), bVisual = visuals.get(key(target.origin));
    if (!aVisual?.group.visible || !bVisual?.group.visible) return;
    const active = selectedEdges.some(value => JSON.stringify(value) === JSON.stringify(edge));
    if (!active && !selected.some(origin => sameOrigin(origin, target.origin)) && !retained.open.has(key(target.origin))) return;
    const a = aVisual.group.position.clone(), b = bVisual.group.position.clone(), direction = b.clone().sub(a), length = direction.length(); if (length < 1e-10) return;
    direction.normalize(); const padding = Math.min(scale * .35, length * .2); a.addScaledVector(direction,padding); b.addScaledVector(direction,-padding);
    const material = new T.LineBasicMaterial({ color: active ? '#ffcb66' : '#929c87', linewidth: active ? 2 : 1 });
    const line = new T.Line(new T.BufferGeometry().setFromPoints([a,b]), material); line.userData.edge = edge; edges.add(line);
    const side = direction.clone().cross(camera.position.clone().sub(b)).normalize().multiplyScalar(scale*.12), back = b.clone().addScaledVector(direction,-scale*.25);
    const arrow = new T.Line(new T.BufferGeometry().setFromPoints([back.clone().add(side),b,back.clone().sub(side)]), material.clone()); arrow.userData.edge = edge; edges.add(arrow);
    let edgeLabel:ReturnType<typeof label>|undefined;
    if (text) { const caption = label(text,world.appearance?.text);edgeLabel=caption; caption.userData.requestRender=request;caption.scale.multiplyScalar(.65); caption.position.copy(a.clone().add(b).multiplyScalar(.5)); caption.userData.edge = edge; caption.userData.ends=[a,b]; edges.add(caption); }
    effectConnectors.push({data:{key:JSON.stringify(edge)},line,path:new T.LineCurve3(a,b),arrow,label:edgeLabel,textOpacity:edgeLabel?.material.opacity??1});
  }
  function connections() {
    clearEdges();
    for (const owner of world.nodes) owner.parts.forEach((binding,index) => { for (const target of prepared.resolve(binding)) connection(owner,target, 'includes', {kind:'part',owner:owner.origin,index}); });
    for (const node of world.nodes) if (node.variantOf) { const base = world.nodes.find(candidate => sameOrigin(candidate.origin,node.variantOf!)); if (base) connection(base,node,'variant',{kind:'variant',owner:node.origin}); }
    (world.relationships ?? []).forEach((relation,index) => { for (const a of prepared.resolve(relation.from)) for (const b of prepared.resolve(relation.to)) connection(a,b,relation.label || relation.kind,{kind:'relationship',index}); });
  }
  function visibility(node: Structure) {
    if (node.hidden || filter && !filter.has(key(node.origin))) return false;
    if (node.variantOf && !variants.has(key(node.variantOf))) return false;
    let parent = node.parent && visuals.get(key(node.parent))?.node, depth = 0;
    while (parent && depth++ < 500) { if (parent.hidden || parent.collapsed && !node.variantOf) return false; parent = parent.parent && visuals.get(key(parent.parent))?.node; }
    return true;
  }
  function update(next: World, selection: readonly Origin[], visible?: ReadonlySet<string>, edgeSelection: readonly Edge[] = []) {
    if(world&&next!==world){navigation.finish(true);nudging.finish(true);if(gesture)restore();}
    if (drive.active && (next !== mountedWorld || !selection.some(origin => key(origin) === drive.id))) cancelDrive();
    if (world !== next) { cancelOmnic();const sources=createGlyphPresentation(next,true);if(sources!==glyphs)for(const visual of visuals.values())if(visual.object?.userData.omnic)visual.object.userData.glyphKey=undefined;glyphs=sources; prepared = prepareWorld(next); doc = geometry(next); grid = lattice(next); }
    world = next; selected = selection;selectedKeys=new Set(selection.map(key)); selectedEdges = edgeSelection; filter = visible;
    const nextScale = next.settings?.latticeScale ?? 1;
    if (nextScale !== scale) { const shift = controls.target.clone().multiplyScalar(nextScale/scale-1); controls.target.add(shift); camera.position.add(shift); navigator.rescale(nextScale/scale); scale=nextScale; controls.minDistance=Math.min(.2,scale/4); camera.near=Math.max(1e-9,scale*.001); camera.updateProjectionMatrix(); controls.update(); }
    const present = new Set(next.nodes.map(node => key(node.origin)));
    for (const [id, visual] of visuals) if (!present.has(id)) { scene.remove(visual.group); visual.body.material.dispose();(visual.ring.material as T.Material).dispose(); disposeLabel(visual.text); if (visual.object) disposeVisual(visual.object); visuals.delete(id);effectNodes.delete(id); }
    for (const node of next.nodes) {
      const actual = resolveNodeAppearance(next,inherited(node,next)), id=key(node.origin), textPaint={...TEXT_DEFAULTS,...next.appearance?.text,...actual.textAppearance},textKey=JSON.stringify([textPaint,fontRevision]), caption=`${actual.label || (node.invariant ? '⚬' : '')}${node.parts.some(binding => !prepared.resolve(binding).length) ? ' !' : ''}`;
      let visual=visuals.get(id);
      if (!visual) {
        const group=new T.Group(),presentation=new T.Group(),body=new T.Mesh(sphere,atomicCarrierMaterial(actual.color)),slot=new T.Mesh(sphere,slotMaterial),ring=new T.Mesh(ringGeometry,ringMaterial.clone()),text=label(caption,textPaint);text.userData.requestRender=request;
        ring.renderOrder=20; presentation.add(text);group.add(body,slot,ring,presentation);scene.add(group);visual={node,actual,anchor:group.position,group,presentation,body,slot,ring,text,caption,textKey};visuals.set(id,visual);
        const item=visual;effectNodes.set(id,{group:item.group,presentation:item.presentation,cell:item.body,outline:item.ring as T.Mesh<T.RingGeometry,T.MeshBasicMaterial>,get text(){return item.text;},get visual(){return item.object;},get selected(){return selectedKeys.has(id);},get color(){return item.actual.color;},get opacity(){return item.actual.opacity??1;}});
      }
      if (visual.caption!==caption || visual.textKey!==textKey) { visual.presentation.remove(visual.text);disposeLabel(visual.text);visual.text=label(caption,textPaint);visual.text.userData.requestRender=request;visual.presentation.add(visual.text);visual.caption=caption; }
      visual.textKey=textKey;
      const visualKey=JSON.stringify([actual.visual ?? null,actual.visual?.character?textPaint:null]);
      if (visual.visualKey!==visualKey) {
        if (visual.object) {visual.presentation.remove(visual.object);disposeVisual(visual.object);visual.object=undefined;}
        if (actual.visual?.assetId || actual.visual?.character) {visual.object=visualObject(actual.visual,next.assets??[],text=>{const sprite=label(text,textPaint);sprite.userData.requestRender=request;return sprite;},request);visual.object.scale.setScalar(actual.visual.size??1.4);visual.object.userData.origin=node.origin;visual.presentation.add(visual.object);}
        visual.visualKey=visualKey;
      }
      visual.node=node;visual.actual=actual;visual.group.quaternion.set(node.orientation?.x??0,node.orientation?.y??0,node.orientation?.z??0,node.orientation?.w??1);visual.group.position.copy(new T.Vector3(...vector(cellPoint(grid.cells.get(id)!,scale))));
      visual.body.scale.setScalar(scale);visual.slot.scale.setScalar(scale);visual.body.material.color.set(actual.color);(visual.ring.material as T.MeshBasicMaterial).color.set(actual.color);
      updateAtomicCarrier(visual.body.material,actual.opacity??defaults.opacity,actual.translucency??defaults.translucency,actual.glow??defaults.glow,actual.translucencyRadius??defaults.translucencyRadius);
      visual.body.userData.glowIntensity=actual.glow??defaults.glow;visual.group.userData.origin=node.origin;visual.slot.userData.origin=node.origin;visual.text.userData.origin=node.origin;
      visual.group.visible=true;
    }
    for (const visual of visuals.values()) visual.group.visible=visibility(visual.node);
    connections();presentation();session.update(next,selection[0]);drive.refresh();
  }
  const navigatorOffset = new T.Vector3();
  function aimNavigator(p: Point) {
    navigator.initialize(controls.target);navigator.orientation.copy(camera.quaternion);pointer(p);
    const projected=navigator.project(ray.ray);if(!projected)return;
    navigator.position.copy(projected).add(navigatorOffset.clone().applyQuaternion(navigator.orientation));
    if(drive.active)drive.move(navigator.position);request();
  }
  function mount(origin: Origin,p: Point) {
    const position=drive.begin(doc,key(origin),1,scale);mountedWorld=world;navigator.initialize(position);navigator.position.copy(position);navigator.orientation.copy(camera.quaternion);pointer(p);
    const projected=navigator.project(ray.ray);navigatorOffset.copy(projected?position.clone().sub(projected).applyQuaternion(navigator.orientation.clone().invert()):new T.Vector3());navigatorOffset.z=0;
    controls.enabled=false;input.pick(origin,false,false);rebuildPicks();input.feedback('Driving · click an empty cell to park · Esc cancels');request();
  }
  function cancelDrive() { const active=drive.active;drive.cancel();mountedWorld=undefined;navigatorOffset.set(0,0,0);controls.enabled=true;edges.visible=true;rebuildPicks();request();return active; }
  type Gesture={pointer:number;button:number;alt:boolean;start:Point;end:Point;origin?:Origin;edge?:Edge;anchor:T.Vector3;mode:'move'|'range'|'view'|'drive'|'paint';dragged:boolean;origins:readonly Origin[];moving?:Set<string>;project?:ReturnType<typeof pointerPlane>;resolve?:ReturnType<typeof import('./core/lattice.ts').prepareTranslation>};
  let gesture:Gesture|undefined;
  const secondary=createSecondaryRelease<()=>void>();
  let secondarySurface:{surface:OmnicSurface;released:boolean;context:boolean}|undefined;
  let stroke:{points:Vec3[];seen:Set<string>;previous:Vec3;source?:Origin;preview:T.InstancedMesh}|undefined;
  function paintPoint(p: Point) {
    if(!stroke)return;const next=creationPoint(p),samples=paintSamples(point(stroke.previous),point(next),.4);
    for(const sample of samples){if(stroke.points.length>=256)break;const cell=cellAt(sample),stamp=`${cell.x},${cell.y},${cell.z}`;if(stroke.seen.has(stamp)||grid.occupied.has(stamp))continue;stroke.seen.add(stamp);stroke.points.push(vector(cell));}
    stroke.previous=next;stroke.preview.count=stroke.points.length;
    stroke.points.forEach((position,index)=>stroke!.preview.setMatrixAt(index,new T.Matrix4().makeScale(scale,scale,scale).setPosition(new T.Vector3(...position).multiplyScalar(scale))));stroke.preview.instanceMatrix.needsUpdate=true;request();
  }
  function finishPaint(cancel=false){const active=stroke;if(!active)return false;stroke=undefined;scene.remove(active.preview);(active.preview.material as T.Material).dispose();if(!cancel&&active.points.length)input.paint(active.points,active.source);request();return true;}
  function restore(){if(stroke)finishPaint(true);if(gesture?.mode==='move')for(const visual of visuals.values())visual.group.position.copy(new T.Vector3(...vector(cellPoint(grid.cells.get(key(visual.node.origin))!,scale))));gesture=undefined;rectangle.hidden=true;controls.enabled=!drive.active;edges.visible=true;request();}
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0&&event.button!==2)return;nativeWheel=false;
    if(inputFrame){cancelAnimationFrame(inputFrame);inputFrame=0;}lastPoint={x:event.clientX,y:event.clientY};
    if(event.button===2){cancelDrive();navigation.begin(event,{...NAV_DEFAULTS,...world.settings?.navigation});}
    nudging.finish(true);held.clear();secondary.cancel();secondarySurface=undefined;
    if(omnicGesture&&omnicGesture.id===event.pointerId){const point=editPoint(event,omnicGesture.surface);if(point)omnicGesture.surface.down(point,event);event.preventDefault();event.stopImmediatePropagation();return;}
    if(omnic?.origin&&!drive.active&&!input.picking()){const hit=pointed({x:event.clientX,y:event.clientY}),point=hit.origin&&sameOrigin(hit.origin,omnic.origin)?editPoint(event,omnic,true):undefined;if(point){omnicGesture={surface:omnic,id:event.pointerId,bounds:{...omnic.bounds}};if(event.button===2)secondarySurface={surface:omnic,released:false,context:false};controls.enabled=false;event.preventDefault();event.stopImmediatePropagation();canvas.setPointerCapture(event.pointerId);omnic.down(point,event);return;}}
    const p={x:event.clientX,y:event.clientY},hit=pointed(p),range=event.button===0&&(event.ctrlKey||event.metaKey),moving=event.button===0&&!!hit.origin&&!range&&!drive.active&&!input.picking();
    let mode:Gesture['mode']=drive.active&&event.button===0?'drive':range?'range':moving?'move':'view';
    if(event.button===0&&event.altKey&&!input.picking()){
      cancelDrive();mode='paint';const paint=nodePaint(world),actual=hit.origin&&visuals.get(key(hit.origin))?.actual;
      const preview=new T.InstancedMesh(sphere,atomicCarrierMaterial(actual?.color??brightHex(paint.color!,paint.brightness!),actual?.opacity??paint.opacity,actual?.translucency??paint.translucency,actual?.glow??paint.glow,actual?.translucencyRadius??paint.translucencyRadius),256);preview.count=0;preview.frustumCulled=false;scene.add(preview);
      stroke={points:[],seen:new Set(),previous:creationPoint(p),source:hit.origin,preview};
    }
    if(moving&&!event.altKey&&!event.shiftKey&&!selected.some(origin=>sameOrigin(origin,hit.origin!)))input.pick(hit.origin!,false,false);
    if(event.button===2)secondary.press(()=>{});
    const anchor=hit.origin?visuals.get(key(hit.origin))!.group.position:controls.target;
    const project=mode==='move'?pointerPlane(camera,canvas.getBoundingClientRect(),anchor):undefined;
    gesture={project,pointer:event.pointerId,button:event.button,alt:event.altKey,start:p,end:p,...hit,anchor:project?project(p):at(p,anchor),mode,dragged:false,origins:event.shiftKey&&hit.origin&&!selected.some(origin=>sameOrigin(origin,hit.origin!))?[hit.origin]:[...selected]};
    if(['move','range','drive','paint'].includes(mode)||input.picking()) {controls.enabled=false;event.stopImmediatePropagation();canvas.setPointerCapture(event.pointerId);}
  },true);
  function processPointer(){
    inputFrame=0;const p=lastPoint;if(!p)return;const g=gesture;
    if(g){g.end=p;g.dragged ||= Math.hypot(p.x-g.start.x,p.y-g.start.y)>=4;
      if(g.mode==='paint'){if(g.dragged)paintPoint(p);return;}
      if(g.dragged&&g.mode==='move'){
        const delta=(g.project?.(p)??at(p,g.anchor)).sub(g.anchor).divideScalar(scale);
        // Same lattice transform used by numerical operation commits; preparation is once per gesture.
        g.resolve??=prepareTranslation(world,g.origins);
        if(gesture!==g)return;const targets=g.resolve(xyz(delta));
        if(targets)for(const[id,position]of targets)visuals.get(id)?.group.position.set(...position).multiplyScalar(scale);
        edges.visible=false;request();return;
      }
      if(g.dragged&&g.mode==='range'){rectangle.hidden=false;Object.assign(rectangle.style,{left:`${Math.min(g.start.x,p.x)}px`,top:`${Math.min(g.start.y,p.y)}px`,width:`${Math.abs(p.x-g.start.x)}px`,height:`${Math.abs(p.y-g.start.y)}px`});return;}
      if(g.dragged&&g.mode==='view')return;
    }
    if(drive.active){aimNavigator(p);return;}
    if(!input.picking())aimNavigator(p);
    const hit=pointed(p),next=hit.origin?key(hit.origin):undefined;if(next!==hover){hover=next;presentation();}
  }
  canvas.addEventListener('pointermove',event=>{if(navigation.move(event))return;if(omnicGesture&&omnicGesture.id===event.pointerId){const point=editPoint(event,omnicGesture.surface);if(point)omnicGesture.surface.move(point,event);return;}if(omnic?.origin){const point=editPoint(event,omnic,true);omnic.hover?.(!!point);if(point)omnic.move(point,event);}lastPoint={x:event.clientX,y:event.clientY};if(!inputFrame)inputFrame=requestAnimationFrame(()=>{void processPointer();});});
  canvas.addEventListener('pointerup',event=>{
    if(navigation.acceptsRelease(event)&&navigation.finish()){secondary.cancel();secondarySurface=undefined;cancelOmnic();gesture=undefined;request();return;}
    if(omnicGesture&&omnicGesture.id===event.pointerId){const gesture=omnicGesture,point=editPoint(event,gesture.surface);if(!(event.buttons&1)){omnicGesture=undefined;controls.enabled=!drive.active;}if(point)gesture.surface.up(point,event);else gesture.surface.cancel();if(event.button===2&&secondarySurface){secondarySurface.released=true;if(secondarySurface.context)secondarySurface=undefined;}request();return;}
    const g=gesture;if(!g||g.pointer!==event.pointerId)return;g.end={x:event.clientX,y:event.clientY};g.dragged ||= Math.hypot(g.end.x-g.start.x,g.end.y-g.start.y)>=4;gesture=undefined;rectangle.hidden=true;edges.visible=true;controls.enabled=!drive.active;
    try{
      if(g.mode==='paint'){if(g.dragged){paintPoint(g.end);finishPaint();return;}finishPaint(true);}
      if(g.dragged&&g.mode==='move'){
        g.moving??=new Set(branch(world,g.origins).map(key));
        const target=pointed(g.end,g.moving).origin,delta=xyz((g.project?.(g.end)??at(g.end,g.anchor)).sub(g.anchor).divideScalar(scale));
        if(target)input.adopt(g.origins,target,delta);else input.move(g.origins,delta);return;
      }
      if(g.dragged&&g.mode==='range'){
        const rect=canvas.getBoundingClientRect(),origins:Origin[]=[];
        for(const visual of visuals.values()){if(!visual.group.visible)continue;const p=visual.group.position.clone().project(camera),x=rect.left+(p.x+1)/2*rect.width,y=rect.top+(1-p.y)/2*rect.height;if(p.z>=-1&&p.z<=1&&x>=Math.min(g.start.x,g.end.x)&&x<=Math.max(g.start.x,g.end.x)&&y>=Math.min(g.start.y,g.end.y)&&y<=Math.max(g.start.y,g.end.y))origins.push(visual.node.origin);}input.range(origins,true);return;
      }
      if(g.dragged){secondary.cancel();return;}
      if(event.button===2){const position=creationPoint(g.end);secondary.release(()=>{cancelDrive();input.menu(g.origin,g.end,position,g.edge);})?.();return;}
      if(g.edge){cancelDrive();input.edge(g.edge);return;}
      if(input.picking()){if(g.origin)input.pick(g.origin,false,false);return;}
      if(g.mode==='range'){cancelDrive();if(g.origin)input.pick(g.origin,true,true);return;}
      if(event.shiftKey){if(g.origin)input.subtree(g.origin);return;}
      if(drive.active){const parked=drive.park(!!g.origin);if(!parked){input.feedback('Choose a free lattice cell to park. Esc cancels.');return;}mountedWorld=undefined;controls.enabled=true;navigatorOffset.set(0,0,0);rebuildPicks();input.feedback('');if(g.origin&&g.alt)mount(g.origin,g.end);return;}
      if(g.origin){if(g.alt)mount(g.origin,g.end);}else{navigator.initialize(controls.target);navigator.position.copy(at(g.end,navigator.position));navigatorOffset.set(0,0,0);}
    }catch(error){gesture=g;restore();input.feedback(error instanceof Error?error.message:String(error));}
    finally{request();}
  });
  canvas.addEventListener('dblclick',event=>{const hit=pointed({x:event.clientX,y:event.clientY});if(hit.origin){if(omnic?.origin&&sameOrigin(hit.origin,omnic.origin))return;cancelDrive();toggleContent(retained,key(hit.origin),false);input.expand(hit.origin);presentation();}});
  canvas.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();if(secondarySurface){const pending=secondarySurface;pending.context=true;const point=editPoint(event,pending.surface);if(point)pending.surface.context(point,event);if(pending.released)secondarySurface=undefined;}else secondary.context()?.();});
  canvas.addEventListener('pointercancel',()=>{navigation.finish(true);secondary.cancel();secondarySurface=undefined;cancelOmnic();restore();cancelDrive();});
  canvas.addEventListener('lostpointercapture',()=>{cancelOmnic();if(gesture?.mode!=='view')restore();});
  canvas.addEventListener('pointerleave',()=>{hover=undefined;presentation();});
  window.addEventListener('blur',()=>{secondary.cancel();secondarySurface=undefined;nudging.finish(true);navigation.finish(true);restoreNative();rebind();cancelOmnic();restore();cancelDrive();held.clear();});
  const cameraHistory:{position:T.Vector3;target:T.Vector3;up:T.Vector3}[]=[];
  const remember=()=>{cameraHistory.push({position:camera.position.clone(),target:controls.target.clone(),up:camera.up.clone()});if(cameraHistory.length>50)cameraHistory.shift();};
  type Pose={position:number[];target:number[];up:number[]};
  const pose=():Pose=>({position:camera.position.toArray(),target:controls.target.toArray(),up:camera.up.toArray()});
  const recordCamera=(before:Pose,group?:string)=>universalHistory.record('world.camera',before,pose(),['camera'],universalHistory.contextPath,group);
  let nativeBefore:Pose|undefined,nativeWheel=false;
  function restoreNative(){if(!nativeBefore)return;const value=nativeBefore;nativeBefore=undefined;camera.position.fromArray(value.position);camera.up.fromArray(value.up);controls.target.fromArray(value.target);camera.lookAt(controls.target);}
  const nativeStart=()=>{nativeBefore??=pose();};
  const nativeEnd=()=>{if(nativeBefore){recordCamera(nativeBefore,nativeWheel?'camera.wheel':undefined);nativeBefore=undefined;}};
  function rebind(){controls=rebindOrbitControls(camera,canvas,controls);controls.addEventListener('change',request);controls.addEventListener('start',nativeStart);controls.addEventListener('end',nativeEnd);}
  controls.addEventListener('start',nativeStart);controls.addEventListener('end',nativeEnd);
  canvas.addEventListener('wheel',()=>{nativeWheel=true;},{capture:true,passive:true});
  universalHistory.register('world.camera',{read:pose,write:(value:Pose)=>{
    if(![value.position,value.target,value.up].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)))throw Error('Invalid camera history.');
    navigation.finish(true);cancelDrive();nativeBefore=undefined;
    camera.position.fromArray(value.position);camera.up.fromArray(value.up);controls.target.fromArray(value.target);camera.lookAt(controls.target);rebind();request();
  }});
  const navigation=createNavigationGesture({camera,scene,canvas,target:()=>controls.target,nodes:()=>visuals,
    document:()=>doc,coordinates:()=>new Map([...grid.cells].map(([id,p])=>[id,cellPoint(p,scale)])),
    prepareLayout:ids=>prepareLatticeTransform(doc,ids,1,scale),selection:()=>selectedKeys,
    pointed:event=>{const hit=pointed({x:event.clientX,y:event.clientY});return hit.origin?key(hit.origin):undefined;},
    request,enabled:value=>{controls.enabled=value&&!drive.active;},rebind,feedback:input.feedback,
    commit:(ids,rotation,pivot,layout)=>input.transform(ids.map(id=>visuals.get(id)!.node.origin),rotation,{x:pivot.x/scale,y:pivot.y/scale,z:pivot.z/scale},layout),
    remember:before=>{cameraHistory.push(before);if(cameraHistory.length>50)cameraHistory.shift();recordCamera({position:before.position.toArray(),target:before.target.toArray(),up:before.up.toArray()});},distanceLimits:()=>({min:controls.minDistance,max:controls.maxDistance}),
  });
  function cameraAction(action:CameraAction){
    if(action==='settings'){input.navigationSettings();return;}
    navigation.finish(true);cancelDrive();const before=pose();
    if(action==='back'){const pose=cameraHistory.pop();if(pose){camera.position.copy(pose.position);camera.up.copy(pose.up);controls.target.copy(pose.target);}}
    else {remember();
      if(action==='cameraOrigin'){camera.position.copy(DEFAULT_CAMERA_POSITION).multiplyScalar(scale);camera.up.set(0,1,0);controls.target.set(0,0,0);}
      if(action==='zoom100')camera.position.copy(controls.target).add(camera.getWorldDirection(new T.Vector3()).negate().multiplyScalar(DEFAULT_CAMERA_POSITION.length()*scale));
      if(action==='rollLeft'||action==='rollRight')camera.up.applyAxisAngle(camera.getWorldDirection(new T.Vector3()),(action==='rollLeft'?1:-1)*Math.PI/12);
      if(action==='front'||action==='all'){
        const ids=action==='all'?[...visuals.keys()]:[...selectedKeys];const bounds=new T.Box3();for(const id of ids){const v=visuals.get(id);if(v?.group.visible)bounds.union(new T.Box3().setFromObject(v.group));}
        if(!bounds.isEmpty()){const first=visuals.get(ids[0]),center=bounds.getCenter(new T.Vector3()),orientation=action==='front'?first?.group.quaternion??new T.Quaternion():camera.quaternion;const pose=frontOnPose(camera,center,orientation,bounds,{min:controls.minDistance,max:controls.maxDistance});camera.position.copy(pose.position);camera.up.copy(pose.up);controls.target.copy(pose.target);}
      }
    }
    camera.lookAt(controls.target);rebind();recordCamera(before);request();
  }
  const hud=cameraHUD(cameraAction);
  guardCameraPointer(canvas,active=>{controls.enabled=!active&&!navigation.active&&!drive.active;},()=>{navigation.finish(true);restoreNative();restore();cancelDrive();rebind();});
  const held=new Set<NudgeActionId>();let nudgeDepth=false;
  const nudging=createNudgeGesture({schedule:requestAnimationFrame,cancel:cancelAnimationFrame,now:()=>performance.now(),snapshot:()=>{
    if(navigation.active||omnicGesture)return null;
    if(nudgeDepth){navigator.initialize(controls.target);navigator.orientation.copy(camera.quaternion);const origin=navigator.position.clone();
      return {step:scale,frame:new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),navigator.forward()),preview:delta=>{navigator.position.copy(origin).add(delta);if(lastPoint)aimNavigator(lastPoint);request();},restore:()=>{},commit:()=>{}};
    }
    const origins=[...selected];if(!origins.length||drive.active)return null;
    const resolve=prepareTranslation(world,origins),snapshot=grid;
    return {step:1,frame:latticeFrame(camera.quaternion),preview:delta=>{const targets=resolve(xyz(delta));if(targets)for(const[id,p]of targets)visuals.get(id)?.group.position.set(...p).multiplyScalar(scale);request();},
      restore:()=>{for(const[id,v]of visuals){const cell=snapshot.cells.get(id);if(cell)v.group.position.set(...vector(cellPoint(cell,scale)));}request();},commit:delta=>input.move(origins,xyz(delta))};
  }});
  const arrowActions={ArrowUp:'nudgeUp',ArrowDown:'nudgeDown',ArrowLeft:'nudgeLeft',ArrowRight:'nudgeRight'} as const;
  canvas.addEventListener('keydown',event=>{const action=arrowActions[event.key as keyof typeof arrowActions];if(!action)return;event.preventDefault();if(event.repeat)return;
    if(!held.size)nudgeDepth=action==='nudgeUp'||action==='nudgeDown';held.add(action);nudging.update([...held]);});
  window.addEventListener('keyup',event=>{const action=arrowActions[event.key as keyof typeof arrowActions];if(action){held.delete(action);nudging.update([...held]);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){held.clear();nudging.finish(true);navigation.finish(true);restoreNative();restore();cancelOmnic();cancelDrive();}else request();});
  return { update,session,point:creationPoint,center:()=>navigator.initialized?xyz(navigator.position.clone().divideScalar(scale)):xyz(controls.target.clone().divideScalar(scale)),request,
    editOmnic(surface:OmnicSurface){if(omnic!==surface){cancelOmnic();omnic=surface;request();}return()=>{if(omnic===surface){cancelOmnic();omnic=undefined;request();}};},
    cancel(){const active=navigation.active||cancelOmnic()||!!gesture||drive.active;navigation.finish(true);nudging.finish(true);restore();cancelDrive();held.clear();return active;},
    variants(origin:Origin, enabled?:boolean){const id=key(origin);if(enabled===true)variants.add(id);else if(variants.has(id))variants.delete(id);else variants.add(id);update(world,selected,filter,selectedEdges);},
    camera:cameraAction,showCamera(){hud.show();request();},
    previewColor(origins:readonly Origin[],color:string){for(const origin of origins)visuals.get(key(origin))?.body.material.color.set(color);request();},
    focus(origins:readonly Origin[],fit=false){const before=pose();remember();const points=origins.map(origin=>visuals.get(key(origin))?.group.position).filter((p):p is T.Vector3=>!!p);if(!points.length)return;const center=points.reduce((sum,p)=>sum.add(p),new T.Vector3()).divideScalar(points.length),shift=center.clone().sub(controls.target);camera.position.add(shift);controls.target.copy(center);if(fit){const radius=Math.max(2*scale,...points.map(p=>p.distanceTo(center)));camera.position.copy(center).add(camera.getWorldDirection(new T.Vector3()).multiplyScalar(-radius/Math.tan(T.MathUtils.degToRad(camera.fov/2))*1.4));}controls.update();recordCamera(before);request();},
  };
}
