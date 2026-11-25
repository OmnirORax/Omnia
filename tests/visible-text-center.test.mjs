import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {visibleTextCenter} from '../src/text/visibleTextCenter.ts';
import {observeDocumentTextCenter} from '../src/text/documentTextCenter.ts';
import {bindWorldText,WORLD_TEXT_LAYER} from '../src/world/textPass.ts';
import {packedTextureGlow,updateTextureTextPalette} from '../src/textureGlow.ts';

test('the shared text extent clips scrolled runs and visible world labels, then moves the world sampling bounds',()=>{
 const originals={window:globalThis.window,document:globalThis.document,MutationObserver:globalThis.MutationObserver};
 const scroller=Object.assign(new EventTarget(),{getBoundingClientRect:()=>({left:25,top:20,right:80,bottom:62.5})});
 let rects=[{left:12.5,top:12.5,right:75,bottom:50}];
 const line={textContent:'Text'};
 const view={dom:{isConnected:true,closest:()=>null},contentDOM:{querySelectorAll:()=>[line]},scrollDOM:scroller,
  requestMeasure({read,write}){write(read(this));}};
 const styles=new Map();
 globalThis.document={documentElement:{style:{setProperty:(key,value)=>styles.set(key,value)}},createRange:()=>({selectNodeContents(){},getClientRects:()=>rects})};
 globalThis.window=Object.assign(new EventTarget(),{innerWidth:100,innerHeight:100});
 globalThis.MutationObserver=class{disconnect(){}};
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.1,10);
 camera.position.z=2;camera.updateMatrixWorld();camera.updateProjectionMatrix();
 const material=new T.MeshBasicMaterial(),geometry=new T.PlaneGeometry(1,1);
 const label=new T.Mesh(geometry,material);label.position.set(.5,-.75,0);label.scale.set(1.5,.5,1);label.userData.label='Label';label.layers.set(WORLD_TEXT_LAYER);scene.add(label);
 const hidden=label.clone();hidden.position.x=-1;hidden.visible=false;scene.add(hidden);
 scene.updateMatrixWorld();
 const reference=observeDocumentTextCenter(view),renderer={getDrawingBufferSize:size=>size.set(200,200)};
 try{
  packedTextureGlow(material);updateTextureTextPalette(material,{mode:'text',distribution:'pixels',centerImagePixels:true,colors:['#00ff00']});
  const shader={uniforms:{},fragmentShader:T.ShaderLib.basic.fragmentShader};material.onBeforeCompile(shader,{});
  assert.equal(shader.uniforms.imagePixelCentered.value,true);
  bindWorldText(renderer,scene,camera);
  assert.deepEqual(visibleTextCenter.bounds,{left:.25,top:.2,right:1,bottom:1});
  assert.deepEqual(shader.uniforms.wallpaperTextBounds.value.toArray(),[.25,0,.75,.8]);
  assert.equal(styles.get('--visible-text-width'),'75vw');
  rects=[{left:50,top:62.5,right:90,bottom:75}];
  scroller.dispatchEvent(new Event('scroll'));
  assert.deepEqual(visibleTextCenter.bounds,{left:.375,top:.75,right:1,bottom:1});
  label.visible=false;bindWorldText(renderer,scene,camera);
  assert.deepEqual(visibleTextCenter.bounds,{left:0,top:0,right:1,bottom:1});
 }finally{reference.dispose();material.dispose();geometry.dispose();Object.assign(globalThis,originals);}
});
