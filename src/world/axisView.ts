import {positionCursorReadout} from '../ui/cursorReadout.ts';
import {createOriginGizmo,orientOriginGizmo,disposeOriginGizmo} from './originGizmo.ts';
import {AXIS_COLORS,axisReadoutAngles} from './axisReadout.ts';
import * as T from 'three';
import {activeWorldAxes,axisCenter,axisCoordinates,minus,dot,type AxisFrame} from '../core/axes.ts';
import {locate,type World,type Vec3} from '../core/model.ts';
export function createAxisView(scene:T.Scene,host:HTMLElement,camera:T.PerspectiveCamera){
 const group=new T.Group();scene.add(group);
 const hint=document.createElement('output');hint.className='axis-coordinate';hint.hidden=true;host.append(hint);
 const readout=document.createElement('canvas');readout.className='axis-coordinate-canvas';readout.setAttribute('aria-hidden','true');host.append(readout);const context=readout.getContext('2d')!;
 const readoutParts=AXIS_COLORS.map(color=>{const part=document.createElement('span'),bar=document.createElement('span'),value=document.createTextNode('');bar.textContent='|';bar.style.color=color;bar.style.display='inline-block';bar.style.marginRight='3px';part.append(bar,value);part.style.marginRight='6px';hint.append(part);return {bar,value,angle:NaN};});
 let visible=true,coordinatesVisible=true,unitScale=1;
 const preview=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:'#ffffff',depthTest:false}));preview.visible=false;preview.frustumCulled=false;scene.add(preview);
 let previous='';const picks:T.Object3D[]=[],hiddenPicks:T.Object3D[]=[];
 function clear(){for(const child of [...group.children])disposeOriginGizmo(child);picks.length=0;}
 function positionFrame(object:T.Object3D,world:World,frame:AxisFrame,scale:number){object.position.set(...axisCenter(world,frame)).multiplyScalar(scale);object.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(...frame.x),new T.Vector3(...frame.y),new T.Vector3(...frame.z)));}
 function updateUser(world:World,scale:number){const frame=world.axes?.find(f=>f.id==='@user'),object=group.children.find(child=>child.userData.axis==='@user');if(frame&&object){positionFrame(object,world,frame,scale);orientOriginGizmo(object as T.Group,camera,host.getBoundingClientRect());}}
 return {get picks(){return visible?picks:hiddenPicks;},
  setVisible(value:boolean){visible=value;group.visible=value;if(!value){preview.visible=false;hint.hidden=true;readout.hidden=true;}},
  referenceVisible(id:string,visible:boolean){for(const child of group.children)if(child.userData.axis===id)child.visible=visible;},
  setCoordinatesVisible(visible:boolean){coordinatesVisible=visible;readout.hidden=!visible;if(!visible)hint.hidden=true;},
  brushCoordinates(world:World,frame:AxisFrame|undefined,points:Vec3[],scale:number,camera:T.PerspectiveCamera,visible:boolean){
   readout.hidden=!visible||!group.visible||!coordinatesVisible;if(readout.hidden)return;
   const width=innerWidth,height=innerHeight;if(readout.width!==width||readout.height!==height){readout.width=width;readout.height=height;}
   context.clearRect(0,0,width,height);context.font='11px monospace';context.textAlign='center';context.fillStyle='#ffffff';context.strokeStyle='#101419';context.lineWidth=3;
   camera.updateMatrixWorld();const box=host.getBoundingClientRect(),origin=frame?axisCenter(world,frame):[0,0,0] as Vec3;
   const angles=frame?axisReadoutAngles(frame,camera,origin,scale):[0,0,0],indices=frame?activeWorldAxes(frame):[0,1];
   context.textAlign='left';const digitWidth=context.measureText('0').width;
   for(const point of points){const p=new T.Vector3(...point).multiplyScalar(scale).project(camera);if(p.z< -1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1)continue;const delta=minus(point,origin),coords=frame?[dot(delta,frame.x),dot(delta,frame.y),dot(delta,frame.z)]:point,values=indices.map(i=>String(Math.round(coords[i]))),widths=values.map(value=>value.length*digitWidth+15),y=box.top+(1-p.y)*box.height/2;let x=box.left+(p.x+1)*box.width/2-widths.reduce((a,b)=>a+b,0)/2;
    for(let n=0;n<indices.length;n++){const i=indices[n];context.save();context.translate(x+3,y-12);context.rotate(angles[i]);context.strokeStyle=AXIS_COLORS[i];context.lineWidth=2;context.beginPath();context.moveTo(0,-4);context.lineTo(0,4);context.stroke();context.restore();context.strokeStyle='#101419';context.lineWidth=3;context.fillStyle='#ffffff';context.strokeText(values[n],x+9,y-8);context.fillText(values[n],x+9,y-8);x+=widths[n];}
   }
  },
  orient(camera:T.Camera){const rect=host.getBoundingClientRect();for(const child of group.children)orientOriginGizmo(child as T.Group,camera,rect);},
  update(world:World,scale:number){
   unitScale=scale;
   const signature=JSON.stringify([(world.axes??[]).map(f=>f.id==='@user'?{id:f.id,activeAxes:f.activeAxes,directions:f.directions}:f),world.activeAxis,scale,(world.axes??[]).map(frame=>frame.ends.map(end=>locate(world,end)?.position))]);if(signature===previous){updateUser(world,scale);return;}previous=signature;clear();
   for(const frame of world.axes??[]){if(frame.id!==world.activeAxis)continue;const gizmo=createOriginGizmo(scale,true,activeWorldAxes(frame),frame.directions);gizmo.userData.axis=frame.id;positionFrame(gizmo,world,frame,scale);gizmo.traverse(child=>{child.userData.axis=frame.id;if(child instanceof T.Mesh)picks.push(child);});group.add(gizmo);orientOriginGizmo(gizmo,camera,host.getBoundingClientRect());}

  },
  coordinates(world:World,frame:AxisFrame|undefined,p:Vec3|undefined,screen:{x:number;y:number}|undefined){
   if(!visible||!coordinatesVisible||!frame||!p||!screen){hint.hidden=true;return;}
   const coords=axisCoordinates(world,frame,p),angles=axisReadoutAngles(frame,camera,axisCenter(world,frame),unitScale);
   for(let i=0;i<3;i++){const value=String(Math.round(coords[i])),transform=`rotate(${angles[i]}rad)`;if(readoutParts[i].value.nodeValue!==value)readoutParts[i].value.nodeValue=value;if(!Number.isFinite(readoutParts[i].angle)||Math.abs(readoutParts[i].angle-angles[i])>1e-6){readoutParts[i].bar.style.transform=transform;readoutParts[i].angle=angles[i];}}
   hint.setAttribute('aria-label',coords.map((n,i)=>`${'XYZ'[i]} ${Math.round(n)}`).join(', '));
   hint.hidden=false;positionCursorReadout(hint,screen);
  },
  preview(a?:Vec3,b?:Vec3,scale=1,valid=true){preview.visible=visible&&!!a&&!!b;if(a&&b){const positions=preview.geometry.getAttribute('position') as T.BufferAttribute;positions.setXYZ(0,...a.map(n=>n*scale) as Vec3);positions.setXYZ(1,...b.map(n=>n*scale) as Vec3);positions.needsUpdate=true;preview.material.color.set(valid?'#ffffff':'#ff3344');preview.geometry.computeBoundingSphere();}},
  dispose(){clear();group.removeFromParent();preview.removeFromParent();preview.geometry.dispose();preview.material.dispose();hint.remove();readout.remove();}
 };
}
