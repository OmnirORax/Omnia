import {AXIS_COLORS,axisReadoutAngles} from './axisReadout.ts';
import * as T from 'three';
import {ORIGIN_RADIUS,originSegment,createOriginSphere} from './originMarker.ts';
import {activeWorldAxes,axisCenter,axisCoordinates,axisAnchor,norm,minus,dot,type AxisFrame} from '../core/axes.ts';
import {locate,type World,type Vec3} from '../core/model.ts';
import {label,disposeLabel} from './labels.ts';
export function createAxisView(scene:T.Scene,host:HTMLElement,camera:T.PerspectiveCamera){
 const group=new T.Group();scene.add(group);
 const hint=document.createElement('output');hint.className='axis-coordinate';hint.hidden=true;host.append(hint);
 const readout=document.createElement('canvas');readout.className='axis-coordinate-canvas';readout.setAttribute('aria-hidden','true');host.append(readout);const context=readout.getContext('2d')!;
 const readoutParts=AXIS_COLORS.map(color=>{const part=document.createElement('span'),bar=document.createElement('span'),value=document.createTextNode('');bar.textContent='|';bar.style.color=color;bar.style.display='inline-block';bar.style.marginRight='3px';part.append(bar,value);part.style.marginRight='6px';hint.append(part);return {bar,value,angle:NaN};});
 let coordinatesVisible=true,unitScale=1;
 const preview=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:'#ffffff',depthTest:false}));preview.visible=false;preview.frustumCulled=false;scene.add(preview);
 let previous='';const picks:T.Object3D[]=[];
 function clear(){for(const child of [...group.children]){group.remove(child);if(child.userData.isLabel)disposeLabel(child as ReturnType<typeof label>);else {const line=child as T.Line;line.geometry.dispose();(line.material as T.Material).dispose();}}picks.length=0;}
 function updateUser(world:World,scale:number){const frame=world.axes?.find(f=>f.id==='@user');if(!frame)return;const center=new T.Vector3(...axisCenter(world,frame)).multiplyScalar(scale),basis=[frame.x,frame.y,frame.z];for(const child of group.children){if(child.userData.axis!==frame.id)continue;const index=child.userData.axisIndex;if(child.userData.directionIndicator){child.position.copy(center).addScaledVector(new T.Vector3(...frame.z),ORIGIN_RADIUS*.8*scale);child.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(...frame.z));continue;}if(index===undefined){child.position.copy(center);if(!child.userData.originMarker)child.position.addScaledVector(new T.Vector3(...frame.y),(ORIGIN_RADIUS+.1)*scale);continue;}const direction=new T.Vector3(...basis[index]);if(child.userData.isLabel)child.position.copy(center).addScaledVector(direction,ORIGIN_RADIUS*scale);else{const line=child as T.Line,positions=line.geometry.getAttribute('position') as T.BufferAttribute;const segment=originSegment(center,direction,scale);positions.setXYZ(0,...segment[0].toArray() as Vec3);positions.setXYZ(1,...segment[1].toArray() as Vec3);positions.needsUpdate=true;line.geometry.computeBoundingSphere();}}}
 return {picks,
  referenceVisible(id:string,visible:boolean){for(const child of group.children)if(child.userData.axis===id)child.visible=visible;},
  setCoordinatesVisible(visible:boolean){coordinatesVisible=visible;readout.hidden=!visible;if(!visible)hint.hidden=true;},
  brushCoordinates(world:World,frame:AxisFrame|undefined,points:Vec3[],scale:number,camera:T.PerspectiveCamera,visible:boolean){
   readout.hidden=!visible||!coordinatesVisible;if(readout.hidden)return;
   const width=innerWidth,height=innerHeight;if(readout.width!==width||readout.height!==height){readout.width=width;readout.height=height;}
   context.clearRect(0,0,width,height);context.font='11px monospace';context.textAlign='center';context.fillStyle='#ffffff';context.strokeStyle='#101419';context.lineWidth=3;
   camera.updateMatrixWorld();const box=host.getBoundingClientRect(),origin=frame?axisCenter(world,frame):[0,0,0] as Vec3;
   const angles=frame?axisReadoutAngles(frame,camera,origin,scale):[0,0,0],indices=frame?activeWorldAxes(frame):[0,1];
   context.textAlign='left';const digitWidth=context.measureText('0').width;
   for(const point of points){const p=new T.Vector3(...point).multiplyScalar(scale).project(camera);if(p.z< -1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1)continue;const delta=minus(point,origin),coords=frame?[dot(delta,frame.x),dot(delta,frame.y),dot(delta,frame.z)]:point,values=indices.map(i=>String(Math.round(coords[i]))),widths=values.map(value=>value.length*digitWidth+15),y=box.top+(1-p.y)*box.height/2;let x=box.left+(p.x+1)*box.width/2-widths.reduce((a,b)=>a+b,0)/2;
    for(let n=0;n<indices.length;n++){const i=indices[n];context.save();context.translate(x+3,y-12);context.rotate(angles[i]);context.strokeStyle=AXIS_COLORS[i];context.lineWidth=2;context.beginPath();context.moveTo(0,-4);context.lineTo(0,4);context.stroke();context.restore();context.strokeStyle='#101419';context.lineWidth=3;context.fillStyle='#ffffff';context.strokeText(values[n],x+9,y-8);context.fillText(values[n],x+9,y-8);x+=widths[n];}
   }
  },
  orient(camera:T.Camera){for(const child of group.children)if(child.userData.isLabel)child.quaternion.copy(camera.quaternion);},
  update(world:World,scale:number){
   unitScale=scale;
   const signature=JSON.stringify([(world.axes??[]).map(f=>f.id==='@user'?{id:f.id,activeAxes:f.activeAxes}:f),world.activeAxis,scale,(world.axes??[]).map(frame=>frame.ends.map(end=>locate(world,end)?.position))]);if(signature===previous){updateUser(world,scale);return;}previous=signature;clear();
   for(const frame of world.axes??[]){const center=new T.Vector3(...axisCenter(world,frame)).multiplyScalar(scale),active=frame.id===world.activeAxis,length=norm(minus((frame.ends[0]?locate(world,(frame.ends[1]??frame.ends[0]))!.position:axisCenter(world,frame)),axisAnchor(world,frame))),extent=ORIGIN_RADIUS*scale;
    const marker=createOriginSphere(scale,active);marker.position.copy(center);marker.scale.setScalar(scale);marker.userData.axis=frame.id;marker.userData.originMarker=true;group.add(marker);picks.push(marker);
    const facing=new T.Mesh(new T.ConeGeometry(ORIGIN_RADIUS*.15,ORIGIN_RADIUS*.35,8),new T.MeshBasicMaterial({color:'#ffffff',depthTest:false,depthWrite:false}));facing.position.copy(center).addScaledVector(new T.Vector3(...frame.z),ORIGIN_RADIUS*.8*scale);facing.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(...frame.z));facing.scale.setScalar(scale);facing.renderOrder=46;facing.userData={axis:frame.id,axisIndex:2,directionIndicator:true};group.add(facing);picks.push(facing);
    for(const [index,basis]of [frame.x,frame.y,frame.z].entries()){
     if(!active&&index)continue;
     const selected=active&&activeWorldAxes(frame).includes(index);const direction=new T.Vector3(...basis),line=new T.Line(new T.BufferGeometry().setFromPoints(originSegment(center,direction,scale)),new T.LineBasicMaterial({color:active?AXIS_COLORS[index]:'#888888',transparent:true,opacity:selected?1:active?.55:.35,depthTest:false,depthWrite:false}));
     line.material.color.multiplyScalar(selected?1:.7);line.renderOrder=45;line.userData.axis=frame.id;line.userData.axisIndex=index;line.userData.glowIntensity=selected?.25:0;group.add(line);picks.push(line);
     if(active){const caption=label(['+X','+Y','+Z'][index]);caption.scale.multiplyScalar(.12*scale);caption.position.copy(center).addScaledVector(direction,extent);caption.material.opacity=selected?1:.55;caption.userData.axis=frame.id;caption.userData.axisIndex=index;group.add(caption);picks.push(caption);}
    }
    const caption=label(frame.ends.length<=1?'0':`${Math.round(length)} u`);caption.userData.axis=frame.id;caption.scale.multiplyScalar(.12*scale);caption.position.copy(center).addScaledVector(new T.Vector3(...frame.y),(ORIGIN_RADIUS+.1)*scale);group.add(caption);picks.push(caption);
   }
  },
  coordinates(world:World,frame:AxisFrame|undefined,p:Vec3|undefined,screen:{x:number;y:number}|undefined){
   if(!coordinatesVisible||!frame||!p||!screen){hint.hidden=true;return;}
   const coords=axisCoordinates(world,frame,p),angles=axisReadoutAngles(frame,camera,axisCenter(world,frame),unitScale);
   for(let i=0;i<3;i++){const value=String(Math.round(coords[i])),transform=`rotate(${angles[i]}rad)`;if(readoutParts[i].value.nodeValue!==value)readoutParts[i].value.nodeValue=value;if(!Number.isFinite(readoutParts[i].angle)||Math.abs(readoutParts[i].angle-angles[i])>1e-6){readoutParts[i].bar.style.transform=transform;readoutParts[i].angle=angles[i];}}
   hint.setAttribute('aria-label',coords.map((n,i)=>`${'XYZ'[i]} ${Math.round(n)}`).join(', '));
   hint.hidden=false;hint.style.left=`${Math.max(4,Math.min(screen.x+14,innerWidth-hint.offsetWidth-8))}px`;hint.style.top=`${Math.max(4,Math.min(screen.y+14,innerHeight-hint.offsetHeight-8))}px`;
  },
  preview(a?:Vec3,b?:Vec3,scale=1,valid=true){preview.visible=!!a&&!!b;if(a&&b){const positions=preview.geometry.getAttribute('position') as T.BufferAttribute;positions.setXYZ(0,...a.map(n=>n*scale) as Vec3);positions.setXYZ(1,...b.map(n=>n*scale) as Vec3);positions.needsUpdate=true;preview.material.color.set(valid?'#ffffff':'#ff3344');preview.geometry.computeBoundingSphere();}},
  dispose(){clear();group.removeFromParent();preview.removeFromParent();preview.geometry.dispose();preview.material.dispose();hint.remove();readout.remove();}
 };
}
