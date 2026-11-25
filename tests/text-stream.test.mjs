import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {textStream,textureTextStream} from '../src/properties/textStream.ts';
import {createStartEndPainter} from '../src/text/startEndProgression.ts';
import {imageColorCombo,matchedImageColors,comboPalette,motifCandidates} from '../src/scene/colorCombo.ts';
import {validTextPalette} from '../src/properties/textPalette.ts';
import {focusPattern} from '../src/properties/focusPalette.ts';
import {emptyWorld,validateWorld} from '../src/core/model.ts';
import {setThemeInclusions,setMotifMembership} from '../src/scene/themeControls.ts';
import {packedTextureGlow,updateTextureTextPalette} from '../src/textureGlow.ts';
import {configureTextureInkRows} from '../src/textureInkProgression.ts';
const colors=['#ff0000','#ff8800','#ffff00','#00ff00','#00ffff','#0000ff','#8800ff','#ff00aa','#000000','#888888','#ffffff'];
test('all eleven detected families can participate; ninth inclusion and membership survive persistence',()=>{
 const source=imageColorCombo(new Uint8ClampedArray(Array.from({length:110},(_,i)=>[...colors[i%11].slice(1).match(/../g).map(c=>parseInt(c,16)),255]).flat()));
 const overrides=Object.fromEntries(motifCandidates(source.source).map(c=>[c.id,true]));const combo=matchedImageColors(source,{distribution:'image',motifOverrides:overrides});assert.equal(combo.textPalette.length,11);assert.equal(combo.textAvailable,11);assert.equal(validTextPalette(comboPalette(combo)),true);assert.equal(new Set(focusPattern(comboPalette(combo,{distribution:'balanced'})).indices).size,11);
 const world=emptyWorld();setThemeInclusions(world,undefined,colors);setMotifMembership(world,undefined,'#ffffff',true,colors.map(id=>({id,enabled:true})));world.appearance.text={palette:comboPalette(combo,{distribution:'image',progression:'start-end',debugPattern:true})};const copy=JSON.parse(JSON.stringify(world));validateWorld(copy);assert.equal(copy.appearance.imageColors.default.palette.included.length,11);assert.equal(copy.appearance.text.palette.colors.length,11);
});
test('whole-document stream crosses paragraphs without blank-row distance or viewport resets',()=>{
 const text='ab\n\n   \ncd\nef',flow=textStream(text,s=>s.length*10);assert.equal(flow.total,60);assert.equal(flow.position(0),0);assert.equal(flow.position(text.indexOf('cd')),20);assert.equal(flow.position(text.indexOf('ef')),40);assert.equal(flow.position(text.length),60);assert.equal(flow.position(5),20);
 const edited=textStream('ab\n\n   \nXYZ\ncd\nef',s=>s.length*10);assert.equal(edited.position('ab\n\n   \nXYZ\ncd\nef'.indexOf('cd')),50);
});
test('start-end painter uses one full-length strip across wrapped fragments and clears it on exit',()=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}),toDataURL:()=> 'data:image/png;base64,stream'})};
 const mark=()=>({style:{setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())];}}}),a=mark(),b=mark(),painter=createStartEndPainter();try{painter.render({total:300,marks:[{element:a,start:0,end:100,width:100},{element:b,start:200,end:300,width:100}]},{mode:'text',colors:['#ff0000','#0000ff'],distribution:'balanced',distributionAxis:'vertical',progression:'start-end',ink:'color'});assert.equal(a.style.backgroundSize,'300px 100%');assert.equal(b.style.backgroundPosition,'-200px 0px');assert.equal(a.style['box-decoration-break'],'slice');painter.clear();assert.equal(b.style.backgroundImage,undefined);}finally{globalThis.document=old;}
});
test('world stream crops padding, skips empty rows and retains interior spaces',()=>{
 const width=8,height=6,pixels=new Uint8ClampedArray(width*height*4);for(const [x,y]of [[1,0],[4,1],[2,4],[6,5]])pixels[(y*width+x)*4]=255;const flow=textureTextStream(width,height,pixels,[0,2,4,6]);assert.equal(flow.total,9);assert.deepEqual([...flow.table],[0,1,4,0,4,0,0,0,4,2,5,0]);
});
test('world start-end shares the palette, caches its row table and restores serpentine and ordinary modes',()=>{
 let reads=0;const pixels=new Uint8ClampedArray(8*6*4);pixels[4]=255;pixels[(4*8+6)*4]=255;
 const canvas={width:8,height:6,getContext:()=>({getImageData:()=>{reads++;return {data:new Uint8ClampedArray(pixels)};},putImageData(){}})},material=new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas)});packedTextureGlow(material);configureTextureInkRows(material,0,2,3);
 const palette={mode:'text',colors:['#ff0000','#0000ff'],distribution:'balanced',progression:'start-end',debugPattern:true};updateTextureTextPalette(material,palette);const shader={uniforms:{},fragmentShader:'#include <map_fragment>'};material.onBeforeCompile(shader,{});assert.equal(shader.uniforms.textStream.value,1);assert.equal(shader.uniforms.textInkScan.value,0);assert.equal(shader.uniforms.textStreamTotal.value,2);assert.equal(shader.uniforms.textPatternDebug.value,1);const table=shader.uniforms.textInkColumns.value;
 updateTextureTextPalette(material,{...palette,scale:2,colors:['#00ff00','#ff00ff']});assert.equal(reads,1);assert.equal(shader.uniforms.textInkColumns.value,table);assert.equal(shader.uniforms.textStreamScale.value,2);
 updateTextureTextPalette(material,{...palette,progression:'ink-serpentine',debugPattern:false});assert.equal(reads,2);assert.equal(shader.uniforms.textStream.value,0);assert.equal(shader.uniforms.textInkScan.value,1);assert.equal(shader.uniforms.textPatternDebug.value,0);
 updateTextureTextPalette(material,{...palette,progression:'horizontal'});assert.equal(shader.uniforms.textInkScan.value,0);assert.equal(shader.uniforms.textStream.value,0);material.dispose();material.map.dispose();
});
test('indexed ink addresses every swatch through the full byte range without merging final colors',async()=>{
 const {scanInk,paintInkScan}=await import('../src/properties/inkProgression.ts');
 for(const count of [9,11,128,255,256]){const pixels=new Uint8ClampedArray(count*4).fill(255),scan=scanInk(count,1,pixels),p={mode:'text',colors:Array.from({length:count},(_,i)=>'#'+i.toString(16).padStart(6,'0')),imageRatio:Array(count).fill(1),distribution:'balanced',ink:'color'},out=paintInkScan(scan,p,true),decoded=Array.from({length:count},(_,i)=>Math.min(count-1,Math.floor(out[i*4]/255*count)));assert.equal(new Set(decoded).size,count);assert.deepEqual(decoded,focusPattern(p).indices);}
});
test('switching progression while a document measure is queued schedules the new mode',async()=>{
 const {EditorState}=await import('@codemirror/state'),{documentPalette,setDocumentPalette,showDocumentPalette}=await import('../src/text/palettePresentation.ts'),{glyphField}=await import('../src/text/source.ts');let state=EditorState.create({doc:'abc',extensions:[glyphField.init(()=>[])]});const measures=[],view={state,visibleRanges:[{from:0,to:3}],requestMeasure:m=>measures.push(m)},plugin=documentPalette.create(view);
 const update=palette=>{const tr=view.state.update({effects:[setDocumentPalette.of(palette),showDocumentPalette.of(true)]});view.state=tr.state;plugin.update({view,transactions:[tr]});},base={mode:'text',colors:['#ff0000','#0000ff'],distribution:'balanced'};
 update({...base,progression:'ink-serpentine'});assert.equal(measures.length,1);update({...base,progression:'start-end'});assert.equal(measures.length,1);measures[0].write([]);assert.equal(measures.length,2);update({...base,progression:'horizontal'});measures[1].write({total:0,marks:[]});assert.equal(measures.length,2);plugin.destroy();
});
test('document serpentine refreshes relationship edits while reusing the existing glyph scan',async()=>{
 const {createInkTextPainter}=await import('../src/text/inkProgression.ts');const old=globalThis.document;let reads=0,writes=0;globalThis.document={createElement:()=>({getContext:()=>({fillText(){},getImageData:()=>{reads++;return {data:new Uint8ClampedArray(64*4).fill(255)};},createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){writes++;}}),toDataURL:()=>`data:image/png;base64,${writes}`})};
 try{const painter=createInkTextPainter(),style={setProperty(){},removeProperty(){}},row={key:'same-letters',fragments:[{text:'letters',font:'12px sans-serif',spacing:'0px',wordSpacing:'0px',width:64}],marks:[{element:{style},start:0,ascent:1}],width:64,height:1,ascent:1},base={mode:'text',colors:['#ff0000','#0000ff'],distribution:'balanced',progression:'ink-serpentine'};painter.render([row],base);const first=style.backgroundImage;painter.render([row],{...base,inverseDistribution:true});assert.equal(reads,1);assert.equal(writes,2);assert.notEqual(style.backgroundImage,first);painter.clear();}finally{globalThis.document=old;}
});
test('start-end document measurement retains its global phase when only later rows are mounted',()=>{
 const oldDocument=globalThis.document,oldStyle=globalThis.getComputedStyle;let measured=0;globalThis.document={createElement:()=>({getContext:()=>({measureText:text=>{measured++;return {width:text.length*10};}})})};globalThis.getComputedStyle=()=>({font:'12px sans-serif',letterSpacing:'normal',wordSpacing:'normal'});
 try{const text='ab\n\ncd',doc={toString:()=>text},a={textContent:'ab',at:0,end:2,childNodes:[{}],getClientRects:()=>[{width:20}]},b={textContent:'cd',at:4,end:6,childNodes:[{}],getClientRects:()=>[{width:10},{width:10}]};let mounted=[a,b];const view={contentDOM:{},dom:{querySelectorAll:()=>mounted},state:{doc},posAtDOM:(e,offset)=>offset?e.end:e.at},painter=createStartEndPainter();const first=painter.read(view),calls=measured;assert.deepEqual(first.marks.map(m=>[m.start,m.end,m.width]),[[0,20,20],[20,40,20]]);mounted=[b];const scrolled=painter.read(view);assert.equal(scrolled.total,40);assert.equal(scrolled.marks[0].start,20);assert.equal(measured,calls);painter.invalidate();painter.read(view);assert.ok(measured>calls);}finally{globalThis.document=oldDocument;globalThis.getComputedStyle=oldStyle;}
});
