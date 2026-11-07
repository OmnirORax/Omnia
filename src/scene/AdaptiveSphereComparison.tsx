import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {atomicCarrierGeometry,atomicCarrierMaterial,updateAtomicCarrier} from '../atomicCarrier.ts';
import {createSphereBackground} from './sphereBlend.ts';
import {createWallpaper} from './wallpaper.ts';
import {createSceneAppearance} from '../sceneAppearance.ts';
import {budgetPixelRatio,RENDER_BUDGET} from '../renderBudget.ts';
import {rendererIdentity,timedSphereFrame,median,type FrameTiming} from './sphereBlendTiming.ts';
import type {WorkspaceSettings} from '../workspaceActions.ts';
import {UIField} from '../ui/UIField';

type Theme=WorkspaceSettings['appearance'];
type Row={count:number;baseline:number;adaptive:number;baselineGPU?:number;adaptiveGPU?:number};
export function AdaptiveSphereComparison({theme,wallpaperURL}:{theme:Theme;wallpaperURL?:string|null}){
 const hosts=useRef<(HTMLDivElement|null)[]>([]),api=useRef<{configure:()=>void;measure:()=>Promise<void>}|null>(null);
 const [enabled,setEnabled]=useState(false),[strength,setStrength]=useState(.65),[pattern,setPattern]=useState(4),[count,setCount]=useState(100),[rows,setRows]=useState<Row[]>([]),[busy,setBusy]=useState(false),[status,setStatus]=useState('Opening comparison…');
 const current=useRef({theme,enabled,strength,pattern,count});current.current={theme,enabled,strength,pattern,count};
 useEffect(()=>{
  setBusy(false);setRows([]);setStatus('Opening comparison…');
  let alive=true,scheduled=0,syncing=false,measuring=false,lastCount=0,resizeEpoch=0;
  const panes:ReturnType<typeof pane>[]=[];
  const request=()=>{if(!alive||measuring||scheduled)return;scheduled=requestAnimationFrame(()=>{scheduled=0;for(const p of panes)p.appearance.render();});};
  function pane(host:HTMLDivElement,index:number){
   const renderer=new THREE.WebGLRenderer({antialias:true});host.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label',index?'Adaptive sphere preview':'Current sphere preview');
   const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,.05,1000);camera.position.set(9,7,13);camera.lookAt(0,0,0);
   scene.add(new THREE.AmbientLight(0xffffff,2.1));const light=new THREE.DirectionalLight(0xffffff,2.2);light.position.set(5,12,9);scene.add(light);
   const background=createSphereBackground(),geometry=atomicCarrierGeometry(),material=atomicCarrierMaterial('#0044ff',1,.82,1,index?background:undefined),mesh=new THREE.InstancedMesh(geometry,material,5000);mesh.frustumCulled=false;scene.add(mesh);
   const appearance=createSceneAppearance(renderer,scene,camera),wallpaper=createWallpaper(scene,request,background),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;
   controls.addEventListener('change',()=>{if(syncing)return;syncing=true;for(const other of panes)if(other.camera!==camera){other.camera.position.copy(camera.position);other.camera.quaternion.copy(camera.quaternion);other.camera.up.copy(camera.up);other.controls.target.copy(controls.target);other.controls.update();}syncing=false;request();});
   return {renderer,scene,camera,background,geometry,material,mesh,appearance,wallpaper,controls,host};
  }
  const place=(n:number)=>{const side=Math.ceil(Math.cbrt(n)),matrix=new THREE.Matrix4(),scale=8/side,position=new THREE.Vector3(),size=new THREE.Vector3(scale*.9,scale*.9,scale*.9),orientation=new THREE.Quaternion();
   for(const p of panes){for(let i=0;i<n;i++){const x=i%side,y=Math.floor(i/side)%side,z=Math.floor(i/(side*side));matrix.compose(position.set((x-(side-1)/2)*scale,(y-(side-1)/2)*scale,(z-(side-1)/2)*scale),orientation,size);p.mesh.setMatrixAt(i,matrix);}p.mesh.count=n;p.mesh.instanceMatrix.needsUpdate=true;}lastCount=n;
  };
  const configure=()=>{if(!panes.length||measuring)return;const state=current.current,t=state.theme,color=t.nodes.color??(t.theme==='neon'?t.accent:'#dce9fa');
   for(const [index,p] of panes.entries()){
    p.material.color.set(color);updateAtomicCarrier(p.material,t.nodes.opacity*t.opacity,Number(t.renderDefaults?.['omnium.nodes.body']?.translucency??.82),t.nodes.glow);p.mesh.userData.glowIntensity=t.nodes.glow;
    p.background.enabled.value=index&&state.enabled?1:0;p.background.strength.value=state.strength;p.background.pattern.value=state.pattern;p.background.hue.value.set(color);p.background.plain.value.set(t.theme==='neon'?t.background:0x101927);p.wallpaper.refresh();
    p.appearance.configure({...t,motion:0,effect:'off',surfaceEffects:{},effectTargets:{windows:false,buttons:false,fields:false,nodes:false,binders:false,background:false}});
   }if(lastCount!==state.count)place(state.count);request();
  };
  const resize=()=>{resizeEpoch++;for(const p of panes){const w=Math.max(1,p.host.clientWidth),h=Math.max(1,p.host.clientHeight);p.renderer.setPixelRatio(budgetPixelRatio(w,h,devicePixelRatio,RENDER_BUDGET.scenePixels/2,RENDER_BUDGET.maxSceneDpr));p.renderer.setSize(w,h);p.renderer.getDrawingBufferSize(p.background.resolution.value);p.camera.aspect=w/h;p.camera.updateProjectionMatrix();p.appearance.resize(w,h);p.wallpaper.resize(w,h);}request();};
  const nextFrame=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
  const measure=async()=>{if(measuring||panes.length!==2)return;measuring=true;setBusy(true);setRows([]);const results:Row[]=[],p=panes[1],identity=rendererIdentity(p.renderer),measuredSize=resizeEpoch;for(const pane of panes)pane.controls.enabled=false;
   try{for(const n of [100,1000,5000]){if(!alive||document.hidden)break;setStatus(`Measuring ${n} spheres…`);place(n);const samples:[FrameTiming[],FrameTiming[]]=[[],[]];
    for(let round=0;round<10;round++)for(const state of (round%2?[1,0]:[0,1])){if(!alive||document.hidden)throw Error('Measurement cancelled while hidden or closed.');if(resizeEpoch!==measuredSize)throw Error('Comparison resized; measurement cancelled. Run again at a stable size.');p.background.enabled.value=state;p.background.strength.value=current.current.strength;
     const sample=await timedSphereFrame(p.renderer,()=>p.appearance.render(),()=>alive);if(round>=2)samples[state].push(sample);await nextFrame();}
    const gpu=(values:FrameTiming[])=>values.every(v=>v.gpuMs!==undefined)?median(values.map(v=>v.gpuMs!)):undefined;
    results.push({count:n,baseline:median(samples[0].map(s=>s.completionMs))!,adaptive:median(samples[1].map(s=>s.completionMs))!,baselineGPU:gpu(samples[0]),adaptiveGPU:gpu(samples[1])});if(alive)setRows([...results]);
   }if(alive)setStatus(`${identity.name}. ${identity.software?'Software rendering: these are CPU/driver call times, not hardware GPU evidence.':'GPU timings appear only when valid timer queries are available.'}`);
   }catch(error){if(alive)setStatus(String(error));}finally{measuring=false;if(alive){setBusy(false);for(const p of panes)p.controls.enabled=true;lastCount=0;configure();}}
  };
  try{panes.push(pane(hosts.current[0]!,0));panes.push(pane(hosts.current[1]!,1));}catch(error){setStatus(`Comparison unavailable: ${String(error)}`);for(const p of panes){p.controls.dispose();p.wallpaper.dispose();p.appearance.dispose();p.mesh.dispose();p.geometry.dispose();p.material.dispose();p.renderer.dispose();p.renderer.forceContextLoss();p.renderer.domElement.remove();}return;}
  const observer=new ResizeObserver(resize);for(const p of panes)observer.observe(p.host);
  api.current={configure,measure};configure();resize();
  void Promise.all(panes.map(p=>p.wallpaper.setURL(wallpaperURL??null))).then(()=>{if(alive){configure();setStatus('Ready. Both panes use the same camera and sphere arrangement.');}});
  return()=>{alive=false;api.current=null;cancelAnimationFrame(scheduled);observer.disconnect();for(const p of panes){p.controls.dispose();p.wallpaper.dispose();p.appearance.dispose();p.mesh.dispose();p.geometry.dispose();p.material.dispose();p.renderer.dispose();p.renderer.forceContextLoss();p.renderer.domElement.remove();}};
 },[wallpaperURL]);
 useEffect(()=>{api.current?.configure();},[theme,enabled,strength,pattern,count]);
 return <div className="sphere-blend-comparison">
  <div className="sphere-blend-options">
   <UIField id="blend:enabled" label="Adapt right view" category="View"><label><input type="checkbox" checked={enabled} disabled={busy} onChange={e=>setEnabled(e.target.checked)}/>Adapt right view</label></UIField>
   <UIField id="blend:strength" label="Adaptation strength" category="View"><label>Strength <input aria-label="Adaptation strength" type="range" min="0" max="1" step=".01" value={strength} disabled={busy} onChange={e=>setStrength(Number(e.target.value))}/><output>{strength.toFixed(2)}</output></label></UIField>
   <UIField id="blend:background" label="Comparison background" category="View"><label>Background<select aria-label="Comparison background" value={pattern} disabled={busy} onChange={e=>setPattern(Number(e.target.value))}><option value="0">Current wallpaper</option><option value="1">Dark</option><option value="2">Bright</option><option value="3">Same hue</option><option value="4">Busy</option></select></label></UIField>
   <UIField id="blend:count" label="Comparison sphere count" category="View"><label>Spheres<select aria-label="Comparison sphere count" value={count} disabled={busy} onChange={e=>setCount(Number(e.target.value))}>{[100,1000,5000].map(n=><option key={n}>{n}</option>)}</select></label></UIField>
  </div>
  <div className="sphere-blend-panes">{['Current','Adaptive (right view)'].map((label,index)=><div key={label}><strong>{label}</strong><div className="sphere-blend-pane" ref={element=>{hosts.current[index]=element;}}/></div>)}</div>
  <p>Temporary comparison only. Drag either view to orbit both. Hue stays fixed; limited brightness and opacity adjustments can reduce transparency. Wallpaper-only sampling does not account for other spheres behind a surface.</p>
  <button disabled={busy} onClick={()=>void api.current?.measure()}>Measure 100 / 1,000 / 5,000 spheres</button>
  <p role="status" data-blend-status>{status}</p>
  <table data-blend-timings data-measurement-state={busy?"running":rows.length===3?"complete":"idle"}><thead><tr><th>Spheres</th><th>Current call (ms)</th><th>Adaptive call (ms)</th><th>Current GPU (ms)</th><th>Adaptive GPU (ms)</th></tr></thead><tbody>{[100,1000,5000].map(count=>{const r=rows.find(r=>r.count===count);return <tr key={count}><td>{count}</td><td>{r?`${r.baseline.toFixed(2)} ms`:"—"}</td><td>{r?`${r.adaptive.toFixed(2)} ms`:"—"}</td><td>{r?(r.baselineGPU?.toFixed(2)??"Unavailable"):"—"}</td><td>{r?(r.adaptiveGPU?.toFixed(2)??"Unavailable"):"—"}</td></tr>;})}</tbody></table>
  <small>Paired medians after warm-up; call times include CPU/driver work and gl.finish; they are not GPU timer results. Instanced overlap ordering and CPU costs differ from the full atlas. Closing discards the trial settings.</small>
 </div>;
}
