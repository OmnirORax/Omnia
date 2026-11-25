import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState} from '@codemirror/state';
import {documentPalette,setDocumentPalette,showDocumentPalette} from '../src/text/palettePresentation.ts';
import {glyphField} from '../src/text/source.ts';

const palette={mode:'text',colors:['#ff0000','#0000ff'],distribution:'balanced',progression:'start-end',ink:'color',scale:3};
const mark=()=>({style:{setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];delete this[k.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())];}}});

test('cursor/focus redraws reattach start-end paint to replacement spans without changing settings',()=>{
 const previousDocument=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}),toDataURL:()=> 'data:image/png;base64,pattern'})};
 const state=EditorState.create({doc:'abc\ndef',extensions:[glyphField.init(()=>[])]}),measures=[];
 const view={state,visibleRanges:[{from:0,to:7}],requestMeasure:measure=>measures.push(measure)},plugin=documentPalette.create(view);
 let element=mark(),reads=0;
 plugin.stream.read=()=>{reads++;return {total:60,marks:[{element,start:30,end:60,width:30}]};};
 function update(spec={},flags={}){
  const tr=view.state.update(spec);view.state=tr.state;
  plugin.update({view,transactions:[tr],docChanged:tr.docChanged,viewportChanged:false,geometryChanged:false,selectionSet:!!tr.selection,focusChanged:false,...flags});
 }
 function flush(){while(measures.length){const measure=measures.shift();measure.write(measure.read(view));}}
 try{
  update({effects:[setDocumentPalette.of(palette),showDocumentPalette.of(true)]});flush();
  const expected=element.style.backgroundImage;assert.ok(expected);assert.equal(element.style.backgroundPosition,'-30px 0px');
  // The editor's selection-dependent formatting redraw replaces the painted span.
  const previous=element;element=mark();update({selection:{anchor:5}});
  assert.equal(measures.length,1,'selection-only updates must schedule repaint after DOM reconciliation');
  flush();assert.equal(element.style.backgroundImage,expected);assert.equal(previous.style.backgroundImage,undefined);
  assert.equal(element.style.backgroundSize,'180px 100%');assert.equal(plugin.palette,palette);
  element=mark();update({}, {focusChanged:true});flush();assert.equal(element.style.backgroundImage,expected);
  // Repeated cursor changes coalesce into one read of the final mounted DOM.
  element=mark();update({selection:{anchor:1}});update({selection:{anchor:6}});assert.equal(measures.length,1);
  flush();assert.equal(element.style.backgroundImage,expected);assert.equal(reads,4);
  update();assert.equal(measures.length,0,'unrelated updates need no extra geometry work');
  update({effects:showDocumentPalette.of(false)});update({selection:{anchor:2}});assert.equal(measures.length,0);
 }finally{plugin.destroy();globalThis.document=previousDocument;}
});

test('selection changes invalidate cached ink-row element references without discarding raster caches',()=>{
 const state=EditorState.create({doc:'abc',extensions:[glyphField.init(()=>[])]}),measures=[];
 const view={state,visibleRanges:[{from:0,to:3}],requestMeasure:measure=>measures.push(measure)},plugin=documentPalette.create(view);
 const p={...palette,progression:'ink-serpentine'};
 let tr=state.update({effects:[setDocumentPalette.of(p),showDocumentPalette.of(true)]});view.state=tr.state;
 plugin.update({view,transactions:[tr]});measures.shift().write([]);plugin.dirty=false;
 const raster=plugin.ink;let invalidated=0;plugin.ink.invalidate=()=>invalidated++;
 tr=view.state.update({selection:{anchor:2}});view.state=tr.state;
 plugin.update({view,transactions:[tr],selectionSet:true,geometryChanged:false});
 assert.equal(measures.length,1);assert.equal(plugin.dirty,true,'row references/geometry must be read after redraw');
 assert.equal(plugin.ink,raster);assert.equal(invalidated,0,'unchanged glyph rows reuse their existing raster cache');
 plugin.destroy();assert.deepEqual(measures[0].read(view),[]);measures[0].write([]);
});

for(const mode of ['image','pixels'])test(`${mode} document coordinates are reapplied after cursor and focus redraws`,()=>{
 const state=EditorState.create({doc:'abc',extensions:[glyphField.init(()=>[])]}),measures=[];
 const view={state,visibleRanges:[{from:0,to:3}],requestMeasure:m=>measures.push(m)},plugin=documentPalette.create(view);
 let painted=0;
 if(mode==='pixels'){
  plugin.pixels.watch=()=>{};plugin.pixels.read=()=>({point:{left:0,top:0},cuts:[],runs:[]});plugin.pixels.render=()=>painted++;
 }else{plugin.field.read=()=>[];plugin.field.render=()=>painted++;}
 const p={...palette,progression:'start-end',distribution:mode,...(mode==='image'?{field:{width:2,height:1,cells:[0,1]}}:{})};
 function update(spec={},flags={}){
  const tr=view.state.update(spec);view.state=tr.state;plugin.update({view,transactions:[tr],selectionSet:!!tr.selection,...flags});
 }
 function flush(){assert.equal(measures.length,1);const m=measures.shift();m.write(m.read(view));}
 try{
  update({effects:[setDocumentPalette.of(p),showDocumentPalette.of(true)]});flush();
  update({selection:{anchor:2}});flush();update({}, {focusChanged:true});flush();
  assert.equal(painted,3);assert.equal(plugin.palette,p);
 }finally{plugin.destroy();}
});
