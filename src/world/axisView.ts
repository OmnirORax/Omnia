import * as T from 'three';
import {axisCenter,axisCoordinates,axisAnchor,norm,minus,dot,type AxisFrame} from '../core/axes.ts';
import {locate,type World,type Vec3} from '../core/model.ts';
import {label,disposeLabel} from './labels.ts';
export function createAxisView(scene:T.Scene,host:HTMLElement){
 const group=new T.Group();scene.add(group);
 const hint=document.createElement('output');hint.className='axis-coordinate';hint.hidden=true;host.append(hint);
 const readout=document.createElement('canvas');readout.className='axis-coordinate-canvas';readout.setAttribute('aria-hidden','true');host.append(readout);const context=readout.getContext('2d')!;
 let coordinatesVisible=true;
 const preview=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:'#ffffff',depthTest:false}));preview.visible=false;preview.frustumCulled=false;scene.add(preview);
 let previous='';const picks:T.Line[]=[];
 function clear(){for(const child of [...group.children]){group.remove(child);if(child.userData.isLabel)disposeLabel(child as ReturnType<typeof label>);else {const line=child as T.Line;line.geometry.dispose();(line.material as T.Material).dispose();}}picks.length=0;}
 return {picks,
  setCoordinatesVisible(visible:boolean){coordinatesVisible=visible;readout.hidden=!visible;if(!visible)hint.hidden=true;},
  brushCoordinates(world:World,frame:AxisFrame|undefined,points:Vec3[],scale:number,camera:T.PerspectiveCamera,visible:boolean){
   readout.hidden=!visible||!coordinatesVisible;if(readout.hidden)return;
   const width=innerWidth,height=innerHeight;if(readout.width!==width||readout.height!==height){readout.width=width;readout.height=height;}
   context.clearRect(0,0,width,height);context.font='11px monospace';context.textAlign='center';context.fillStyle='#ffffff';context.strokeStyle='#101419';context.lineWidth=3;
   camera.updateMatrixWorld();const box=host.getBoundingClientRect(),origin=frame?axisCenter(world,frame):[0,0,0] as Vec3;
   for(const point of points){const p=new T.Vector3(...point).multiplyScalar(scale).project(camera);if(p.z< -1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1)continue;const delta=minus(point,origin),coords=frame?[dot(delta,frame.x),dot(delta,frame.y)]:point,text=`${Number(coords[0].toFixed(2))}, ${Number(coords[1].toFixed(2))}`,x=box.left+(p.x+1)*box.width/2,y=box.top+(1-p.y)*box.height/2;context.strokeText(text,x,y-8);context.fillText(text,x,y-8);}
  },
  orient(camera:T.Camera){for(const child of group.children)if(child.userData.isLabel)child.quaternion.copy(camera.quaternion);},
  update(world:World,scale:number){
   const signature=JSON.stringify([world.axes,world.activeAxis,scale,(world.axes??[]).map(frame=>frame.ends.map(end=>locate(world,end)?.position))]);if(signature===previous)return;previous=signature;clear();
   for(const frame of world.axes??[]){const center=new T.Vector3(...axisCenter(world,frame)).multiplyScalar(scale),active=frame.id===world.activeAxis,length=norm(minus(locate(world,(frame.ends[1]??frame.ends[0]))!.position,axisAnchor(world,frame))),extent=Math.max(4,length/2+2)*scale;
    for(const [index,basis]of [frame.x,frame.y,frame.z].entries()){
     if(!active&&index)continue;
     const direction=new T.Vector3(...basis),line=new T.Line(new T.BufferGeometry().setFromPoints([center.clone().addScaledVector(direction,-extent),center.clone().addScaledVector(direction,extent)]),new T.LineBasicMaterial({color:active?['#ff5566','#66ee99','#66aaff'][index]:'#888888',transparent:true,opacity:active?.8:.35,depthWrite:false}));
     line.userData.axis=frame.id;group.add(line);picks.push(line);
     if(active){const caption=label(['X','Y','Z'][index]);caption.scale.multiplyScalar(.5*scale);caption.position.copy(center).addScaledVector(direction,extent);group.add(caption);}
    }
    const caption=label(frame.ends.length===1?'0':`${Number(length.toFixed(4))} u`);caption.scale.multiplyScalar(.5*scale);caption.position.copy(center).addScaledVector(new T.Vector3(...frame.y),.3*scale);group.add(caption);
   }
  },
  coordinates(world:World,frame:AxisFrame|undefined,p:Vec3|undefined,screen:{x:number;y:number}|undefined){
   if(!coordinatesVisible||!frame||!p||!screen){hint.hidden=true;return;}
   const coords=axisCoordinates(world,frame,p),text=coords.map((n,i)=>`${'XYZ'[i]} ${Number(n.toFixed(3))}`).join(' · ');
   if(hint.textContent!==text)hint.textContent=text;
   hint.hidden=false;hint.style.left=`${Math.max(4,Math.min(screen.x+14,innerWidth-hint.offsetWidth-8))}px`;hint.style.top=`${Math.max(4,Math.min(screen.y+14,innerHeight-hint.offsetHeight-8))}px`;
  },
  preview(a?:Vec3,b?:Vec3,scale=1,valid=true){preview.visible=!!a&&!!b;if(a&&b){const positions=preview.geometry.getAttribute('position') as T.BufferAttribute;positions.setXYZ(0,...a.map(n=>n*scale) as Vec3);positions.setXYZ(1,...b.map(n=>n*scale) as Vec3);positions.needsUpdate=true;preview.material.color.set(valid?'#ffffff':'#ff3344');preview.geometry.computeBoundingSphere();}},
  dispose(){clear();group.removeFromParent();preview.removeFromParent();preview.geometry.dispose();preview.material.dispose();hint.remove();readout.remove();}
 };
}
