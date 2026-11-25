import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {imageColorCombo,matchedImageColors,comboPalette,motifCandidates} from '../src/scene/colorCombo.ts';
import {focusPattern,focusPaletteGeometry,isFittedField,isSourceField} from '../src/properties/focusPalette.ts';
import {imageField} from '../src/scene/imageField.ts';
import {createDocumentFieldPainter} from '../src/text/fieldPresentation.ts';
import {packedTextureGlow,updateTextureTextPalette} from '../src/textureGlow.ts';
import {configureTextureInkRows} from '../src/textureInkProgression.ts';
const rgb=[[255,20,40],[20,70,230],[240,240,240]],width=64,height=64;
function source(){const pixels=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixels.set([...rgb[x<24?0:x<48?1:2],255],(y*width+x)*4);return imageColorCombo({width,height,pixels});}
function palette(combo,extra={}){const settings={distribution:'image',ink:'color',inverseDistribution:false,...extra};return comboPalette(matchedImageColors(combo,settings),settings);}
const counts=p=>p.colors.map((_,i)=>p.field.cells.filter(c=>c===i).length);
test('image relations integrates motif membership, shares and linked tone settings into one fitted field',()=>{
 const combo=source(),p=palette(combo);assert.equal(isSourceField(p),false);assert.equal(isFittedField(p),true);assert.ok(p.field.cells.length);assert.equal(p.field.rgb,undefined);assert.deepEqual(counts(p).sort((a,b)=>a-b),[1024,1536,1536]);assert.deepEqual(focusPaletteGeometry({...p,scale:32}),{size:'100% 100%',repeat:'no-repeat'});
 const blue=motifCandidates(combo.source).find(c=>c.id==='h5'),off=palette(combo,{motifOverrides:{[blue.id]:false}});assert.ok(!off.colors.includes(p.colors[motifCandidates(combo.source).findIndex(c=>c.id===blue.id)]));assert.equal(off.colors.length,2);assert.ok(off.field.cells.every(c=>c<2));assert.equal(palette(combo).field,p.field);
 const toned=palette(combo,{saturation:.4});assert.equal(toned.field,p.field);assert.notDeepEqual(focusPattern(toned).glow,focusPattern(p).glow);const pale=palette(combo,{ink:'pale'}),paint=focusPattern(pale);for(let i=0;i<paint.glow.length;i+=4)for(let c=0;c<3;c++)assert.ok(paint.ink[i+c]>=paint.glow[i+c]);
 const inverted=palette(combo,{inverseOccupation:true});assert.deepEqual(counts(inverted).sort((a,b)=>a-b),counts(p).sort((a,b)=>a-b));assert.notDeepEqual(inverted.field.cells,p.field.cells);
});
test('neighborhood simplification removes isolated specks from their original position while retaining broad regions',()=>{
 const cells=new Uint8Array(64*64);for(let y=0;y<64;y++)for(let x=32;x<64;x++)cells[y*64+x]=1;cells[20*64+20]=1;const source={spatial:{width:64,height:64,cells,families:['h0','h5']}},field=imageField(source,[0,1],[2047,2049]);assert.equal(field.cells[20*64+20],0);assert.equal(field.cells[20*64+10],0);assert.equal(field.cells[20*64+50],1);assert.equal(field.cells.filter(c=>c===1).length,2049);
});
test('headings, words and wrapped fragments sample the same document field instead of separate miniatures',()=>{
 const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}),toDataURL:()=> 'data:image/png;base64,motif'})};const element=()=>({style:{setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())];}}}),heading=element(),word=element(),continuation=element(),painter=createDocumentFieldPainter(),bounds={width:900,height:1800};
 try{painter.render([{element:heading,from:0,to:5,x:0,y:0,bounds},{element:word,from:6,to:10,x:280,y:400,bounds},{element:continuation,from:11,to:15,x:20,y:420,bounds}],palette(source()));for(const e of [heading,word,continuation]){assert.equal(e.style.backgroundSize,'900px 1800px');assert.equal(e.style.backgroundRepeat,'no-repeat');assert.equal(e.style.backgroundImage,heading.style.backgroundImage);}assert.equal(word.style.backgroundPosition,'-280px -400px');assert.equal(continuation.style.backgroundPosition,'-20px -420px');painter.clear();}finally{globalThis.document=previous;}
});
test('world text inherits the same simplified field and fitted bounds, including palette changes',()=>{
 const mask=new Uint8ClampedArray(8*4*4).fill(255),canvas={width:8,height:4,getContext:()=>({getImageData:()=>({data:mask}),putImageData(){}})},material=new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas)});packedTextureGlow(material);configureTextureInkRows(material,0,4,1);const combo=source(),p=palette(combo);updateTextureTextPalette(material,p);const shader={uniforms:{},fragmentShader:T.ShaderLib.basic.fragmentShader};material.onBeforeCompile(shader,{});assert.equal(shader.uniforms.textPaletteFitted.value,1);assert.equal(shader.uniforms.textPalettePattern.value.wrapS,T.ClampToEdgeWrapping);assert.deepEqual(shader.uniforms.textPalettePattern.value.image.data,focusPattern(p).glow);const next=palette(combo,{motifOverrides:{h5:false}});updateTextureTextPalette(material,next);assert.deepEqual(shader.uniforms.textPalettePattern.value.image.data,focusPattern(next).glow);material.dispose();material.map.dispose();
});
