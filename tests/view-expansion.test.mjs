import {createGlyphPresentation} from '../src/omnic/presentation.ts';
import {emptyWorld,addStructure} from '../src/core/model.ts';
import {visualObject,disposeVisual} from '../src/visualScene.ts';
import * as T from 'three';
import {screenUnitsAt,placeExpandedView} from '../src/world/viewProjection.ts';
import {expansionState,toggleContent,contentExpanded} from '../src/graph/nodePresentation.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {expandView,expansionFootprint} from '../src/world/viewExpansion.ts';
import {glyphPresentationBounds,glyphPresentationScale} from '../src/omnic/presentationBounds.ts';
import {evaluateRecipe} from '../src/omnic/evaluate.ts';
import {createRecipe} from '../src/omnic/presets.ts';

const item=(id,x,y,w,h=20)=>({id,x,y,label:{width:w,height:h}});
function fitted(layout,width,height){
 const boxes=[...layout.positions.values()];
 for(const b of boxes){assert.ok([b.x,b.y,b.width,b.height,b.scale].every(Number.isFinite));assert.ok(b.x-b.width/2>=-1e-6&&b.x+b.width/2<=width+1e-6);assert.ok(b.y-b.height/2>=-1e-6&&b.y+b.height/2<=height+1e-6);}
 for(let n=0;n<boxes.length;n++)for(let m=n+1;m<boxes.length;m++){const a=boxes[n],b=boxes[m];assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2-1e-5||Math.abs(a.y-b.y)>=(a.height+b.height)/2-1e-5,`overlap ${n},${m}`);}
}
test('vastly different contents fit together, keep the same chain axis and never edit authored anchors',()=>{
 const items=[item('a',200,300,30),item('b',260,300,800,500),item('c',320,300,10000,400)];const before=structuredClone(items),layout=expandView(items,1200,800);
 fitted(layout,1200,800);assert.deepEqual(items,before);
 const [a,b,c]=items.map(i=>layout.positions.get(i.id));assert.ok(a.x<b.x&&b.x<c.x);assert.equal(a.y,b.y);assert.equal(b.y,c.y);assert.equal(a.scale,c.scale);
});
test('a common transform preserves diagonal directions and relative spacing, independent of insertion order',()=>{
 const items=[item('a',100,200,400),item('b',200,300,200),item('c',400,500,900)];const a=expandView(items,900,600),b=expandView([...items].reverse(),900,600);
 fitted(a,900,600);assert.deepEqual(a,b);
 const p=items.map(i=>a.positions.get(i.id));assert.ok(Math.abs((p[2].x-p[1].x)/(p[1].x-p[0].x)-2)<1e-9);assert.ok(Math.abs((p[1].x-p[0].x)-(p[1].y-p[0].y))<1e-9);
});
test('horizontal long glyphs rotate for more space while their label footprint stays upright',()=>{
 const items=[0,1,2].map(n=>({...item(String(n),200+100*n,400,80,20),glyph:{width:600,height:8},rotate:true}));
 const normal=expandView(items.map(i=>({...i,rotate:false})),1200,800),rotated=expandView(items,1200,800);
 fitted(rotated,1200,800);assert.ok(rotated.scale>normal.scale);assert.ok([...rotated.positions.values()].every(p=>p.turn));
 assert.equal(expansionFootprint(items[0],true).width,92);
 const textOnly=expandView([item('text',10,10,3000,40)],500,400);assert.equal(textOnly.positions.get('text').turn,false);fitted(textOnly,500,400);
});
test('projection ties are stable and dense/oversized views have bounded, nonoverlapping results',()=>{
 fitted(expandView([item('a',50,50,100),item('b',50,50,100),item('c',50,50,100)],200,200),200,200);
 const items=Array.from({length:450},(_,n)=>item(String(n),n%30,Math.floor(n/30),1e6+(n%7)*30,40));const result=expandView(items,1600,900);fitted(result,1600,900);
 fitted(expandView([item('huge',50,50,1e12,1e9)],320,200),320,200);assert.equal(expandView([],320,200).positions.size,0);
});
test('random mixed footprints retain order and fit without overlap',()=>{
 let seed=17;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
 for(let trial=0;trial<15;trial++){
  const items=Array.from({length:30},(_,n)=>item(String(n),rand()*800,rand()*500,rand()*1500+10,rand()*400+10)),layout=expandView(items,1000,700);fitted(layout,1000,700);
  for(let n=1;n<items.length;n++){const a=items[n-1],b=items[n],p=layout.positions.get(a.id),q=layout.positions.get(b.id);assert.equal(Math.sign(p.x-q.x),Math.sign(a.x-b.x));assert.equal(Math.sign(p.y-q.y),Math.sign(a.y-b.y));}
 }
});
test('glyph footprints follow actual visible ink instead of a square viewport',()=>{
 const recipe=createRecipe('line'),before=structuredClone(recipe),evaluation=evaluateRecipe(recipe),bounds=glyphPresentationBounds(evaluation);
 assert.ok(bounds.width>bounds.height*4);assert.ok(bounds.width<=1&&bounds.height<=1);assert.deepEqual(recipe,before);
 const clipped=glyphPresentationBounds(evaluation,{x:-1,y:-1,width:2,height:2});assert.ok(clipped.width<=1&&clipped.height<=1);
 assert.deepEqual(glyphPresentationBounds({...evaluation,nodes:[]}),{x:0,y:0,width:0,height:0});
});

