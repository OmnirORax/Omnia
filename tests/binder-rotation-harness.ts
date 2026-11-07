/** Disposable scene for the explicitly authorized rotation diagnostic. */
import * as THREE from 'three';
import {buildTextScene} from '../src/textScene';
import {createSceneAppearance} from '../src/sceneAppearance';
import {defaultSettings} from '../src/workspaceActions';
import {emptyDocument,editorView} from '../src/graph/structural';
import {projectSpatial} from '../src/graph/spatial';
import {chartedBinders} from '../src/graph/binders';
const width=900,height=800,doc=emptyDocument();
for(const [id,x]of [['a',-.75],['b',.75]] as const){doc.entities.push({id,label:id,aliases:[],notes:''});doc.placements.push({id,entityId:id,parentId:null,position:{x:80,y:80},spatialPosition:{x,y:0,z:0},collapsed:true,hidden:false});}
doc.compositions=[{id:'binder',parentId:'a',childId:'b',text:'contains inverse'}];
const atlas=editorView(doc),graph=projectSpatial(atlas),scene=new THREE.Scene(),content=new THREE.Group();scene.add(content);
const camera=new THREE.PerspectiveCamera(50,width/height,.001,100000),renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true,preserveDrawingBuffer:true});renderer.setSize(width,height);document.body.append(renderer.domElement);
const appearance=createSceneAppearance(renderer,scene,camera),settings=defaultSettings();settings.appearance.atmosphere=false;settings.appearance.motion=0;appearance.resize(width,height);appearance.configure(settings.appearance);
const built=buildTextScene(content,graph.nodes,chartedBinders(doc,atlas),doc,null,()=>{},new Set(),settings.appearance);appearance.setSources(()=>built);built.updateSelection('a',new Set(['a']));built.setHovered('b');
const project=(p:THREE.Vector3)=>{const q=p.clone().project(camera);return {x:(q.x+1)*width/2,y:(1-q.y)*height/2,z:q.z};};
const render=(yaw=0,pitch=0,distance=4)=>{
 camera.position.set(distance*Math.sin(yaw)*Math.cos(pitch),distance*Math.sin(pitch),distance*Math.cos(yaw)*Math.cos(pitch));camera.up.set(0,1,0);camera.lookAt(0,0,0);camera.updateMatrixWorld();built.update(camera,width,height);appearance.render();
 const label=built.connectors[0].label!,corners=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([x,y])=>project(new THREE.Vector3(x,y,0).applyMatrix4(label.matrixWorld)));
 return {visible:label.visible,corners,position:label.position.toArray(),scale:label.scale.toArray(),quaternion:label.quaternion.toArray(),rotation:label.rotation.toArray(),glError:renderer.getContext().getError()};
};
Object.assign(window,{diagnostic:{render,built,scene,camera,renderer,appearance}});render();
