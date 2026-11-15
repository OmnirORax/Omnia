import {createOccupancy} from './graph/occupancy.ts';
import {axisPose} from './world/axisPose.ts';
import {createPaintSession} from './core/painting.ts';
import {createAxisView} from './world/axisView.ts';
import {nodeOriginView,originSlots,axisCenter,axisPoint,axisSlot,axisAnchor,planAxis,planSlotNode,endpointView,dot,minus,type AxisFrame} from './core/axes.ts';
import {startsConnector,connectorDragged} from './world/connectorGesture.ts';
import {resolveNodeAppearance,nodePaint,connectorPaint} from './core/appearance.ts';
import {brightHex} from './composer/runtime/appearance/resolve.ts';
import {createContentContour,collectContentHull} from './world/contentContour.ts';
import {contentEnvelope,convexHull} from './world/contentEnvelope.ts';
import {pushContours,type ContourBody} from './world/contourPush.ts';
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
import { cellPoint } from './graph/lattice.ts';
import { atomicCarrierGeometry, atomicCarrierMaterial, updateAtomicCarrier } from './atomicCarrier.ts';
import { analyticSelectionRing } from './materialCoverage.ts';
import { SPHERE_VISUAL_DEFAULTS as defaults } from './properties/sphereVisualDefaults.ts';
import { createWorldNavigator } from './navigation/worldNavigator.ts';
import { createNavigatorDrive } from './navigation/navigatorDrive.ts';
import { expansionState, nodeContentVisible } from './graph/nodePresentation.ts';
import { latticeFrame } from './latticeField.ts';
import { visualObject, disposeVisual } from './visualScene.ts';
import { paintSamples } from './omnic/paintStroke.ts';
import { createPipeline } from './world/render.ts';
import { label, disposeLabel } from './world/labels.ts';
import { createSceneSession } from './scene/session.ts';
import type { Document } from './graph/geometryTypes.ts';
import { TEXT_DEFAULTS } from './properties/visual.ts';

export type Edge = { kind: 'part'; owner: Origin; index: number } | { kind: 'relationship'; index: number } | { kind: 'variant'; owner: Origin };
type Point = { x: number; y: number };
type Input = { pick: (origin: Origin, extend: boolean, toggle: boolean) => void;
  origin:(id:string,position:Vec3)=>void;
  range: (origins: Origin[], extend: boolean) => void; clear: () => void;
  menu: (origin: Origin | undefined, point: Point, position: Vec3, edge?: Edge) => void;
  move: (origins: readonly Origin[], delta: Vec3) => void;
  connectDrag:(source:Origin,target:Origin|undefined,position:Vec3)=>void;
  adopt: (origins: readonly Origin[], owner: Origin, delta: Vec3) => void;
  park: (origin: Origin, position: Vec3) => World;
  paint: (positions: Vec3[], source?: Origin, axis?:string) => void;
  axis:(first:Origin,second:Origin,up:Vec3)=>void;
  slot:(origins:readonly Origin[],axis:string,point:Vec3)=>void;
  focusAxis:(id:string)=>void;
  connect: (origin: Origin)=>void;
  subtree: (origin: Origin,nextOnly?:boolean) => void;
  edge: (edge: Edge) => void;
  transform: (origins:readonly Origin[],rotation:Rotation,pivot: {x:number;y:number;z:number},layout:boolean)=>void;
  navigationSettings:()=>void;
  feedback: (message: string) => void; picking: () => boolean };