test('the same glyph unit conversion preserves authored size ratios across different viewports',()=>{
 const make=length=>{const r=createRecipe('line');r.components[0].params.length=length;return evaluateRecipe(r);};
 const a=make(20),b=make(200),va={x:-100,y:-100,width:200,height:200},vb={x:-1000,y:-1000,width:2000,height:2000};
 const wa=glyphPresentationBounds(a,va).width*glyphPresentationScale(va),wb=glyphPresentationBounds(b,vb).width*glyphPresentationScale(vb);
 assert.ok(wb/wa>9&&wb/wa<11);
});

test('expanded projected bounds remain pickable on an oriented node without moving its saved anchor',()=>{
 const camera=new T.PerspectiveCamera(55,1200/800,.01,1000);camera.position.set(4,6,10);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const group=new T.Group(),presentation=new T.Group();group.position.set(1,2,0);group.quaternion.setFromEuler(new T.Euler(.3,.7,.2));group.add(presentation);
 const origin={born:1,at:[0,0,0]},hit=new T.Mesh(new T.PlaneGeometry(3,2),new T.MeshBasicMaterial({side:T.DoubleSide,visible:false}));hit.userData.origin=origin;presentation.add(hit);
 const before=group.position.clone(),p=before.clone().project(camera),from={x:(p.x+1)*600,y:(1-p.y)*400},to={x:800,y:300,scale:.35};
 placeExpandedView(group,presentation,camera,from,to,screenUnitsAt(camera,before,800));group.updateMatrixWorld(true);
 const projected=presentation.getWorldPosition(new T.Vector3()).project(camera);assert.ok(Math.abs((projected.x+1)*600-to.x)<1e-8);assert.ok(Math.abs((1-projected.y)*400-to.y)<1e-8);assert.deepEqual(group.position,before);
 const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(to.x/600-1,1-to.y/400),camera);assert.equal(ray.intersectObject(hit)[0].object.userData.origin,origin);
 presentation.position.set(0,0,0);presentation.scale.setScalar(1);group.updateMatrixWorld(true);assert.deepEqual(presentation.getWorldPosition(new T.Vector3()),before);
});
test('explicit content collapse overrides selection expansion and leaves structural collapse independent',()=>{
 const state=expansionState(),node={position:[1,2,3],collapsed:false},before=structuredClone(node);
 assert.equal(contentExpanded(state,'a',true),true);toggleContent(state,'a',true);assert.equal(contentExpanded(state,'a',true),false);
 toggleContent(state,'a',true);assert.equal(contentExpanded(state,'a',false),true);assert.deepEqual(node,before);
});

test('expanded world glyphs use all evaluated contents and keep thumbnail/composer viewport caches separate',()=>{
 const world=emptyWorld(),node=addStructure(world,[0,0,0],1);node.omnic=createRecipe('line');node.omnic.atomnic={viewX:500,viewY:500,viewSize:40};
 const before=structuredClone(node.omnic),thumbnail=createGlyphPresentation(world,true),expanded=createGlyphPresentation(world,true,true);
 assert.equal(thumbnail(node).viewBounds.width,0);assert.ok(expanded(node).viewBounds.width>0);assert.notEqual(thumbnail,expanded);assert.equal(expanded,createGlyphPresentation(world,true,true));assert.deepEqual(node.omnic,before);
});
test('late raster image loads update image proportions but preserve measured Omnic ink bounds',()=>{
 const original=T.TextureLoader.prototype.load;let complete;
 T.TextureLoader.prototype.load=function(_url,onLoad){complete=onLoad;return new T.Texture();};
 try{
  const asset={id:'image',kind:'image',dataUrl:'data:image/png;base64,AA==',name:'test'};
  const image=visualObject({assetId:'image'},[asset],()=>new T.Group(),()=>{});
  complete(new T.Texture({width:20,height:200}));assert.deepEqual(image.userData.viewBounds,{x:0,y:0,width:.1,height:1});disposeVisual(image);
  const glyph=visualObject({assetId:'image'},[asset],()=>new T.Group(),()=>{}),ink={x:.1,y:.2,width:.8,height:.02};glyph.userData.omnic=true;glyph.userData.viewBounds=ink;
  complete(new T.Texture({width:256,height:256}));assert.equal(glyph.userData.viewBounds,ink);disposeVisual(glyph);
 }finally{T.TextureLoader.prototype.load=original;}
});
