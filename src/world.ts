import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { prepareWorld, sameOrigin, type Origin, type Structure, type Vec3, type World } from './core/model.ts';
import { geometry, lattice, inherited, prepareTranslation, address as key, point, vector } from './core/lattice.ts';
import { cellAt, cellPoint } from './graph/lattice.ts';
import { atomicCarrierGeometry, atomicCarrierMaterial, updateAtomicCarrier } from './atomicCarrier.ts';
import { analyticSelectionRing } from './materialCoverage.ts';
import { SPHERE_VISUAL_DEFAULTS as defaults } from './properties/sphereVisualDefaults.ts';
import { createWorldNavigator } from './navigation/worldNavigator.ts';
import { createNavigatorDrive } from './navigation/navigatorDrive.ts';
import { createWorldNavigatorMarker } from './worldNavigatorMarker.ts';
import { expansionState, toggleContent, contentExpanded } from './graph/nodePresentation.ts';
import { latticeFrame } from './latticeField.ts';
import { visualObject, disposeVisual } from './visualScene.ts';
import { paintSamples } from './omnic/paintStroke.ts';
import { createPipeline } from './world/render.ts';
import { label, disposeLabel } from './world/labels.ts';
import { createSceneSession } from './scene/session.ts';
import type { Document } from './graph/geometryTypes.ts';
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
  expand: (origin: Origin) => void; edge: (edge: Edge) => void;
  feedback: (message: string) => void; picking: () => boolean };
type Visual = { node: Structure; actual: Structure; anchor: T.Vector3; group: T.Group;
  body: T.Mesh<T.SphereGeometry, T.MeshPhongMaterial>; slot: T.Mesh; ring: T.Mesh; text: T.Sprite; caption: string; object?: T.Group; visualKey?: string };
const xyz = (v: T.Vector3): Vec3 => [v.x, v.y, v.z];

