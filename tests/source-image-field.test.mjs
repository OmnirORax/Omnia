import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {imageColorCombo,matchedImageColors,comboPalette} from '../src/scene/colorCombo.ts';
import {focusPattern,focusPaletteGeometry,hasPalettePaint,isSourceField} from '../src/properties/focusPalette.ts';
import {validTextPalette} from '../src/properties/textPalette.ts';
import {packedTextureGlow,updateTextureTextPalette} from '../src/textureGlow.ts';
import {configureTextureInkRows} from '../src/textureInkProgression.ts';
const pixels=new Uint8ClampedArray([240,10,30,255,20,40,220,255,250,245,255,255,90,15,80,255]);
const source=()=>imageColorCombo({pixels,width:2,height:2});
const paint=(settings={})=>{const s={distribution:'image',ink:'color',...settings};return {...comboPalette(matchedImageColors(source(),s),s),field:{width:2,height:2,cells:[],rgb:'f00a1e1428dcfaf5ff5a0f50'}};};
test('saved direct-source compatibility preserves sampled RGB and positions instead of family averages, quotas or brightening',()=>{
 const p=paint({inverseDistribution:true,inverseOccupation:true,saturation:.59,scale:23.25}),pattern=focusPattern(p);assert.equal(isSourceField(p),true);assert.deepEqual([...pattern.glow],[...pixels]);assert.deepEqual([...pattern.ink],[...pixels]);assert.equal(pattern.width,2);assert.equal(pattern.height,2);assert.deepEqual(focusPaletteGeometry(p),{size:'100% 100%',repeat:'no-repeat'});assert.equal(validTextPalette(p),true);assert.deepEqual(focusPattern(JSON.parse(JSON.stringify(p))).glow,pattern.glow);
});
test('saved source fields: inversion, saturation, scale and disabled swatches cannot corrupt the direct-source baseline',()=>{
 const p=paint(),q=paint({saturation:0,inverseDistribution:true,inverseOccupation:true,motifOverrides:{h0:false},scale:4096});assert.deepEqual(focusPattern(q).glow,focusPattern(p).glow);assert.equal(focusPattern(q),focusPattern(p));for(const extra of [{rgb:'zz0000'},{rgb:'ff0000'},{cells:[0]}])assert.equal(validTextPalette({...p,field:{...p.field,...extra}}),false);
});
test('one detected family still renders its distinct source shades',()=>{
 const data=new Uint8ClampedArray([10,30,100,255,25,65,200,255]),s=imageColorCombo({pixels:data,width:2,height:1}),p=comboPalette(matchedImageColors(s,{distribution:'image',ink:'color'}),{distribution:'image',ink:'color'});p.field={width:2,height:1,cells:[],rgb:'0a1e641941c8'};assert.equal(p.colors.length,1);assert.equal(hasPalettePaint(p),true);assert.deepEqual([...focusPattern(p).glow],[...data]);
});
test('world source image fits occupied native bounds once, clamps edges and shares original pixels with text/glow',()=>{
 const width=6,height=6,mask=new Uint8ClampedArray(width*height*4);for(const [x,y]of [[1,1],[4,2],[1,4],[4,4]])mask[(y*width+x)*4]=255;let reads=0;const canvas={width,height,getContext:()=>({getImageData:()=>{reads++;return {data:mask};},putImageData(){}})},material=new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas)});packedTextureGlow(material);configureTextureInkRows(material,0,3,2);updateTextureTextPalette(material,paint());const shader={uniforms:{},fragmentShader:T.ShaderLib.basic.fragmentShader};material.onBeforeCompile(shader,{});assert.equal(shader.uniforms.textPaletteFitted.value,1);assert.deepEqual(shader.uniforms.textFieldBounds.value.toArray(),[4,3]);assert.equal(shader.uniforms.textPalettePattern.value.wrapS,T.ClampToEdgeWrapping);assert.equal(shader.uniforms.textPalettePattern.value.wrapT,T.ClampToEdgeWrapping);assert.deepEqual([...shader.uniforms.textPalettePattern.value.image.data],[...pixels]);updateTextureTextPalette(material,paint({scale:200,inverseDistribution:true}));assert.equal(reads,1);material.dispose();material.map.dispose();
});
test('document source reflection uses whole occupied bounds and never repeats a tile',async()=>{
 const {createDocumentFieldPainter}=await import('../src/text/fieldPresentation.ts');const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}),toDataURL:()=> 'data:image/png;base64,source'})};
 const element=()=>({style:{setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())];}}}),a=element(),b=element(),painter=createDocumentFieldPainter();try{painter.render([{element:a,x:0,y:0,from:0,to:1,bounds:{width:800,height:1200}},{element:b,x:100,y:600,from:2,to:3,bounds:{width:800,height:1200}}],paint({scale:23.25}));assert.equal(a.style.backgroundSize,'800px 1200px');assert.equal(b.style.backgroundSize,'800px 1200px');assert.equal(b.style.backgroundPosition,'-100px -600px');assert.equal(b.style.backgroundRepeat,'no-repeat');painter.clear();assert.equal(b.style.backgroundImage,undefined);}finally{globalThis.document=previous;}
});
