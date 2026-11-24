import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {scanInk,inkPosition,paintInkScan} from '../src/properties/inkProgression.ts';
import {packedTextureGlow,updateTextureTextPalette} from '../src/textureGlow.ts';
import {configureTextureInkRows} from '../src/textureInkProgression.ts';
import {createInkTextPainter} from '../src/text/inkProgression.ts';
const mask=rows=>{const width=rows[0].length,height=rows.length,data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(rows[y][x]==='#')data[(y*width+x)*4+3]=255;return {width,height,data};};
const image=mask(['#..##','#...#','##..#']);
const p={mode:'text',colors:['#ff0000','#0000ff'],ink:'color',distribution:'alternating',imageRatio:[3,7],progression:'ink-serpentine'};
test('ink climbs and descends occupied columns, skipping spaces, holes and unequal letter heights',()=>{
 const scan=scanInk(image.width,image.height,image.data),expected=[[0,2,0],[0,1,1],[0,0,2],[1,2,3],[3,0,4],[4,0,5],[4,1,6],[4,2,7]];for(const [x,y,position]of expected)assert.equal(inkPosition(scan,x,y),position);
 const spaced=mask(['..#.....##','..#......#','..##.....#']),other=scanInk(spaced.width,spaced.height,spaced.data);for(const [x,y,position]of expected){const shifted=x===0?2:x===1?3:x===3?8:9;assert.equal(inkPosition(other,shifted,y),position);}
});
test('separate rendered rows restart their ink stream without counting blank pixels',()=>{
 const m=mask(['#.#','###','...','###','#.#']),scan=scanInk(m.width,m.height,m.data,3,4,[0,3,5]);assert.equal(inkPosition(scan,0,1,0),0);assert.equal(inkPosition(scan,0,4,1),0);assert.equal(inkPosition(scan,2,3,1),4);
});
test('distribution and scale operate on ink positions, including different colors within one vertical stroke',()=>{
 const scan=scanInk(image.width,image.height,image.data),rgb=(data,x,y)=>[...data.slice((y*image.width+x)*4,(y*image.width+x)*4+3)],paint=paintInkScan(scan,p);assert.deepEqual(rgb(paint,0,2),[255,0,0]);assert.deepEqual(rgb(paint,0,1),[0,0,255]);assert.deepEqual(rgb(paint,0,0),[255,0,0]);
 const scaled=paintInkScan(scan,{...p,scale:2});assert.deepEqual(rgb(scaled,0,2),rgb(scaled,0,1));assert.notDeepEqual(rgb(scaled,0,1),rgb(scaled,0,0));
});
test('world labels reuse packed coverage and a small column table without rescanning on theme edits',()=>{
 const packed=new Uint8ClampedArray(image.data);for(let i=0;i<packed.length;i+=4){packed[i]=image.data[i+3];packed[i+1]=200;packed[i+3]=255;}let reads=0;const canvas={width:image.width,height:image.height,getContext:()=>({getImageData:()=>{reads++;return {data:new Uint8ClampedArray(packed)};},putImageData:data=>packed.set(data.data)})},texture=new T.CanvasTexture(canvas),material=new T.MeshBasicMaterial({map:texture});packedTextureGlow(material);configureTextureInkRows(material,0,image.height,1);updateTextureTextPalette(material,p);const shader={uniforms:{},fragmentShader:T.ShaderLib.basic.fragmentShader};material.onBeforeCompile(shader,{});assert.equal(shader.uniforms.textInkScan.value,1);const table=shader.uniforms.textInkColumns.value,scan=scanInk(image.width,image.height,image.data);assert.deepEqual(table.image.data,scan.columns);assert.equal(table.image.height,1);
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const at=(y*image.width+x)*4,count=scan.columns[x*4+1],rank=Math.round(packed[at+2]/255*Math.max(0,count-1));assert.equal(rank,scan.ranks[y*image.width+x]);assert.equal(packed[at],image.data[at+3]);assert.equal(packed[at+1],200);assert.equal(packed[at+3],255);}
 const cycle=shader.uniforms.textPalettePattern.value;updateTextureTextPalette(material,{...p,scale:3});assert.equal(shader.uniforms.textPalettePattern.value,cycle);updateTextureTextPalette(material,{...p,scale:3,distribution:'growing'});assert.equal(reads,1);assert.equal(shader.uniforms.textInkColumns.value,table);let disposed=0;table.addEventListener('dispose',()=>disposed++);updateTextureTextPalette(material,{...p,progression:'horizontal'});assert.equal(shader.uniforms.textInkScan.value,0);assert.equal(disposed,1);material.dispose();texture.dispose();
});
test('document glyph maps survive color edits and clear their inline paint when disabled',()=>{
 const previous=globalThis.document;let scans=0,draws=0;const written=[];globalThis.document={createElement:()=>({getContext:()=>({fillText(){draws++;},getImageData:()=>{scans++;return {data:image.data};},createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:data=>written.push(data.data)}),toDataURL:()=>`data:image/png;base64,${written.length}`})};
 const style={setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];delete this[k.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())];}},element={style},row={key:'same-glyph-layout',fragments:[{text:'xt',font:'12px sans-serif',spacing:'0px',wordSpacing:'0px',width:image.width}],marks:[{element,start:0,ascent:2}],width:image.width,height:image.height,ascent:2},painter=createInkTextPainter();
 try{painter.render([row],p);const first=style.backgroundImage;painter.render([row],{...p,distribution:'grouped'});assert.equal(scans,1);assert.equal(draws,1);assert.notEqual(style.backgroundImage,first);const count=written.length;painter.render([row],{...p,distribution:'grouped',colors:['#00ff00','#ff00ff']});assert.equal(written.length,count);assert.equal(scans,1);assert.equal(style['box-decoration-break'],'slice');painter.invalidate();painter.render([row],{...p,distribution:'grouped'});assert.equal(scans,2);painter.clear();assert.equal(style.backgroundImage,undefined);}finally{globalThis.document=previous;}
});
test('indexed glyph pixels resolve through a tiny palette lookup with glow derived after color mapping',async()=>{
 const {createPalettePaint}=await import('../src/ui/palettePaint.ts');const previous=globalThis.document;
 class Element{children=[];attrs={};style={setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];}};setAttribute(k,v){this.attrs[k]=v;}toggleAttribute(k,v){if(v)this.attrs[k]='';else delete this.attrs[k];}append(node){this.children.push(node);}replaceChildren(){this.children=[];}remove(){}}
 const body=new Element();globalThis.document={body,createElementNS:()=>new Element(),createElement:()=>({getContext:()=>({createImageData:w=>({data:new Uint8ClampedArray(w*4)}),putImageData(){}}),toDataURL:()=> 'data:image/png;base64,pattern'})};
 try{const host=new Element(),sink=createPalettePaint(host,true),paint={palette:p,glow:1};sink.render(paint);const filter=body.children[1].children[0],lookup=filter.children[0];assert.equal(lookup.attrs.result,'paletteInk');assert.equal(lookup.children[0].attrs.type,'discrete');assert.equal(lookup.children[0].attrs.tableValues,'1 0');assert.equal(lookup.children[2].attrs.tableValues,'0 1');assert.equal(filter.children[1].attrs.in,'paletteInk');assert.equal(filter.children.at(-1).children.at(-1).attrs.in,'paletteInk');
  const scan=scanInk(image.width,image.height,image.data),indexed=paintInkScan(scan,p,true),rgb=paintInkScan(scan,p);for(let i=0;i<indexed.length;i+=4){const chosen=Math.min(1,Math.floor(indexed[i]/255*2));for(let c=0;c<3;c++)assert.equal(Number(lookup.children[c].attrs.tableValues.split(' ')[chosen])*255,rgb[i+c]);}
  sink.render({...paint,palette:{...p,colors:['#00ff00','#ff00ff']}});assert.equal(body.children.length,2);assert.equal(filter.children[0].children[1].attrs.tableValues,'1 0');sink.dispose();
 }finally{globalThis.document=previous;}
});
test('document ink measurement coalesces changes, invalidates typography and ignores work after disposal',async()=>{
 const {EditorState}=await import('@codemirror/state'),{documentPalette,showDocumentPalette,setDocumentPalette,setDocumentInkTypography}=await import('../src/text/palettePresentation.ts'),{glyphField}=await import('../src/text/source.ts');
 let state=EditorState.create({doc:'xt',extensions:[glyphField.init(()=>[])]});const measures=[],view={state,visibleRanges:[{from:0,to:2}],requestMeasure:measure=>measures.push(measure)},plugin=documentPalette.create(view);
 const update=effects=>{const tr=view.state.update({effects});view.state=tr.state;plugin.update({view,transactions:[tr],docChanged:false,viewportChanged:false,geometryChanged:false});};
 update([setDocumentPalette.of(p),showDocumentPalette.of(true),setDocumentInkTypography.of('font-a')]);assert.equal(measures.length,1);plugin.dirty=false;update(setDocumentPalette.of({...p,colors:['#00ff00','#ff00ff']}));assert.equal(measures.length,1);assert.equal(plugin.dirty,false);update(setDocumentInkTypography.of('font-b'));assert.equal(plugin.dirty,true);assert.equal(measures.length,1);plugin.destroy();assert.deepEqual(measures[0].read(view),[]);measures[0].write([]);assert.equal(plugin.queued,false);
});
