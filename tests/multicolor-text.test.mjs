import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {imageColorCombo} from '../src/scene/colorCombo.ts';
import {extractScenePalette,colorLuminance,paletteRGB} from '../src/scene/palette.ts';
import {gradientPixels,gradientColor,gradientGlow,GRADIENT_SAMPLES,perceptualHue,validateTextGradient,TEXT_KEYLINE} from '../src/properties/textGradient.ts';
import {packedTextureGlow,updateTextureGradient,packGlowCoverage} from '../src/textureGlow.ts';
import {setDOMTextGradient,textGradientFilter} from '../src/ui/textGradient.ts';
import {setDOMTextPaint} from '../src/ui/appearance.ts';
import {validatePaint} from '../src/properties/visual.ts';
const pixels=new Uint8ClampedArray([
 ...Array.from({length:400},()=>[20,40,200,255]).flat(),
 ...Array.from({length:250},()=>[255,100,10,255]).flat(),
 ...Array.from({length:200},()=>[150,20,220,255]).flat(),
 ...Array.from({length:100},()=>[245,245,245,255]).flat(),
 ...Array.from({length:50},()=>[5,5,5,255]).flat(),
]);
test('all significant chromatic and neutral families retain their proportional spans',()=>{
 const palette=extractScenePalette(pixels),gradient=imageColorCombo(pixels).gradient;
 validateTextGradient(gradient);
 assert.equal(gradient.stops.length,2*(palette.accents.length+palette.neutrals.length));
 const boundaries=[0];for(let i=1;i<gradient.stops.length/2;i++)boundaries.push((gradient.stops[i*2-1].at+gradient.stops[i*2].at)/2);boundaries.push(1);
 const coverage=boundaries.slice(1).map((at,i)=>at-boundaries[i]).sort(),weights=[...palette.accents,...palette.neutrals].map(item=>item.weight).sort();
 weights.forEach((weight,i)=>assert.ok(Math.abs(coverage[i]-weight)<1e-10));
});
test('perceptual hue order cuts the largest hue gap instead of alternating distant colors',()=>{
 const chromatic=new Uint8ClampedArray([...pixels.slice(0,850*4)]),gradient=imageColorCombo(chromatic).gradient;
 const hues=gradient.stops.filter((_,i)=>i%2===0).map(stop=>perceptualHue(stop.color));
 // Tinting can shift hue slightly, but the short blue/purple gap stays adjacent.
 const gaps=hues.slice(1).map((h,i)=>Math.min(Math.abs(h-hues[i]),360-Math.abs(h-hues[i])));
 assert.ok(gaps.some(gap=>gap<65));assert.ok(gaps.reduce((a,b)=>a+b,0)<220);
});
test('coupled ink/halo samples stay continuous, lighter, chromatic and readable',()=>{
 const gradient=imageColorCombo(pixels).gradient,data=gradientPixels(gradient),sat=rgb=>(Math.max(...rgb)-Math.min(...rgb))/Math.max(...rgb);
 for(let i=0;i<GRADIENT_SAMPLES;i++){
  const ink=[...data.slice(i*4,i*4+3)],halo=[...data.slice((GRADIENT_SAMPLES+i)*4,(GRADIENT_SAMPLES+i)*4+3)];
  assert.ok(colorLuminance(ink)>colorLuminance(halo));assert.ok(sat(halo)+.01>=sat(ink));
  assert.ok((colorLuminance(ink)+.05)/(colorLuminance(paletteRGB(TEXT_KEYLINE))+.05)>7);
  const expected=gradientGlow(gradientColor(gradient,i/(GRADIENT_SAMPLES-1))).map(Math.round);assert.deepEqual(halo,expected);
 }
 for(const stop of gradient.stops.slice(1,-1)){
  const left=gradientColor(gradient,stop.at-1e-8),right=gradientColor(gradient,stop.at+1e-8);
  assert.ok(left.every((v,i)=>Math.abs(v-right[i])<.01));
 }
});
test('gradient palettes share GPU storage and release it after their last material',()=>{
 const gradient=imageColorCombo(pixels).gradient,a=new T.MeshBasicMaterial(),b=new T.MeshBasicMaterial();packedTextureGlow(a);packedTextureGlow(b);
 const compile=material=>{const shader={uniforms:{},fragmentShader:T.ShaderLib.basic.fragmentShader};material.onBeforeCompile(shader,{});return shader;},sa=compile(a),sb=compile(b);
 updateTextureGradient(a,gradient);updateTextureGradient(b,structuredClone(gradient));
 const texture=sa.uniforms.textGradient.value;assert.equal(texture,sb.uniforms.textGradient.value);assert.equal(texture.image.data.length,2048);assert.equal(sa.uniforms.textGradientEnabled.value,1);
 let disposed=0;texture.addEventListener('dispose',()=>disposed++);a.dispose();assert.equal(disposed,0);
 updateTextureGradient(b,null);assert.equal(disposed,1);assert.equal(sb.uniforms.textGradientEnabled.value,0);assert.equal(sb.uniforms.textGradient.value,null);b.dispose();assert.equal(disposed,1);
});
test('packed coverage lends its unused channel to the contrast keyline, including aliased input',()=>{
 for(const alias of [false,true]){
  const clean=new Uint8ClampedArray(3*3*4);clean[4*4+3]=255;const combined=alias?clean:clean.slice();packGlowCoverage(clean,combined,3);
  for(let i=0;i<9;i++){assert.equal(combined[i*4],i===4?255:0);assert.equal(combined[i*4+2],[1,3,4,5,7].includes(i)?255:0);}
 }
});
test('document palette changes reuse their filter; disabling removes every local override',()=>{
 const previous=globalThis.document,children=[];
 const style=()=>({setProperty(key,value){this[key]=value;},removeProperty(key){delete this[key];}});
 globalThis.document={createElementNS(){return {style:style(),setAttribute(){},innerHTML:'',remove(){children.splice(children.indexOf(this),1);}};}};
 const owner={style:style(),dataset:{},append(child){children.push(child);}},gradient=imageColorCombo(pixels).gradient;
 try{const output={color:'',textShadow:'',fontFamily:''};setDOMTextPaint(output,{gradient,glow:1,glowSpread:6},owner);assert.equal(output.textShadow,'none');const svg=children[0],filter=svg.innerHTML;
  setDOMTextGradient(owner,{stops:[{at:0,color:'#ffaaaa'},{at:1,color:'#aaaaff'}]},1,6);assert.equal(children.length,1);assert.equal(svg.innerHTML,filter);assert.ok(owner.style['--image-text-gradient'].includes('#aaaaff'));
  setDOMTextGradient(owner,gradient,2,8);assert.notEqual(svg.innerHTML,filter);
  setDOMTextGradient(owner,null,0,6);assert.equal(children.length,0);assert.equal(owner.dataset.imageText,undefined);assert.equal(owner.style['--image-text-filter'],undefined);
 }finally{globalThis.document=previous;}
 const filter=textGradientFilter('test',1,6);assert.equal((filter.match(/feGaussianBlur/g)??[]).length,3);assert.ok(filter.includes('in="SourceGraphic"'));assert.ok(filter.includes('color-interpolation-filters="sRGB"'));
});
test('gradient validation bounds persisted data and accepts an explicit solid-color override',()=>{
 validatePaint({gradient:imageColorCombo(pixels).gradient},true);validatePaint({gradient:null},true);
 for(const stops of [[],[{at:0,color:'#fff000'}],[{at:0,color:'#ff0000'},{at:0,color:'#00ff00'},{at:1,color:'#0000ff'}],[{at:0,color:'red'},{at:1,color:'#00ff00'}]])assert.throws(()=>validatePaint({gradient:{stops}},true),/gradient/);
});
