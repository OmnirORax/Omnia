import * as THREE from 'three';
/** Masks only wallpaper beneath visible carrier footprints. All backings render
 * before graph ink, so translucent nodes still blend with one another. */
export function createCarrierBackdrop(scene:THREE.Scene){
 const geometry=new THREE.SphereGeometry(.5,24,16),material=new THREE.MeshBasicMaterial({depthTest:false,depthWrite:false});
 let capacity=1,batch=new THREE.InstancedMesh(geometry,material,capacity);
 const sources:THREE.Mesh<THREE.SphereGeometry,THREE.Material>[]=[],local=new THREE.Matrix4(),world=new THREE.Matrix4(),size=new THREE.Matrix4();
 const install=()=>{batch.renderOrder=-99999;batch.frustumCulled=false;batch.userData.glowIntensity=0;batch.raycast=()=>{};batch.visible=false;scene.add(batch);};install();
 return {get object(){return batch;},update(){
  sources.length=0;let wallpaper=false,count=0;
  scene.traverseVisible(object=>{
   if(object.userData.sceneWallpaper)wallpaper=true;
   if(!(object instanceof THREE.Mesh)||!object.userData.carrier||!(object.geometry instanceof THREE.SphereGeometry)||Array.isArray(object.material)||!object.material.visible||object.material.opacity<=0)return;
   sources.push(object);count+=object instanceof THREE.InstancedMesh?object.count:1;
  });
  if(!wallpaper||!count){batch.visible=false;batch.count=0;return;}
  if(count>capacity){batch.removeFromParent();batch.dispose();capacity=2**Math.ceil(Math.log2(count));batch=new THREE.InstancedMesh(geometry,material,capacity);install();}
  scene.updateMatrixWorld();let index=0;
  for(const source of sources){size.makeScale(source.geometry.parameters.radius*2,source.geometry.parameters.radius*2,source.geometry.parameters.radius*2);
   if(source instanceof THREE.InstancedMesh){for(let i=0;i<source.count;i++){source.getMatrixAt(i,local);world.multiplyMatrices(source.matrixWorld,local).multiply(size);batch.setMatrixAt(index++,world);}}
   else{world.multiplyMatrices(source.matrixWorld,size);batch.setMatrixAt(index++,world);}
  }
  if(scene.background instanceof THREE.Color)material.color.copy(scene.background);else material.color.set('#030c15');
  batch.count=index;batch.instanceMatrix.needsUpdate=true;batch.visible=true;
 },dispose(){batch.removeFromParent();batch.dispose();geometry.dispose();material.dispose();sources.length=0;}};
}