export function createWorld(host: HTMLElement, input: Input) {
  const renderer = new T.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true }); renderer.setClearColor('#101113');
  const canvas = renderer.domElement; canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Omnium lattice world'); host.append(canvas);
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(45, 1, .00001, 100000);
  camera.position.set(12, 8, 40);
  const controls = new OrbitControls(camera, canvas); controls.enableDamping = false; controls.minDistance = .01; controls.maxDistance = 30000;
  controls.mouseButtons = { LEFT: T.MOUSE.PAN, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.ROTATE }; controls.update();
  scene.add(new T.HemisphereLight('#ffffff', '#242728', 2));
  const light = new T.DirectionalLight('#ffffff', 3); light.position.set(10, 20, 40); scene.add(light);
  const sphere = atomicCarrierGeometry(), slotMaterial = new T.MeshBasicMaterial({ visible: false });
  const ringGeometry = new T.RingGeometry(.835, 1.125, 48), ringMaterial = new T.MeshBasicMaterial({ color: '#ffb000', transparent: true, side: T.DoubleSide, depthWrite: false, depthTest: false }); analyticSelectionRing(ringMaterial);
  const visuals = new Map<string, Visual>(), ray = new T.Raycaster(), edges = new T.Group(); scene.add(edges);
  const retained = expansionState(), variants = new Set<string>(), navigator = createWorldNavigator(), marker = createWorldNavigatorMarker(); scene.add(marker.object);
  const rectangle = document.createElement('div'); rectangle.className = 'marquee'; rectangle.hidden = true; host.append(rectangle);
  let world: World, doc: Document, prepared: ReturnType<typeof prepareWorld>, grid: ReturnType<typeof lattice>;
  let selected: readonly Origin[] = [], selectedEdges: readonly Edge[] = [], filter: ReadonlySet<string> | undefined;
  let scale = 1, frame = 0, inputFrame = 0, hover: string | undefined, lastPoint: Point | undefined, picks: T.Object3D[] = [];
  let mountedWorld: World | undefined;
  const drive = createNavigatorDrive({ hosts: () => visuals,
    commit(id, position) { const result = input.park(visuals.get(id)!.node.origin, vector({x:position.x / scale,y:position.y / scale,z:position.z / scale})); return geometry(result); },
  });
  const pipeline = createPipeline(renderer, scene, camera, request), session = createSceneSession(pipeline.wallpaper, input.feedback);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function request() {
    if (frame) return;
    frame = requestAnimationFrame(now => {
      frame = 0;
      const pulse = reduced.matches ? 1 : 1 + .04 * Math.sin(now * .004);
      for (const visual of visuals.values()) { visual.ring.quaternion.copy(camera.quaternion); visual.ring.scale.setScalar(scale / 2 * pulse); }
      for (const child of edges.children) if (child instanceof T.Sprite && child.userData.ends) {
        const [a,b] = child.userData.ends as T.Vector3[], p = a.clone().project(camera), q = b.clone().project(camera);
        let angle = Math.atan2((q.x - p.x) * camera.aspect, q.y - p.y); const reversed = angle > Math.PI / 2 || angle < -Math.PI / 2;
        if (reversed) angle += angle > 0 ? -Math.PI : Math.PI; child.material.rotation = angle; child.center.set(reversed ? 1 : 0, .5);
      }
      navigator.orientation.copy(camera.quaternion); marker.update(navigator.position, navigator.orientation, scale, navigator.initialized, drive.valid);
      pipeline.render();
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
    for (const [id, visual] of visuals) {
      const chosen = selected.some(origin => sameOrigin(origin, visual.node.origin));
      const expanded = chosen || contentExpanded(retained, id, false);
      visual.body.visible = !expanded; visual.ring.visible = chosen;
      visual.text.visible = (expanded || hover === id || world.settings?.names === 'all') && visual.actual.visual?.showText !== false;
      if (world.settings?.names === 'selection' && !chosen && !expanded) visual.text.visible = false;
      if (visual.object) visual.object.visible = expanded || hover === id;
      visual.text.position.y = visual.object ? -((visual.actual.visual?.size ?? 1.4) + visual.text.scale.y) / 2 - .15 : 0;
    }
    rebuildPicks(); request();
  }
  function clearEdges() {
    for (const child of [...edges.children]) {
      if (child instanceof T.Sprite) disposeLabel(child); else { const item = child as T.Line; item.geometry?.dispose(); for (const m of Array.isArray(item.material) ? item.material : [item.material]) m.dispose(); }
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
    if (text) { const caption = label(text); caption.scale.multiplyScalar(.65); caption.position.copy(a.clone().add(b).multiplyScalar(.5)); caption.userData.edge = edge; caption.userData.ends=[a,b]; edges.add(caption); }
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
    if (drive.active && (next !== mountedWorld || !selection.some(origin => key(origin) === drive.id))) cancelDrive();
    if (world !== next) { prepared = prepareWorld(next); doc = geometry(next); grid = lattice(next); }
    world = next; selected = selection; selectedEdges = edgeSelection; filter = visible;
    const nextScale = next.settings?.latticeScale ?? 1;
    if (nextScale !== scale) { const shift = controls.target.clone().multiplyScalar(nextScale/scale-1); controls.target.add(shift); camera.position.add(shift); navigator.rescale(nextScale/scale); scale=nextScale; controls.minDistance=scale*.01; camera.near=Math.max(1e-9,scale*.001); camera.updateProjectionMatrix(); controls.update(); }
    const present = new Set(next.nodes.map(node => key(node.origin)));
    for (const [id, visual] of visuals) if (!present.has(id)) { scene.remove(visual.group); visual.body.material.dispose(); disposeLabel(visual.text); if (visual.object) disposeVisual(visual.object); visuals.delete(id); }
    for (const node of next.nodes) {
      const actual = inherited(node,next), id=key(node.origin), caption=`${actual.label || (node.invariant ? '⚬' : '•')}${node.parts.some(binding => !prepared.resolve(binding).length) ? ' !' : ''}`;
      let visual=visuals.get(id);
      if (!visual) {
        const group=new T.Group(),body=new T.Mesh(sphere,atomicCarrierMaterial(actual.color)),slot=new T.Mesh(sphere,slotMaterial),ring=new T.Mesh(ringGeometry,ringMaterial),text=label(caption);
        ring.renderOrder=1; group.add(body,slot,ring,text);scene.add(group);visual={node,actual,anchor:group.position,group,body,slot,ring,text,caption};visuals.set(id,visual);
      }
      if (visual.caption!==caption) { visual.group.remove(visual.text);disposeLabel(visual.text);visual.text=label(caption);visual.group.add(visual.text);visual.caption=caption; }
      const visualKey=JSON.stringify(actual.visual ?? null);
      if (visual.visualKey!==visualKey) {
        if (visual.object) {visual.group.remove(visual.object);disposeVisual(visual.object);visual.object=undefined;}
        if (actual.visual?.assetId || actual.visual?.character) {visual.object=visualObject(actual.visual,next.assets??[],label,request);visual.object.scale.setScalar(actual.visual.size??1.4);visual.object.userData.origin=node.origin;visual.group.add(visual.object);}
        visual.visualKey=visualKey;
      }
      visual.node=node;visual.actual=actual;visual.group.position.copy(new T.Vector3(...vector(cellPoint(grid.cells.get(id)!,scale))));
      visual.body.scale.setScalar(scale);visual.slot.scale.setScalar(scale);visual.body.material.color.set(actual.color);
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
  type Gesture={pointer:number;button:number;alt:boolean;start:Point;end:Point;origin?:Origin;edge?:Edge;anchor:T.Vector3;mode:'move'|'range'|'view'|'drive'|'paint';dragged:boolean;origins:readonly Origin[];moving?:Set<string>;resolve?:ReturnType<typeof import('./core/lattice.ts').prepareTranslation>};
  let gesture:Gesture|undefined;
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
    if(event.button!==0&&event.button!==2)return;
    const p={x:event.clientX,y:event.clientY},hit=pointed(p),range=event.button===0&&(event.shiftKey||event.ctrlKey||event.metaKey),moving=event.button===0&&!!hit.origin&&!range&&!drive.active&&!input.picking();
    let mode:Gesture['mode']=drive.active&&event.button===0?'drive':range?'range':moving?'move':'view';
    if(event.button===0&&event.altKey&&!input.picking()){
      cancelDrive();mode='paint';const actual=hit.origin&&visuals.get(key(hit.origin))?.actual;
      const preview=new T.InstancedMesh(sphere,atomicCarrierMaterial(actual?.color??defaults.color,actual?.opacity??defaults.opacity,actual?.translucency??defaults.translucency,actual?.glow??defaults.glow,actual?.translucencyRadius??defaults.translucencyRadius),256);preview.count=0;preview.frustumCulled=false;scene.add(preview);
      stroke={points:[],seen:new Set(),previous:creationPoint(p),source:hit.origin,preview};
    }
    if(moving&&!event.altKey&&!selected.some(origin=>sameOrigin(origin,hit.origin!)))input.pick(hit.origin!,false,false);
    const anchor=hit.origin?visuals.get(key(hit.origin))!.group.position:controls.target;
    gesture={pointer:event.pointerId,button:event.button,alt:event.altKey,start:p,end:p,...hit,anchor:at(p,anchor),mode,dragged:false,origins:[...selected]};
    if(['move','range','drive','paint'].includes(mode)||input.picking()) {controls.enabled=false;event.stopImmediatePropagation();canvas.setPointerCapture(event.pointerId);}
  },true);
  function processPointer(){
    inputFrame=0;const p=lastPoint;if(!p)return;const g=gesture;
    if(g){g.end=p;g.dragged ||= Math.hypot(p.x-g.start.x,p.y-g.start.y)>=4;
      if(g.mode==='paint'){if(g.dragged)paintPoint(p);return;}
      if(g.dragged&&g.mode==='move'){
        const delta=at(p,g.anchor).sub(g.anchor).divideScalar(scale);
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
  canvas.addEventListener('pointermove',event=>{lastPoint={x:event.clientX,y:event.clientY};if(!inputFrame)inputFrame=requestAnimationFrame(()=>{void processPointer();});});
  canvas.addEventListener('pointerup',event=>{
    const g=gesture;if(!g||g.pointer!==event.pointerId)return;g.end={x:event.clientX,y:event.clientY};g.dragged ||= Math.hypot(g.end.x-g.start.x,g.end.y-g.start.y)>=4;gesture=undefined;rectangle.hidden=true;edges.visible=true;controls.enabled=!drive.active;
    try{
      if(g.mode==='paint'){if(g.dragged){paintPoint(g.end);finishPaint();return;}finishPaint(true);}
      if(g.dragged&&g.mode==='move'){
        g.moving??=new Set(branch(world,g.origins).map(key));
        const target=pointed(g.end,g.moving).origin,delta=xyz(at(g.end,g.anchor).sub(g.anchor).divideScalar(scale));
        if(target)input.adopt(g.origins,target,delta);else input.move(g.origins,delta);return;
      }
      if(g.dragged&&g.mode==='range'){
        const rect=canvas.getBoundingClientRect(),origins:Origin[]=[];
        for(const visual of visuals.values()){if(!visual.group.visible)continue;const p=visual.group.position.clone().project(camera),x=rect.left+(p.x+1)/2*rect.width,y=rect.top+(1-p.y)/2*rect.height;if(p.z>=-1&&p.z<=1&&x>=Math.min(g.start.x,g.end.x)&&x<=Math.max(g.start.x,g.end.x)&&y>=Math.min(g.start.y,g.end.y)&&y<=Math.max(g.start.y,g.end.y))origins.push(visual.node.origin);}input.range(origins,true);return;
      }
      if(g.dragged)return;
      if(event.button===2){cancelDrive();input.menu(g.origin,g.end,creationPoint(g.end),g.edge);return;}
      if(g.edge){cancelDrive();input.edge(g.edge);return;}
      if(input.picking()){if(g.origin)input.pick(g.origin,false,false);return;}
      if(event.ctrlKey||event.metaKey){cancelDrive();if(g.origin)navigator.position.copy(visuals.get(key(g.origin))!.group.position);else navigator.position.set(...creationPoint(g.end)).multiplyScalar(scale);navigator.initialize(navigator.position);navigatorOffset.set(0,0,0);return;}
      if(event.shiftKey){if(g.origin)input.pick(g.origin,true,false);return;}
      if(drive.active){const parked=drive.park(!!g.origin);if(!parked){input.feedback('Choose a free lattice cell to park. Esc cancels.');return;}mountedWorld=undefined;controls.enabled=true;navigatorOffset.set(0,0,0);rebuildPicks();input.feedback('');if(g.origin&&g.alt)mount(g.origin,g.end);return;}
      if(g.origin){if(g.alt)mount(g.origin,g.end);}else{navigator.initialize(controls.target);navigator.position.copy(at(g.end,navigator.position));navigatorOffset.set(0,0,0);}
    }catch(error){gesture=g;restore();input.feedback(error instanceof Error?error.message:String(error));}
    finally{request();}
  });
  canvas.addEventListener('dblclick',event=>{const hit=pointed({x:event.clientX,y:event.clientY});if(hit.origin){cancelDrive();toggleContent(retained,key(hit.origin),false);input.expand(hit.origin);presentation();}});
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  canvas.addEventListener('pointercancel',()=>{restore();cancelDrive();});
  canvas.addEventListener('lostpointercapture',()=>{if(gesture?.mode!=='view')restore();});
  canvas.addEventListener('pointerleave',()=>{hover=undefined;presentation();});
  window.addEventListener('blur',()=>{restore();cancelDrive();held.clear();});
  const held=new Set<string>();let stepFrame=0,stepAt=0;
  function depthStep(now:number){stepFrame=0;if(!held.size)return;if(!stepAt||now-stepAt>=110){stepAt=now;navigator.initialize(controls.target);navigator.orientation.copy(camera.quaternion);navigator.depth((held.has('ArrowUp')?-1:1)*scale);if(lastPoint)aimNavigator(lastPoint);request();}stepFrame=requestAnimationFrame(depthStep);}
  canvas.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();if(!event.repeat){held.add(event.key);if(!stepFrame)stepFrame=requestAnimationFrame(depthStep);}}});
  window.addEventListener('keyup',event=>{held.delete(event.key);if(!held.size)stepAt=0;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){held.clear();cancelDrive();}else request();});
  return { update,session,point:creationPoint,center:()=>navigator.initialized?xyz(navigator.position.clone().divideScalar(scale)):xyz(controls.target.clone().divideScalar(scale)),request,
    cancel(){const active=!!gesture||drive.active;restore();cancelDrive();held.clear();return active;},
    variants(origin:Origin, enabled?:boolean){const id=key(origin);if(enabled===true)variants.add(id);else if(variants.has(id))variants.delete(id);else variants.add(id);update(world,selected,filter,selectedEdges);},
    previewColor(origins:readonly Origin[],color:string){for(const origin of origins)visuals.get(key(origin))?.body.material.color.set(color);request();},
    focus(origins:readonly Origin[],fit=false){const points=origins.map(origin=>visuals.get(key(origin))?.group.position).filter((p):p is T.Vector3=>!!p);if(!points.length)return;const center=points.reduce((sum,p)=>sum.add(p),new T.Vector3()).divideScalar(points.length),shift=center.clone().sub(controls.target);camera.position.add(shift);controls.target.copy(center);if(fit){const radius=Math.max(2*scale,...points.map(p=>p.distanceTo(center)));camera.position.copy(center).add(camera.getWorldDirection(new T.Vector3()).multiplyScalar(-radius/Math.tan(T.MathUtils.degToRad(camera.fov/2))*1.4));}controls.update();request();},
  };
}