type Visual = { node: Structure; actual: Structure; anchor: T.Vector3; group: T.Group; host:T.Group; presentation:T.Group; contour:ReturnType<typeof createContentContour>;contourKey:string;contourShapeKey:string;
  body: T.Mesh<T.SphereGeometry, T.MeshPhongMaterial>; slot: T.Mesh; ring: T.Mesh<T.RingGeometry,T.MeshBasicMaterial>; text: ReturnType<typeof label>; caption: string; textKey?:string; object?: T.Group; visualKey?: string };
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
  const axisView=createAxisView(scene,host);
  let nodeViewDepth:number|undefined;
  let pointOfView:Origin|undefined,userView:{position:number[];target:number[];up:number[];pov?:Origin;depth?:number;returnView?:{position:number[];target:number[];up:number[]}}|undefined;
  let axisPlanCache:{world:World;first:string;second:string;plan:ReturnType<typeof planAxis>}|undefined;
  let axisPicking:{first?:Origin;up:Vec3;pointer?:number}|undefined;
  const activeAxis=()=>world?.axes?.find(frame=>frame.id===world.activeAxis);
  const retained = expansionState(), variants = new Set<string>(), navigator = createWorldNavigator();
  const rectangle = document.createElement('div'); rectangle.className = 'marquee'; rectangle.hidden = true; host.append(rectangle);
  let spaceIndex:ReturnType<typeof createOccupancy>,pointerInside=false,ghostCameraStamp='';
  let world: World, doc: Document, prepared: ReturnType<typeof prepareWorld>, grid: ReturnType<typeof lattice>;
  let selectedKeys=new Set<string>();
  let selected: readonly Origin[] = [], selectedEdges: readonly Edge[] = [], filter: ReadonlySet<string> | undefined;
  let scale = 1, frame = 0, inputFrame = 0, hover: string | undefined, lastPoint: Point | undefined, picks: T.Object3D[] = [];
  let mountedWorld: World | undefined,omnic:OmnicSurface|undefined,omnicGesture:{surface:OmnicSurface;id:number;bounds:OmnicSurface['bounds']}|undefined;
  const omnicPoint=new T.Vector3(),omnicCenter=new T.Vector3(),omnicQuaternion=new T.Quaternion(),omnicScale=new T.Vector3();
  function editPoint(event:PointerEvent|MouseEvent,surface:OmnicSurface,inside=false){
    if(surface.worldInput===false)return;
    const origin=surface.origin,visual=origin&&visuals.get(key(origin));if(!visual?.group.visible||!visual.object?.visible)return;
    pointer({x:event.clientX,y:event.clientY});visual.object.getWorldPosition(omnicCenter);visual.object.getWorldQuaternion(omnicQuaternion);visual.object.getWorldScale(omnicScale);
    if(!ray.ray.intersectPlane(new T.Plane().setFromNormalAndCoplanarPoint(new T.Vector3(0,0,1).applyQuaternion(omnicQuaternion),omnicCenter),omnicPoint))return;
    omnicPoint.sub(omnicCenter).applyQuaternion(omnicQuaternion.invert()).divide(omnicScale);if(inside&&(Math.abs(omnicPoint.x)>.5||Math.abs(omnicPoint.y)>.5))return;const bounds=omnicGesture?.bounds??surface.bounds,point=glyphSurfacePoint(bounds,omnicPoint),depth=omnicCenter.clone().applyMatrix4(camera.matrixWorldInverse).z;return {...point,scenePerPixel:Math.abs(2*depth*Math.tan(camera.fov*Math.PI/360)/canvas.clientHeight/omnicScale.y)*Math.max(bounds.width,bounds.height)};
  }
  function cancelOmnic(){if(!omnicGesture)return false;const surface=omnicGesture.surface;omnicGesture=undefined;surface.cancel();controls.enabled=!drive.active;request();return true;}
  let glyphs:ReturnType<typeof createGlyphPresentation>,glyphFrame=0;
  function glyph(visual:Visual,now=0){
    const editing=omnic?.origin&&sameOrigin(omnic.origin,visual.node.origin)?omnic.preview:undefined;
    if(visual.object?.userData.omnic&&visual.object.userData.glyphKey&&!visual.object.userData.motion&&!editing)return false;
    const result=glyphs?.(visual.actual,now/1000,editing);if(!result){if(visual.object?.userData.omnic){visual.presentation.remove(visual.object);disposeVisual(visual.object);visual.object=undefined;}return false;}
    if(visual.object?.userData.glyphKey!==result.key){
      const previousPosition=visual.object?.position.clone();
      if(visual.object){visual.presentation.remove(visual.object);disposeVisual(visual.object);}
      visual.object=visualObject({...visual.actual.visual,assetId:result.asset.id,character:undefined},[result.asset],text=>label(text),request,{},RENDER_BUDGET.omnicTextureEdge);
      if(previousPosition)visual.object.position.copy(previousPosition);
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
    for(const [id,item] of effectNodes)if(item.outline.visible){if(item.outline===visuals.get(id)?.ring){item.outline.quaternion.copy(item.group.quaternion).invert().multiply(camera.quaternion);item.outline.scale.setScalar(scale*.8*(item.selected?1+pulse*.1:1));}else item.outline.quaternion.identity();item.outline.material.opacity=item.opacity*(item.selected?.55+pulse*.3:.45);}
  }};
  const pipeline = createPipeline(renderer, scene, camera, request,()=>effectSource), session = createSceneSession(pipeline.wallpaper, input.feedback);
  let fontRevision=0,pushDirty=false,pushSignature='',pushRevision=0,relocationPin:string|undefined;const relocating=new Set<string>();
  document.fonts.addEventListener('loadingdone',()=>{fontRevision++;if(world)update(world,selected,filter,selectedEdges);});
  const displayed=(v:Visual)=>v.group.getWorldPosition(new T.Vector3());
  function refreshContours(){
    for(const v of visuals.values()){
      const content=v.group.visible&&(v.text.visible||!!v.object?.visible);
      if(!content){v.contour.outline.visible=v.contour.hit.visible=false;continue;}
      const signature=JSON.stringify([v.text.visible,v.text.material.map?.uuid,v.text.scale.toArray(),v.text.position.toArray(),v.object?.visible,v.object?.userData.glyphKey,v.object?.userData.contourVersion,v.object?.scale.toArray(),scale]);
      if(signature!==v.contourKey){
        v.contourKey=signature;const points=convexHull([...(v.text.visible?collectContentHull(v.text):[]),...(v.object?.visible?collectContentHull(v.object):[])]);
        const shapeKey=JSON.stringify([scale,points.map(p=>[Math.round(p.x*1e6),Math.round(p.y*1e6)])]);if(shapeKey!==v.contourShapeKey){v.contourShapeKey=shapeKey;v.contour.update(points,scale);pushDirty=true;}
      }
      v.contour.outline.visible=v.contour.hit.visible=v.contour.points.length>=3;
      v.ring.visible=!v.contour.outline.visible&&selectedKeys.has(key(v.node.origin));
    }
  }
  function resolveContentPush(){
    if(!pushDirty||gesture||navigation.active||drive.active||nudging.active||connectorDrag)return;
    pushDirty=false;camera.updateMatrixWorld();
    const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;
    const unit=(v:Visual)=>Math.max(.00001,-v.group.position.clone().applyMatrix4(camera.matrixWorldInverse).z)*2*Math.tan(T.MathUtils.degToRad(camera.fov/2))/height;
    const bodies:ContourBody[]=[],units=new Map<string,number>(),fixed=new Set([...selectedKeys,...(world.axes??[]).flatMap(frame=>frame.ends.map(key))]);
    for(const [id,v]of visuals){if(!v.group.visible)continue;const p=v.group.position.clone().project(camera);if(p.z< -1||p.z>1)continue;
      const u=unit(v),points=v.contour.outline.visible?v.contour.points:contentEnvelope([{x:0,y:0}],scale*.5,32);
      bodies.push({id,fixed:fixed.has(id),passive:!v.contour.outline.visible,x:(p.x+1)*width/2,y:(1-p.y)*height/2,points:points.map(q=>({x:q.x/u,y:-q.y/u}))});units.set(id,u);
    }
    // Expansion is anchored to the selected node's canonical position. A
    // previous display offset or an unrelated hovered node cannot move its root.
    const activeId=relocationPin??(selected.length?key(selected.at(-1)!):undefined),active=activeId?visuals.get(activeId):undefined,pinned=active?.group.visible?active.group.position.clone().project(camera):undefined;
    const pin=active&&pinned&&units.has(activeId!)?{id:activeId!,x:(pinned.x+1)*width/2,y:(1-pinned.y)*height/2}:undefined;
    const hasContent=bodies.some(b=>visuals.get(b.id)!.contour.outline.visible),positions=hasContent?pushContours(bodies,pin,0):new Map();
    const right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion);
    for(const v of visuals.values())v.host.position.set(0,0,0);
    for(const body of bodies){const point=positions.get(body.id);if(!point)continue;const v=visuals.get(body.id)!,u=units.get(body.id)!;v.host.position.copy(right).multiplyScalar((point.x-body.x)*u).addScaledVector(up,(body.y-point.y)*u);}
    pushRevision++;relocationPin=undefined;
    connections();rebuildPicks();
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
      axisView.orient(camera);
      camera.updateMatrixWorld();
      navigator.orientation.copy(camera.quaternion);
      let animated=false;if(omnic?.origin){const visual=visuals.get(key(omnic.origin));if(visual?.group.visible&&visual.object?.visible)glyph(visual,now);}
      if(now-glyphFrame>=1000/RENDER_BUDGET.omnicFps){glyphFrame=now;let sources=0;for(const visual of visuals.values())if(visual.group.visible&&visual.object?.visible&&visual.object.userData.motion){if(visual.object?.userData.omnic&&sources++>=RENDER_BUDGET.omnicSceneSources)continue;animated= glyph(visual,now)||animated;}}
      for(const visual of visuals.values())if(visual.object?.userData.omnic&&visual.object.visible)visual.object.quaternion.identity();
      refreshContours();resolveContentPush();
      hud.update(camera,controls.target,selected[0]&&visuals.get(key(selected[0]))?displayed(visuals.get(key(selected[0]))!):undefined);
      edges.visible=!navigation.active&&!(gesture?.dragged&&gesture.mode==='move');
      const cameraStamp=`${camera.matrixWorld.elements.join(',')}/${camera.aspect}/${scale}`;if(cameraStamp!==ghostCameraStamp){ghostCameraStamp=cameraStamp;if(pointerInside&&!gesture&&!navigation.active&&!drive.active&&!axisPicking&&lastPoint)processPointer();}
      pipeline.render();
      if((animated||[...visuals.values()].some(v=>v.group.visible&&v.object?.visible&&v.object.userData.motion))&&!document.hidden)request();
      if (selected.length && !reduced.matches && !document.hidden) request();
    });
  }
  const resize = new ResizeObserver(() => { const box = host.getBoundingClientRect(); pipeline.resize(box.width, box.height); camera.aspect = box.width / Math.max(1, box.height); camera.updateProjectionMatrix(); request(); }); resize.observe(host);
  controls.addEventListener('change', () => { navigator.orientation.copy(camera.quaternion); request(); });
  function pointer(p: Point) { const r = canvas.getBoundingClientRect(); ray.setFromCamera(new T.Vector2((p.x-r.left)/r.width*2-1, -(p.y-r.top)/r.height*2+1), camera); }
  function pointed(p: Point, exclude?: ReadonlySet<string>): { origin?: Origin; edge?: Edge;axis?:string } {
    pointer(p); ray.params.Line!.threshold = scale * .15;
    let axis:string|undefined;
    for (const hit of ray.intersectObjects(picks, true)) {
      if(hit.object.userData.axis){axis??=hit.object.userData.axis;continue;}
      let owner: T.Object3D | null = hit.object;
      while (owner && !owner.userData.origin && !owner.userData.edge) owner = owner.parent;
      if (owner?.userData.origin) { if (exclude?.has(key(owner.userData.origin))) continue; return { origin: owner.userData.origin }; }
      if (owner?.userData.edge && !exclude) return { edge: owner.userData.edge };
    }
    return axis?{axis}:{};
  }
  function at(p: Point, anchor = controls.target) {
    pointer(p); const result = ray.ray.intersectPlane(new T.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new T.Vector3()), anchor), new T.Vector3()); return result ?? anchor.clone();
  }
  function locatePosition(origin:Origin){return world.nodes.find(node=>sameOrigin(node.origin,origin))?.position;}
  function axisPlanePoint(p:Point,frame:AxisFrame){
    pointer(p);
    const center=(pointOfView?new T.Vector3(...axisCenter(world,frame)).addScaledVector(new T.Vector3(...frame.z),-(nodeViewDepth??0)).multiplyScalar(scale):new T.Vector3(...axisCenter(world,frame)).multiplyScalar(scale));return ray.ray.intersectPlane(new T.Plane().setFromNormalAndCoplanarPoint(new T.Vector3(...frame.z),center),new T.Vector3())??center;
  }
  function nearAxis(p:Point,position:Vec3){const frame=activeAxis();if(!frame)return;const slot=axisPoint(world,frame,axisSlot(world,frame,position)),q=new T.Vector3(...slot).multiplyScalar(scale).project(camera),box=canvas.getBoundingClientRect();return Math.hypot(box.left+(q.x+1)*box.width/2-p.x,box.top+(1-q.y)*box.height/2-p.y)<18?{frame,point:slot}:undefined;}
  function creationPoint(p: Point) {
    const frame=activeAxis();if(frame)return axisPoint(world,frame,axisSlot(world,frame,xyz(axisPlanePoint(p,frame).divideScalar(scale)),'space'));
    pointer(p); const orientation = latticeFrame(camera.quaternion), normal = new T.Vector3(0,0,1).applyQuaternion(orientation);
    const hit = ray.ray.intersectPlane(new T.Plane().setFromNormalAndCoplanarPoint(normal, controls.target), new T.Vector3());
    return xyz((hit ?? controls.target).clone().divideScalar(scale));
  }
  function rebuildPicks() {
    picks = [...axisView.picks];
    for (const [id, visual] of visuals) if (visual.group.visible && !drive.owns(id)) { picks.push(visual.contour.hit.visible?visual.contour.hit:visual.slot); }
    for (const child of edges.children) if (child.userData.edge) picks.push(child);
  }
  function presentation() {
    for (const [id,v] of visuals) {
      const chosen=selectedKeys.has(id),show=nodeContentVisible(retained,id,world.settings?.names,chosen,hover===id,relocating.has(id)||drive.owns(id));
      v.text.visible=!!v.caption.trim()&&show&&v.actual.visual?.showText!==false;
      if(v.group.visible&&show)glyph(v,performance.now());
      if(v.object)v.object.visible=show;
      if(!show&&v.object?.userData.omnic){v.presentation.remove(v.object);disposeVisual(v.object);v.object=undefined;}
      const glyphVisible=!!v.object?.visible,textVisible=v.text.visible;
      v.text.position.y=glyphVisible&&textVisible?-((v.actual.visual?.size??1.4)+.3)/2:0;
      if(v.object)v.object.position.y=glyphVisible&&textVisible?(v.text.scale.y+.3)/2:0;
      v.body.visible=!(textVisible||glyphVisible);v.ring.visible=chosen&&v.body.visible;v.contour.outline.material.color.set(v.actual.color);
    }
    const signature=JSON.stringify([world.activeAxis,(world.axes??[]).map(frame=>frame.ends),selected.map(key),[...visuals].map(([id,v])=>[id,v.group.visible,v.group.position.toArray(),v.text.visible,!!v.object?.visible,v.caption,v.textKey,v.visualKey])]);
    if(signature!==pushSignature){pushSignature=signature;pushDirty=true;}
    refreshContours();rebuildPicks();request();
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
    const a = displayed(aVisual), b = displayed(bVisual), direction = b.clone().sub(a), length = direction.length(); if (length < 1e-10) return;
    direction.normalize(); const padding = Math.min(scale * .35, length * .2); a.addScaledVector(direction,padding); b.addScaledVector(direction,-padding);
    const paint=connectorPaint(world,source);
    const material = new T.LineBasicMaterial({ color:paint.color,opacity:paint.opacity,transparent:true,depthWrite:false,linewidth: active ? 2 : 1 });
    const line = new T.Line(new T.BufferGeometry().setFromPoints([a,b]), material); line.userData.edge = edge;line.userData.glowIntensity=paint.glow; edges.add(line);
    const side = direction.clone().cross(camera.position.clone().sub(b)).normalize().multiplyScalar(scale*.12), back = b.clone().addScaledVector(direction,-scale*.25);
    const arrow = new T.Line(new T.BufferGeometry().setFromPoints([back.clone().add(side),b,back.clone().sub(side)]), material.clone()); arrow.userData.edge = edge;arrow.userData.glowIntensity=paint.glow; edges.add(arrow);
    let edgeLabel:ReturnType<typeof label>|undefined;
    if (text) { const caption = label(text,world.appearance?.text);edgeLabel=caption; caption.userData.requestRender=request;caption.scale.multiplyScalar(.65); caption.position.copy(a.clone().add(b).multiplyScalar(.5)); caption.userData.edge = edge; caption.userData.ends=[a,b]; edges.add(caption); }
    effectConnectors.push({data:{key:JSON.stringify(edge)},line,path:new T.LineCurve3(a,b),arrow,label:edgeLabel,textOpacity:edgeLabel?.material.opacity??1});
  }
  function connections() {
    clearEdges();
    for (const owner of world.nodes) owner.parts.forEach((binding,index) => { for (const target of prepared.resolve(binding)) connection(owner,target, '', {kind:'part',owner:owner.origin,index}); });
    for (const node of world.nodes) if (node.variantOf) { const base = world.nodes.find(candidate => sameOrigin(candidate.origin,node.variantOf!)); if (base) connection(base,node,'variant',{kind:'variant',owner:node.origin}); }
    (world.relationships ?? []).forEach((relation,index) => { for (const a of prepared.resolve(relation.from)) for (const b of prepared.resolve(relation.to)) connection(a,b,relation.label || relation.kind,{kind:'relationship',index}); });
  }
  function visibility(node: Structure) {
    if (pointOfView&&sameOrigin(node.origin,pointOfView))return false;
    if (node.hidden || filter && !filter.has(key(node.origin))) return false;
    if (node.variantOf && !variants.has(key(node.variantOf))) return false;
    let parent = node.parent && visuals.get(key(node.parent))?.node, depth = 0;
    while (parent && depth++ < 500) { if (parent.hidden || parent.collapsed && !node.variantOf) return false; parent = parent.parent && visuals.get(key(parent.parent))?.node; }
    return true;
  }
  function update(next: World, selection: readonly Origin[], visible?: ReadonlySet<string>, edgeSelection: readonly Edge[] = []) {
    pipeline.configure(next.appearance?.animations);
    if(pointOfView&&world){const old=world.nodes.find(node=>sameOrigin(node.origin,pointOfView!)),current=next.nodes.find(node=>sameOrigin(node.origin,pointOfView!));if(!current){pointOfView=undefined;nodeViewDepth=undefined;if(userView){camera.position.fromArray(userView.position);camera.up.fromArray(userView.up);controls.target.fromArray(userView.target);camera.lookAt(controls.target);userView=undefined;rebind();}}else if(old){const delta=new T.Vector3(...current.position.map((n,i)=>n-old.position[i])).multiplyScalar(scale);camera.position.add(delta);controls.target.add(delta);}}
    if(world&&next!==world){navigation.finish(true);nudging.finish(true);if(gesture)restore();}
    if (drive.active && (next !== mountedWorld || !selection.some(origin => key(origin) === drive.id))) cancelDrive();
    if (world !== next) {spaceIndex=createOccupancy(next.nodes.map(node=>[key(node.origin),point(node.position)] as const));cancelOmnic();const sources=createGlyphPresentation(next,true);if(sources!==glyphs)for(const visual of visuals.values())if(visual.object?.userData.omnic)visual.object.userData.glyphKey=undefined;glyphs=sources; prepared = prepareWorld(next); doc = geometry(next); grid = lattice(next); }
    world = next;axisView.update(next,scale); selected = selection;selectedKeys=new Set(selection.map(key)); selectedEdges = edgeSelection; filter = visible;
    const nextScale = next.settings?.latticeScale ?? 1;
    if (nextScale !== scale) { const shift = controls.target.clone().multiplyScalar(nextScale/scale-1); controls.target.add(shift); camera.position.add(shift); navigator.rescale(nextScale/scale); scale=nextScale; controls.minDistance=Math.min(.2,scale/4); camera.near=Math.max(1e-9,scale*.001); camera.updateProjectionMatrix(); controls.update(); }
    axisView.update(next,scale);
    const present = new Set(next.nodes.map(node => key(node.origin)));
    for (const [id, visual] of visuals) if (!present.has(id)) { scene.remove(visual.host);visual.contour.dispose(); visual.body.material.dispose();(visual.ring.material as T.Material).dispose(); disposeLabel(visual.text); if (visual.object) disposeVisual(visual.object); visuals.delete(id);effectNodes.delete(id); }
    for (const node of next.nodes) {
      const actual = resolveNodeAppearance(next,inherited(node,next)), id=key(node.origin), textPaint={...TEXT_DEFAULTS,...next.appearance?.text,...actual.textAppearance},textKey=JSON.stringify([textPaint,fontRevision]), caption=`${actual.label || (node.invariant ? '⚬' : '')}${node.parts.some(binding => !prepared.resolve(binding).length) ? ' !' : ''}`;
      let visual=visuals.get(id);
      if (!visual) {
        const host=new T.Group(),group=new T.Group(),presentation=new T.Group(),body=new T.Mesh(sphere,atomicCarrierMaterial(actual.color)),slot=new T.Mesh(sphere,slotMaterial),ring=new T.Mesh(ringGeometry,ringMaterial.clone()),text=label(caption,textPaint);text.userData.requestRender=request;
        const contour=createContentContour();contour.hit.userData.origin=node.origin;
        ring.renderOrder=20; presentation.add(text,contour.outline,contour.hit);group.add(body,slot,ring,presentation);host.add(group);scene.add(host);visual={node,actual,anchor:group.position,group,host,presentation,body,slot,ring,text,caption,textKey,contour,contourKey:'',contourShapeKey:''};visuals.set(id,visual);
        const item=visual;effectNodes.set(id,{group:item.group,presentation:item.presentation,cell:item.body,get outline(){return item.contour.outline.visible?item.contour.outline:item.ring;},get text(){return item.text;},get visual(){return item.object;},get selected(){return selectedKeys.has(id);},get color(){return item.actual.color;},get opacity(){return item.actual.opacity??1;}});
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
    if(!input.picking()){connectionSource=undefined;connectionLine.visible=false;}connections();presentation();session.update(next,selection[0]);drive.refresh();
  }
  const navigatorOffset = new T.Vector3();
  function aimNavigator(p: Point) {
    navigator.initialize(controls.target);navigator.orientation.copy(camera.quaternion);pointer(p);
    const projected=navigator.project(ray.ray);if(!projected)return;
    navigator.position.copy(projected).add(navigatorOffset.clone().applyQuaternion(navigator.orientation));
    if(drive.active)drive.move(navigator.position.clone().sub(visuals.get(drive.id!)?.host.position??new T.Vector3()));request();
  }
  function mount(origin: Origin,p: Point) {
    const position=drive.begin(doc,key(origin),1,scale,[...(prepareTranslation(world,[origin])([0,0,0])?.keys()??[key(origin)])]).add(visuals.get(key(origin))!.host.position);mountedWorld=world;navigator.initialize(position);navigator.position.copy(position);navigator.orientation.copy(camera.quaternion);pointer(p);
    const projected=navigator.project(ray.ray);navigatorOffset.copy(projected?position.clone().sub(projected).applyQuaternion(navigator.orientation.clone().invert()):new T.Vector3());navigatorOffset.z=0;
    controls.enabled=false;input.pick(origin,false,false);rebuildPicks();input.feedback('Driving · click an empty cell to park · Esc cancels');request();
  }
  function cancelDrive() { const active=drive.active;if(active)relocationPin=drive.id;drive.cancel();mountedWorld=undefined;navigatorOffset.set(0,0,0);controls.enabled=true;edges.visible=true;rebuildPicks();if(active)presentation();else request();return active; }
  type Gesture={pointer:number;button:number;alt:boolean;start:Point;end:Point;origin?:Origin;edge?:Edge;axis?:string;anchor:T.Vector3;mode:'move'|'range'|'view'|'drive'|'paint';dragged:boolean;landing?:{delta:Vec3;frame?:string;point?:Vec3};origins:readonly Origin[];moving?:Set<string>;project?:ReturnType<typeof pointerPlane>;resolve?:ReturnType<typeof import('./core/lattice.ts').prepareTranslation>};
  let gesture:Gesture|undefined;
  let connectionSource:Origin|undefined;
  const connectionLine=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:0x00d8ff,depthTest:false}));connectionLine.visible=false;connectionLine.frustumCulled=false;scene.add(connectionLine);

  const secondary=createSecondaryRelease<()=>void>();
  let secondarySurface:{surface:OmnicSurface;released:boolean;context:boolean}|undefined;
  const ghost=new T.InstancedMesh(sphere,atomicCarrierMaterial('#eeeeee',.45,0,.2),4000);ghost.visible=false;ghost.frustumCulled=false;scene.add(ghost);
  let originPick:{id:string;slots:Vec3[];pointer?:number;choice?:Vec3}|undefined;
  let altPreview=false;
  let creating=false;
  let hoverPaint:{world:World;signature:string;session:ReturnType<typeof createPaintSession>}|undefined;
  let pointerAlt=false,pointerShift=false,hoverCandidate:ReturnType<ReturnType<typeof createPaintSession>['candidate']>|undefined,coordinatesVisible=true;
  function paintContext(p:Point,planes:boolean){
    const frame=activeAxis(),basis: [Vec3,Vec3,Vec3]=frame?[frame.x,frame.y,frame.z]:[xyz(new T.Vector3(1,0,0).applyQuaternion(camera.quaternion)),xyz(new T.Vector3(0,1,0).applyQuaternion(camera.quaternion)),xyz(new T.Vector3(0,0,1).applyQuaternion(camera.quaternion))];
    const forward=camera.getWorldDirection(new T.Vector3()),normal=basis.map(v=>Math.abs(forward.dot(new T.Vector3(...v)))),plane=frame?2:normal.indexOf(Math.max(...normal));
    const center=frame?(pointOfView?new T.Vector3(...axisCenter(world,frame)).addScaledVector(new T.Vector3(...frame.z),-(nodeViewDepth??0)).multiplyScalar(scale):new T.Vector3(...axisCenter(world,frame)).multiplyScalar(scale)):at(p),project=(q:Point)=>{pointer(q);return xyz((ray.ray.intersectPlane(new T.Plane().setFromNormalAndCoplanarPoint(new T.Vector3(...basis[plane]),center),new T.Vector3())??center).divideScalar(scale));};
    const origin=project(p),planeDepth=frame&&pointOfView?dot(minus(origin,axisAnchor(world,frame)),basis[plane]):undefined;return {session:createPaintSession(world,origin,basis,frame,plane,planes,planeDepth,spaceIndex),project,frame:frame?.id,basis};
  }
  function showGhost(candidate:ReturnType<ReturnType<typeof createPaintSession>['candidate']>){
    ghost.visible=creating&&!stroke;ghost.count=candidate.stamp.length;const paint=nodePaint(world);ghost.material.color.set(candidate.valid?brightHex(paint.color!,paint.brightness!):'#ff3344');updateAtomicCarrier(ghost.material,paint.opacity!*.7,paint.translucency,paint.glow,paint.translucencyRadius);
    candidate.stamp.forEach((p,i)=>ghost.setMatrixAt(i,new T.Matrix4().makeScale(scale,scale,scale).setPosition(new T.Vector3(...p).multiplyScalar(scale))));ghost.instanceMatrix.needsUpdate=true;hoverCandidate=candidate;
    axisView.brushCoordinates(world,activeAxis(),candidate.stamp,scale,camera,coordinatesVisible);
  }
  let stroke:{session:ReturnType<typeof createPaintSession>;previous:Vec3;project:(p:Point)=>Vec3;axis?:string;source?:Origin;preview:T.InstancedMesh}|undefined;
  function paintPoint(p: Point) {
    if(!stroke)return;const next=stroke.project(p),samples=paintSamples(point(stroke.previous),point(next),.4);
    for(const sample of samples)stroke.session.add(vector(sample));
    showGhost(stroke.session.candidate(next));stroke.previous=next;stroke.preview.count=stroke.session.points.length;
    stroke.session.points.forEach((position,index)=>stroke!.preview.setMatrixAt(index,new T.Matrix4().makeScale(scale,scale,scale).setPosition(new T.Vector3(...position).multiplyScalar(scale))));stroke.preview.instanceMatrix.needsUpdate=true;request();
  }
  function finishPaint(cancel=false){const active=stroke;if(!active)return false;stroke=undefined;scene.remove(active.preview);(active.preview.material as T.Material).dispose();ghost.visible=false;if(!cancel&&active.session.points.length)input.paint(active.session.points,active.source,active.axis);request();return true;}
  let connectorDrag:{pointer:number;button:number;source:Origin;start:Point;project:ReturnType<typeof pointerPlane>;line:T.Line<T.BufferGeometry,T.LineBasicMaterial>}|undefined;
  function cancelConnector(){const drag=connectorDrag;if(!drag)return false;connectorDrag=undefined;scene.remove(drag.line);drag.line.geometry.dispose();drag.line.material.dispose();controls.enabled=!drive.active&&!navigation.active;request();return true;}
  function beginConnector(event:PointerEvent,source:Origin){
    navigation.finish(true);cancelDrive();nudging.finish(true);held.clear();secondary.cancel();const center=displayed(visuals.get(key(source))!),project=pointerPlane(camera,canvas.getBoundingClientRect(),center),line=new T.Line(new T.BufferGeometry().setFromPoints([center,center]),new T.LineBasicMaterial({color:visuals.get(key(source))!.actual.color,depthTest:false}));line.renderOrder=30;scene.add(line);connectorDrag={pointer:event.pointerId,button:event.button,source,start:{x:event.clientX,y:event.clientY},project,line};controls.enabled=false;canvas.setPointerCapture(event.pointerId);event.preventDefault();event.stopImmediatePropagation();request();
  }
  function restore(){ghost.visible=false;cancelConnector();if(stroke)finishPaint(true);if(gesture?.mode==='move')for(const visual of visuals.values())visual.group.position.copy(new T.Vector3(...vector(cellPoint(grid.cells.get(key(visual.node.origin))!,scale))));gesture=undefined;rectangle.hidden=true;controls.enabled=!drive.active;edges.visible=true;if(relocating.size){relocating.clear();presentation();}else request();}
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0&&event.button!==2)return;nativeWheel=false;
    if(originPick&&event.button===0){lastPoint={x:event.clientX,y:event.clientY};processPointer();originPick.pointer=event.pointerId;event.preventDefault();event.stopImmediatePropagation();canvas.setPointerCapture(event.pointerId);return;}
    if(altPreview){finishPaint(true);altPreview=false;}
    if(axisPicking&&event.button===0){axisPicking.pointer=event.pointerId;event.preventDefault();event.stopImmediatePropagation();canvas.setPointerCapture(event.pointerId);return;}
    const initial=pointed({x:event.clientX,y:event.clientY});if(startsConnector(event,!!initial.origin,input.picking())){beginConnector(event,initial.origin!);return;}
    if(inputFrame){cancelAnimationFrame(inputFrame);inputFrame=0;}lastPoint={x:event.clientX,y:event.clientY};
    if(event.button===2){ghost.visible=false;axisView.setCoordinatesVisible(false);cancelDrive();navigation.begin(event,{...NAV_DEFAULTS,...world.settings?.navigation,...(pointOfView?{mode:'look' as const,actor:'camera' as const}:{})});}
    nudging.finish(true);held.clear();secondary.cancel();secondarySurface=undefined;
    if(omnicGesture&&omnicGesture.id===event.pointerId){const point=editPoint(event,omnicGesture.surface);if(point)omnicGesture.surface.down(point,event);event.preventDefault();event.stopImmediatePropagation();return;}
    if(!(creating&&event.altKey)&&omnic?.origin&&omnic.worldInput!==false&&!drive.active&&!input.picking()){const hit=pointed({x:event.clientX,y:event.clientY}),point=hit.origin&&sameOrigin(hit.origin,omnic.origin)?editPoint(event,omnic,true):undefined;if(point){omnicGesture={surface:omnic,id:event.pointerId,bounds:{...omnic.bounds}};if(event.button===2)secondarySurface={surface:omnic,released:false,context:false};controls.enabled=false;event.preventDefault();event.stopImmediatePropagation();canvas.setPointerCapture(event.pointerId);omnic.down(point,event);return;}}
    const p={x:event.clientX,y:event.clientY},hit=pointed(p),range=event.button===0&&(event.ctrlKey||event.metaKey),moving=event.button===0&&!!hit.origin&&!range&&!drive.active&&!input.picking();
    let mode:Gesture['mode']=drive.active&&event.button===0?'drive':range?'range':moving?'move':'view';
    if(event.button===0&&creating&&event.altKey&&!input.picking()){
      cancelDrive();mode='paint';const paint=nodePaint(world);
      const preview=new T.InstancedMesh(sphere,atomicCarrierMaterial(brightHex(paint.color!,paint.brightness!),paint.opacity!*.7,paint.translucency,paint.glow,paint.translucencyRadius),4000);preview.count=0;preview.frustumCulled=false;scene.add(preview);
      const context=paintContext(p,event.shiftKey);stroke={session:context.session,project:context.project,axis:context.frame,previous:context.project(p),source:undefined,preview};paintPoint(p);
    }
    if(moving&&!event.altKey&&!event.shiftKey&&!selected.some(origin=>sameOrigin(origin,hit.origin!)))input.pick(hit.origin!,false,false);
    if(event.button===2)secondary.press(()=>{});
    const anchor=hit.origin?displayed(visuals.get(key(hit.origin))!):controls.target;
    const project=mode==='move'?pointerPlane(camera,canvas.getBoundingClientRect(),anchor):undefined;
    gesture={project,pointer:event.pointerId,button:event.button,alt:event.altKey,start:p,end:p,...hit,anchor:project?project(p):at(p,anchor),mode,dragged:false,origins:hit.origin?[hit.origin]:[...selected]};
    if(['move','range','drive','paint'].includes(mode)||input.picking()) {controls.enabled=false;event.stopImmediatePropagation();canvas.setPointerCapture(event.pointerId);}
  },true);
  function processPointer(){
    inputFrame=0;if(originPick){ghost.visible=true;const pick=originPick,p=lastPoint;if(p){const rect=canvas.getBoundingClientRect();let distance=144;pick.choice=undefined;camera.updateMatrixWorld();for(const slot of pick.slots){const screen=new T.Vector3(...slot).multiplyScalar(scale).project(camera);if(screen.z< -1||screen.z>1)continue;const d=Math.pow(rect.left+(screen.x+1)*rect.width/2-p.x,2)+Math.pow(rect.top+(1-screen.y)*rect.height/2-p.y,2);if(d<distance){distance=d;pick.choice=slot;}}axisView.coordinates(world,activeAxis(),pick.choice,p);}request();return;}if(connectorDrag)return;const p=lastPoint;if(!p)return;const g=gesture;if(!pointerInside&&!g&&!axisPicking){ghost.visible=false;axisView.setCoordinatesVisible(false);return;}
    if(axisPicking){const hit=pointed(p).origin;if(axisPicking.first){const a=locatePosition(axisPicking.first),b=hit&&locatePosition(hit);if(a&&b){try{const first=key(axisPicking.first),second=key(hit!);if(!axisPlanCache||axisPlanCache.world!==world||axisPlanCache.first!==first||axisPlanCache.second!==second)axisPlanCache={world,first,second,plan:planAxis(world,axisPicking.first,hit!,axisPicking.up)};const plan=axisPlanCache.plan;axisView.preview(a,plan.targets.get(key(hit!)),scale);}catch{axisView.preview(a,b,scale,false);}}else axisView.preview(a,xyz(at(p).divideScalar(scale)),scale);}request();return;}
    axisView.setCoordinatesVisible(coordinatesVisible&&(!g||g.mode==='paint'||g.mode==='move'));if(g&&g.mode!=='paint'&&!(g.mode==='move'&&g.landing))ghost.visible=false;
    const frame=activeAxis(),hitPoint=pointed(p).origin;axisView.coordinates(world,frame,hitPoint?locatePosition(hitPoint):frame?xyz(axisPlanePoint(p,frame).divideScalar(scale)):undefined,p);
    if(g){g.end=p;g.dragged ||= Math.hypot(p.x-g.start.x,p.y-g.start.y)>=4;
      if(g.mode==='paint'){if(g.dragged)paintPoint(p);return;}
      if(g.dragged&&g.mode==='move'){
        if(!g.moving){g.resolve=prepareTranslation(world,g.origins);const carried=g.resolve([0,0,0]);g.moving=new Set(carried?.keys()??g.origins.map(key));for(const id of carried?.keys()??g.origins.map(key))relocating.add(id);relocationPin=g.origin?key(g.origin):undefined;presentation();}
        let delta=(g.project?.(p)??at(p,g.anchor)).sub(g.anchor).divideScalar(scale);
        const original=g.origin&&locatePosition(g.origin),snap=original&&nearAxis(p,original.map((n,i)=>n+delta.getComponent(i)) as Vec3);if(snap&&original)delta=new T.Vector3(...snap.point.map((n,i)=>n-original[i]));
        // Same lattice transform used by numerical operation commits; preparation is once per gesture.
        g.resolve??=prepareTranslation(world,g.origins);
        if(gesture!==g)return;let targets:Map<string,Vec3>|undefined;try{targets=snap&&g.origin?planSlotNode(world,g.origin,snap.frame.id,snap.point,g.origins).targets:g.resolve(xyz(delta));}catch{targets=undefined;}
        if(targets){const source=g.origin&&locatePosition(g.origin),target=g.origin&&targets.get(key(g.origin));g.landing={delta:source&&target?target.map((n,i)=>n-source[i]) as Vec3:xyz(delta),frame:snap?.frame.id,point:target};}
        if(targets){const actual=g.origin&&visuals.get(key(g.origin))?.actual,paint=nodePaint(world),color=actual?.color??brightHex(paint.color!,paint.brightness!);ghost.material.color.set(color);updateAtomicCarrier(ghost.material,(actual?.opacity??paint.opacity!)*.7,actual?.translucency??paint.translucency,actual?.glow??paint.glow,actual?.translucencyRadius??paint.translucencyRadius);let index=0;for(const [id,position]of targets)if(visuals.get(id)?.group.visible)ghost.setMatrixAt(index++,new T.Matrix4().makeScale(scale,scale,scale).setPosition(new T.Vector3(...position).multiplyScalar(scale)));ghost.count=index;ghost.instanceMatrix.needsUpdate=true;ghost.visible=index>0;}
        if(g.landing?.point)axisView.coordinates(world,activeAxis(),g.landing.point,p);edges.visible=false;request();return;
      }
      if(g.dragged&&g.mode==='range'){rectangle.hidden=false;Object.assign(rectangle.style,{left:`${Math.min(g.start.x,p.x)}px`,top:`${Math.min(g.start.y,p.y)}px`,width:`${Math.abs(p.x-g.start.x)}px`,height:`${Math.abs(p.y-g.start.y)}px`});return;}
      if(g.dragged&&g.mode==='view')return;
    }
    if(connectionSource){
      if(!input.picking()){connectionSource=undefined;connectionLine.visible=false;request();}
      else {const source=visuals.get(key(connectionSource)),hit=pointed(p).origin,target=hit&&visuals.get(key(hit));if(source){const start=displayed(source),end=target?displayed(target):at(p,start);const positions=connectionLine.geometry.getAttribute('position') as T.BufferAttribute;positions.setXYZ(0,start.x,start.y,start.z);positions.setXYZ(1,end.x,end.y,end.z);positions.needsUpdate=true;connectionLine.visible=true;request();}return;}
    }
    if(drive.active){aimNavigator(p);return;}
    if(pointerAlt&&!input.picking()){
      if(!altPreview){const context=paintContext(p,pointerShift),paint=nodePaint(world),preview=new T.InstancedMesh(sphere,atomicCarrierMaterial(brightHex(paint.color!,paint.brightness!),paint.opacity!*.7,paint.translucency,paint.glow,paint.translucencyRadius),4000);preview.count=0;preview.frustumCulled=false;scene.add(preview);stroke={session:context.session,project:context.project,axis:context.frame,previous:context.project(p),preview};altPreview=true;}
      paintPoint(p);return;
    }
    if(altPreview){finishPaint(true);altPreview=false;}
    if(creating&&!hitPoint&&!input.picking()){const signature=JSON.stringify([world.activeAxis,camera.quaternion.toArray(),pointerAlt,pointerShift]);if(!hoverPaint||hoverPaint.world!==world||hoverPaint.signature!==signature)hoverPaint={world,signature,session:paintContext(p,!pointerAlt||pointerShift).session};const position=activeAxis()?xyz(axisPlanePoint(p,activeAxis()!).divideScalar(scale)):xyz(at(p).divideScalar(scale));showGhost(hoverPaint.session.candidate(position));request();}else {ghost.visible=false;hoverCandidate=undefined;axisView.brushCoordinates(world,activeAxis(),[],scale,camera,coordinatesVisible);}
    if(!input.picking())aimNavigator(p);
    const hit=pointed(p);hover=hit.origin?key(hit.origin):undefined;
  }
  window.addEventListener('keyup',event=>{if(event.key==='Alt'){pointerAlt=false;if(altPreview){finishPaint(true);altPreview=false;}request();}});
  canvas.addEventListener('pointerleave',()=>{pointerInside=false;if(!gesture){ghost.visible=false;hoverCandidate=undefined;axisView.setCoordinatesVisible(false);request();}});
  canvas.addEventListener('pointerenter',()=>{pointerInside=true;axisView.setCoordinatesVisible(coordinatesVisible);});
  canvas.addEventListener('pointermove',event=>{pointerAlt=event.altKey;pointerShift=event.shiftKey;lastPoint={x:event.clientX,y:event.clientY};if(connectorDrag?.pointer===event.pointerId){const end=connectorDrag.project({x:event.clientX,y:event.clientY}),positions=connectorDrag.line.geometry.getAttribute('position') as T.BufferAttribute;positions.setXYZ(1,end.x,end.y,end.z);positions.needsUpdate=true;connectorDrag.line.geometry.computeBoundingSphere();request();return;}if(navigation.move(event))return;if(omnicGesture&&omnicGesture.id===event.pointerId){const point=editPoint(event,omnicGesture.surface);if(point)omnicGesture.surface.move(point,event);return;}if(omnic?.origin){const point=editPoint(event,omnic,true);omnic.hover?.(!!point);if(point)omnic.move(point,event);}lastPoint={x:event.clientX,y:event.clientY};if(!inputFrame)inputFrame=requestAnimationFrame(()=>{void processPointer();});});
  canvas.addEventListener('pointerup',event=>{
    if(originPick?.pointer===event.pointerId){const pick=originPick;if(pick.choice)input.origin(pick.id,pick.choice);originPick=undefined;ghost.visible=false;event.preventDefault();event.stopImmediatePropagation();request();return;}
    if(axisPicking?.pointer===event.pointerId){const origin=pointed({x:event.clientX,y:event.clientY}).origin;axisPicking.pointer=undefined;if(origin){if(!axisPicking.first){axisPicking.first=origin;input.feedback('Choose the second axis node · Esc cancels');}else try{input.axis(axisPicking.first,origin,axisPicking.up);axisPicking=undefined;axisView.preview();input.feedback('');}catch(error){input.feedback(error instanceof Error?error.message:String(error));}}return;}
    if(connectorDrag?.pointer===event.pointerId&&connectorDrag.button===event.button){const drag=connectorDrag,p={x:event.clientX,y:event.clientY},end=drag.project(p),target=pointed(p,new Set([key(drag.source)])).origin;cancelConnector();try{if(connectorDragged(drag.start,p))input.connectDrag(drag.source,target,xyz(end.divideScalar(scale)));else if(event.button===0)input.connect(drag.source);else input.menu(drag.source,p,creationPoint(p));}catch(error){input.feedback(error instanceof Error?error.message:String(error));}return;}

    if(navigation.acceptsRelease(event)&&navigation.finish()){secondary.cancel();secondarySurface=undefined;cancelOmnic();gesture=undefined;axisView.setCoordinatesVisible(coordinatesVisible);if(lastPoint)processPointer();request();return;}
    if(omnicGesture&&omnicGesture.id===event.pointerId){const gesture=omnicGesture,point=editPoint(event,gesture.surface);if(!(event.buttons&1)){omnicGesture=undefined;controls.enabled=!drive.active;}if(point)gesture.surface.up(point,event);else gesture.surface.cancel();if(event.button===2&&secondarySurface){secondarySurface.released=true;if(secondarySurface.context)secondarySurface=undefined;}request();return;}
    if(gesture?.mode==='move'&&gesture.pointer===event.pointerId){if(inputFrame)cancelAnimationFrame(inputFrame);lastPoint={x:event.clientX,y:event.clientY};processPointer();}
    const g=gesture;if(!g||g.pointer!==event.pointerId)return;if(g.mode==='move')ghost.visible=false;g.end={x:event.clientX,y:event.clientY};g.dragged ||= Math.hypot(g.end.x-g.start.x,g.end.y-g.start.y)>=4;gesture=undefined;rectangle.hidden=true;edges.visible=true;controls.enabled=!drive.active;
    try{
      if(g.mode==='paint'){paintPoint(g.end);finishPaint();return;}
      if(g.dragged&&g.mode==='move'){
        g.moving??=new Set((prepareTranslation(world,g.origins)([0,0,0]))?.keys()??g.origins.map(key));
        const landing=g.landing;if(!landing)return;
        if(landing.frame&&g.origin&&landing.point)input.slot(g.origins,landing.frame,landing.point);else input.move(g.origins,landing.delta);return;
      }
      if(g.dragged&&g.mode==='range'){
        const rect=canvas.getBoundingClientRect(),origins:Origin[]=[];
        for(const visual of visuals.values()){if(!visual.group.visible)continue;const p=displayed(visual).project(camera),x=rect.left+(p.x+1)/2*rect.width,y=rect.top+(1-p.y)/2*rect.height;if(p.z>=-1&&p.z<=1&&x>=Math.min(g.start.x,g.end.x)&&x<=Math.max(g.start.x,g.end.x)&&y>=Math.min(g.start.y,g.end.y)&&y<=Math.max(g.start.y,g.end.y))origins.push(visual.node.origin);}input.range(origins,true);return;
      }
      if(g.dragged){secondary.cancel();return;}
      if(event.button===2){const position=creationPoint(g.end);secondary.release(()=>{cancelDrive();input.menu(g.origin,g.end,position,g.edge);})?.();return;}
      if(g.axis&&!g.origin){input.focusAxis(g.axis);return;}
      if(g.edge){cancelDrive();input.edge(g.edge);return;}
      if(input.picking()){if(g.origin)input.pick(g.origin,false,false);return;}
      if(g.mode==='range'){cancelDrive();if(g.origin)input.pick(g.origin,true,true);return;}
      if(event.shiftKey){if(g.origin)input.connect(g.origin);return;}
      if(drive.active){relocationPin=drive.id;const parked=drive.park(!!g.origin);if(!parked){input.feedback('Choose a free lattice cell to park. Esc cancels.');return;}mountedWorld=undefined;controls.enabled=true;navigatorOffset.set(0,0,0);rebuildPicks();input.feedback('');if(g.origin&&g.alt)mount(g.origin,g.end);return;}
      if(g.origin){input.pick(g.origin,false,false);input.subtree(g.origin,g.alt);}else{navigator.initialize(controls.target);navigator.position.copy(at(g.end,navigator.position));navigatorOffset.set(0,0,0);}
    }catch(error){gesture=g;restore();input.feedback(error instanceof Error?error.message:String(error));}
    finally{if(relocating.size||g.mode==='drive'){relocating.clear();presentation();}else request();}
  });
  canvas.addEventListener('dblclick',event=>event.preventDefault());
  canvas.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();if(secondarySurface){const pending=secondarySurface;pending.context=true;const point=editPoint(event,pending.surface);if(point)pending.surface.context(point,event);if(pending.released)secondarySurface=undefined;}else secondary.context()?.();});
  canvas.addEventListener('pointercancel',()=>{navigation.finish(true);secondary.cancel();secondarySurface=undefined;cancelOmnic();restore();cancelDrive();});
  canvas.addEventListener('lostpointercapture',()=>{cancelOmnic();if(gesture?.mode!=='view')restore();});
  canvas.addEventListener('pointerleave',()=>{hover=undefined;presentation();});
  window.addEventListener('blur',()=>{secondary.cancel();secondarySurface=undefined;nudging.finish(true);navigation.finish(true);restoreNative();rebind();cancelOmnic();restore();cancelDrive();held.clear();});
  const cameraHistory:{position:T.Vector3;target:T.Vector3;up:T.Vector3;pov?:Origin;depth?:number;returnView?:{position:number[];target:number[];up:number[]}}[]=[];
  const remember=()=>{cameraHistory.push({position:camera.position.clone(),target:controls.target.clone(),up:camera.up.clone(),pov:pointOfView,depth:nodeViewDepth,returnView:userView?{position:userView.position,target:userView.target,up:userView.up}:undefined});if(cameraHistory.length>50)cameraHistory.shift();};
  type Pose={position:number[];target:number[];up:number[];pov?:Origin;depth?:number;returnView?:{position:number[];target:number[];up:number[]}};
  const pose=():Pose=>({position:camera.position.toArray(),target:controls.target.toArray(),up:camera.up.toArray(),pov:pointOfView,depth:nodeViewDepth,returnView:userView?{position:userView.position,target:userView.target,up:userView.up}:undefined});
  const recordCamera=(before:Pose,group?:string)=>universalHistory.record('world.camera',before,pose(),['camera'],universalHistory.contextPath,group);
  let nativeBefore:Pose|undefined,nativeWheel=false;
  function restoreNative(){if(!nativeBefore)return;const value=nativeBefore;nativeBefore=undefined;pointOfView=value.pov;nodeViewDepth=value.depth;userView=value.returnView;camera.position.fromArray(value.position);camera.up.fromArray(value.up);controls.target.fromArray(value.target);camera.lookAt(controls.target);update(world,selected,filter,selectedEdges);}
  const nativeStart=()=>{nativeBefore??=pose();if(pointOfView){pointOfView=undefined;update(world,selected,filter,selectedEdges);}};
  const nativeEnd=()=>{if(nativeBefore){recordCamera(nativeBefore,nativeWheel?'camera.wheel':undefined);nativeBefore=undefined;}};
  function rebind(){controls=rebindOrbitControls(camera,canvas,controls);controls.addEventListener('change',request);controls.addEventListener('start',nativeStart);controls.addEventListener('end',nativeEnd);}
  controls.addEventListener('start',nativeStart);controls.addEventListener('end',nativeEnd);
  canvas.addEventListener('wheel',()=>{nativeWheel=true;},{capture:true,passive:true});
  universalHistory.register('world.camera',{read:pose,write:(value:Pose)=>{
    if(![value.position,value.target,value.up].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)))throw Error('Invalid camera history.');
    navigation.finish(true);cancelDrive();nativeBefore=undefined;
    pointOfView=value.pov;nodeViewDepth=value.depth;userView=value.returnView;camera.position.fromArray(value.position);camera.up.fromArray(value.up);controls.target.fromArray(value.target);camera.lookAt(controls.target);rebind();update(world,selected,filter,selectedEdges);request();
  }});
  const navigation=createNavigationGesture({camera,scene,canvas,target:()=>controls.target,nodes:()=>visuals,
    document:()=>doc,displayPosition:id=>{const v=visuals.get(id);return v?point(xyz(displayed(v))):undefined;},viewRevision:()=>pushRevision,coordinates:()=>new Map([...grid.cells].map(([id,p])=>[id,cellPoint(p,scale)])),
    prepareLayout:ids=>prepareLatticeTransform(doc,ids,1,scale),selection:()=>selectedKeys,
    pointed:event=>{const hit=pointed({x:event.clientX,y:event.clientY});return hit.origin?key(hit.origin):undefined;},
    request,enabled:value=>{controls.enabled=value&&!drive.active;},rebind,feedback:input.feedback,
    commit:(ids,rotation,pivot,layout)=>input.transform(ids.map(id=>visuals.get(id)!.node.origin),rotation,{x:pivot.x/scale,y:pivot.y/scale,z:pivot.z/scale},layout),
    remember:before=>{cameraHistory.push({...before,pov:pointOfView,depth:nodeViewDepth,returnView:userView?{position:userView.position,target:userView.target,up:userView.up}:undefined});if(cameraHistory.length>50)cameraHistory.shift();recordCamera({position:before.position.toArray(),target:before.target.toArray(),up:before.up.toArray(),pov:pointOfView,depth:nodeViewDepth,returnView:userView?{position:userView.position,target:userView.target,up:userView.up}:undefined});},distanceLimits:()=>({min:controls.minDistance,max:controls.maxDistance}),
  });
  function cameraAction(action:CameraAction){
    if(action==='settings'){input.navigationSettings();return;}
    navigation.finish(true);cancelDrive();const before=pose();
    if(action==='back'){const pose=cameraHistory.pop();if(pose){pointOfView=pose.pov;nodeViewDepth=pose.depth;userView=pose.returnView;camera.position.copy(pose.position);camera.up.copy(pose.up);controls.target.copy(pose.target);update(world,selected,filter,selectedEdges);}}
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
  function applyNodeView(origin:Origin,next:{position:Vec3;target:Vec3;up:Vec3},useOriginPlane=false){const before=pose();if(!pointOfView)userView=before;remember();pointOfView=origin;nodeViewDepth=useOriginPlane?0:new T.Vector3(...next.position).distanceTo(new T.Vector3(...next.target));camera.position.set(...next.position).multiplyScalar(scale);controls.target.set(...next.target).multiplyScalar(scale);camera.up.set(...next.up);camera.lookAt(controls.target);ghost.visible=false;axisView.setCoordinatesVisible(false);rebind();update(world,selected,filter,selectedEdges);recordCamera(before);canvas.focus();request();}
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
  return { update,session,point:creationPoint,center:()=>hoverCandidate?.valid?hoverCandidate.anchor:navigator.initialized?xyz(navigator.position.clone().divideScalar(scale)):xyz(controls.target.clone().divideScalar(scale)),request,
    editOmnic(surface:OmnicSurface){if(omnic!==surface){cancelOmnic();omnic=surface;request();}return()=>{if(omnic===surface){cancelOmnic();omnic=undefined;request();}};},
    focusInput(){canvas.focus();},
    get inputContext(){return originPick?'origin':axisPicking?(axisPicking.first?'axis-second':'axis-first'):creating?'create':'world';},
    pickOrigin(){if(originPick){originPick=undefined;ghost.visible=false;request();return;}const frame=activeAxis();if(!frame){input.feedback('Select an axis first.');return;}const slots=originSlots(world,frame);originPick={id:frame.id,slots};ghost.visible=true;ghost.count=slots.length;ghost.material.color.set('#00d8ff');updateAtomicCarrier(ghost.material,.8,0,0,1);slots.forEach((p,i)=>ghost.setMatrixAt(i,new T.Matrix4().makeScale(scale*.2,scale*.2,scale*.2).setPosition(new T.Vector3(...p).multiplyScalar(scale))));ghost.instanceMatrix.needsUpdate=true;request();},
    toggleCreation(){originPick=undefined;creating=!creating;if(stroke)finishPaint(true);hoverPaint=undefined;hoverCandidate=undefined;ghost.visible=false;if(creating){cancelDrive();if(lastPoint)processPointer();}else axisView.brushCoordinates(world,activeAxis(),[],scale,camera,coordinatesVisible);request();return creating;},
    get canCreate(){return !hoverCandidate||hoverCandidate.valid;},
    toggleCoordinates(){coordinatesVisible=!coordinatesVisible;axisView.setCoordinatesVisible(coordinatesVisible);if(lastPoint)processPointer();request();},
    stamp(){if(hoverCandidate?.valid)input.paint(hoverCandidate.stamp,undefined,activeAxis()?.id);else input.feedback('Choose a free brush placement.');},
    mountHovered(){const origin=pointerInside&&lastPoint?pointed(lastPoint).origin:undefined;if(!origin)return false;const frame=activeAxis(),target=frame?axisCenter(world,frame):selected[0]&&locatePosition(selected[0]);if(!target){input.feedback('Select an origin first.');return true;}try{applyNodeView(origin,nodeOriginView(locatePosition(origin)!,target,xyz(camera.up)),true);}catch(error){input.feedback(error instanceof Error?error.message:String(error));}return true;},
    get inNodeView(){return !!pointOfView;},
    enterNode(origin:Origin,id:string){const relation=world.axes?.find(frame=>frame.id===id);if(relation)applyNodeView(origin,endpointView(world,relation,origin));},
    leaveNode(){if(!userView)return;const before=pose(),next=userView;remember();pointOfView=undefined;nodeViewDepth=undefined;userView=undefined;camera.position.fromArray(next.position);camera.up.fromArray(next.up);controls.target.fromArray(next.target);camera.lookAt(controls.target);rebind();update(world,selected,filter,selectedEdges);recordCamera(before);canvas.focus();request();},
    frameBasis(){return {right:xyz(new T.Vector3(1,0,0).applyQuaternion(camera.quaternion)),up:xyz(new T.Vector3(0,1,0).applyQuaternion(camera.quaternion))};},
    startAxis(){axisPlanCache=undefined;ghost.visible=false;axisView.setCoordinatesVisible(false);navigation.finish(true);restore();cancelDrive();axisView.preview();axisPicking={up:xyz(new T.Vector3(0,1,0).applyQuaternion(camera.quaternion))};canvas.focus();input.feedback('Choose two nodes for an axis · Esc cancels');},
    focusAxis(){const before=pose();remember();const previous=pointOfView;pointOfView=undefined;nodeViewDepth=undefined;userView=undefined;if(previous)update(world,selected,filter,selectedEdges);ghost.visible=false;axisView.setCoordinatesVisible(false);const axis=activeAxis();if(!axis)return false;const next=axisPose(world,axis,scale,camera,{min:controls.minDistance,max:controls.maxDistance});camera.position.copy(next.position);camera.up.copy(next.up);controls.target.copy(next.target);camera.lookAt(next.target);rebind();recordCamera(before);canvas.focus();request();return true;},
    connect(origin:Origin){cancelDrive();connectionSource=origin;connectionLine.visible=false;request();},
    cancel(){const wasCreating=creating||!!originPick||altPreview;originPick=undefined;altPreview=false;creating=false;ghost.visible=false;hoverCandidate=undefined;const active=wasCreating||!!axisPicking||!!connectionSource||navigation.active||cancelOmnic()||!!gesture||drive.active||!!connectorDrag;axisPicking=undefined;axisView.preview();connectionSource=undefined;connectionLine.visible=false;navigation.finish(true);nudging.finish(true);restore();cancelDrive();held.clear();return active;},
    variants(origin:Origin, enabled?:boolean){const id=key(origin);if(enabled===true)variants.add(id);else if(variants.has(id))variants.delete(id);else variants.add(id);update(world,selected,filter,selectedEdges);},
    camera:cameraAction,showCamera(){hud.show();request();return {root:hud.root,close:hud.close};},
    previewColor(origins:readonly Origin[],color:string){for(const origin of origins)visuals.get(key(origin))?.body.material.color.set(color);request();},
    focus(origins:readonly Origin[],fit=false){const before=pose();remember();const previous=pointOfView;pointOfView=undefined;nodeViewDepth=undefined;userView=undefined;if(previous)update(world,selected,filter,selectedEdges);ghost.visible=false;axisView.setCoordinatesVisible(false);const points=origins.map(origin=>{const v=visuals.get(key(origin));return v?displayed(v):undefined;}).filter((p):p is T.Vector3=>!!p);if(!points.length)return;const center=points.reduce((sum,p)=>sum.add(p),new T.Vector3()).divideScalar(points.length),shift=center.clone().sub(controls.target);camera.position.add(shift);controls.target.copy(center);if(fit){const radius=Math.max(2*scale,...points.map(p=>p.distanceTo(center)));camera.position.copy(center).add(camera.getWorldDirection(new T.Vector3()).multiplyScalar(-radius/Math.tan(T.MathUtils.degToRad(camera.fov/2))*1.4));}controls.update();recordCamera(before);canvas.focus();request();},
  };
}
