import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {scanInk,inkPosition,paintInkScan} from '../src/properties/inkProgression.ts';
import {packedTextureGlow,updateTextureTextPalette} from '../src/textureGlow.ts';
import {configureTextureInkRows} from '../src/textureInkProgression.ts';
import {createInkTextPainter} from '../src/text/inkProgression.ts';
const mask=rows=>{const width=rows[0].length,height=rows.length,data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(rows[y][x]==='#')data[(y*width+x)*4+3]=255;return {width,height,data};};
const image=mask(['#..##','#...#','##..#']);
const p={mode:'text',colors:['#ff0000','#0000ff'],ink:'color',distribution:'balanced',imageRatio:[3,7],progression:'ink-serpentine'};
test('ink climbs and descends occupied columns, skipping spaces, holes and unequal letter heights',()=>{
 const scan=scanInk(image.width,image.height,image.data),expected=[[0,2,0],[0,1,1],[0,0,2],[1,2,3],[3,0,4],[4,0,5],[4,1,6],[4,2,7]];for(const [x,y,position]of expected)assert.equal(inkPosition(scan,x,y),position);
 const spaced=mask(['..#.....##','..#......#','..##.....#']),other=scanInk(spaced.width,spaced.height,spaced.data);for(const [x,y,position]of expected){const shifted=x===0?2:x===1?3:x===3?8:9;assert.equal(inkPosition(other,shifted,y),position);}
});
test('separate rendered rows restart their ink stream without counting blank pixels',()=>{
 const m=mask(['#.#','###','...','###','#.#']),scan=scanInk(m.width,m.height,m.data,3,4,[0,3,5]);assert.equal(inkPosition(scan,0,1,0),0);assert.equal(inkPosition(scan,0,4,1),0);assert.equal(inkPosition(scan,2,3,1),4);
});
test('distribution and scale operate on ink positions, including different colors within one vertical stroke',()=>{
 const scan=scanInk(image.width,image.height,image.data),rgb=(data,x,y)=>[...data.slice((y*image.width+x)*4,(y*image.width+x)*4+3)],paint=paintInkScan(scan,p);assert.deepEqual(rgb(paint,0,2),[0,0,255]);assert.deepEqual(rgb(paint,0,1),[255,0,0]);assert.deepEqual(rgb(paint,0,0),[0,0,255]);
 const scaled=paintInkScan(scan,{...p,scale:2});assert.deepEqual(rgb(scaled,0,2),rgb(scaled,0,1));assert.notDeepEqual(rgb(scaled,0,1),rgb(scaled,0,0));
});
test('world labels reuse packed coverage and a small column table without rescanning on theme edits',()=>{
 const packed=new Uint8ClampedArray(image.data);for(let i=0;i<packed.length;i+=4){packed[i]=image.data[i+3];packed[i+1]=200;packed[i+3]=255;}let reads=0;const canvas={width:image.width,height:image.height,getContext:()=>({getImageData:()=>{reads++;return {data:new Uint8ClampedArray(packed)};},putImageData:data=>packed.set(data.data)})},texture=new T.CanvasTexture(canvas),material=new T.MeshBasicMaterial({map:texture});packedTextureGlow(material);configureTextureInkRows(material,0,image.height,1);updateTextureTextPalette(material,p);const shader={uniforms:{},fragmentShader:T.ShaderLib.basic.fragmentShader};material.onBeforeCompile(shader,{});assert.equal(shader.uniforms.textInkScan.value,1);const table=shader.uniforms.textInkColumns.value,scan=scanInk(image.width,image.height,image.data);assert.deepEqual(table.image.data,scan.columns);assert.equal(table.image.height,1);assert.equal(table.magFilter,T.NearestFilter);
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const at=(y*image.width+x)*4,count=scan.columns[x*4+1],rank=Math.round(packed[at+2]/255*Math.max(0,count-1));assert.equal(rank,scan.ranks[y*image.width+x]);assert.equal(packed[at],image.data[at+3]);assert.equal(packed[at+1],200);assert.equal(packed[at+3],255);}
 const cycle=shader.uniforms.textPalettePattern.value;updateTextureTextPalette(material,{...p,scale:3});assert.equal(shader.uniforms.textPalettePattern.value,cycle);updateTextureTextPalette(material,{...p,scale:3,distribution:'growing'});assert.equal(reads,1);assert.equal(shader.uniforms.textInkColumns.value,table);let disposed=0;table.addEventListener('dispose',()=>disposed++);updateTextureTextPalette(material,{...p,progression:'horizontal'});assert.equal(shader.uniforms.textInkScan.value,0);assert.equal(disposed,1);material.dispose();texture.dispose();
});
test('document glyph maps survive color edits and clear their inline paint when disabled',()=>{
 const previous=globalThis.document;let scans=0,draws=0;const written=[];globalThis.document={createElement:()=>({getContext:()=>({fillText(){draws++;},getImageData:()=>{scans++;return {data:image.data};},createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:data=>written.push(data.data)}),toDataURL:()=>`data:image/png;base64,${written.length}`})};
 const style={setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];delete this[k.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())];}},element={style},row={key:'same-glyph-layout',fragments:[{text:'xt',font:'12px sans-serif',spacing:'0px',wordSpacing:'0px',width:image.width}],marks:[{element,start:0,ascent:2}],width:image.width,height:image.height,ascent:2},painter=createInkTextPainter();
 try{painter.render([row],p);const first=style.backgroundImage;painter.render([row],{...p,distribution:'growing'});assert.equal(scans,1);assert.equal(draws,1);assert.notEqual(style.backgroundImage,first);const count=written.length;painter.render([row],{...p,distribution:'growing',colors:['#00ff00','#ff00ff']});assert.equal(written.length,count);assert.equal(scans,1);assert.equal(style['box-decoration-break'],'slice');painter.invalidate();painter.render([row],{...p,distribution:'growing'});assert.equal(scans,2);painter.clear();assert.equal(style.backgroundImage,undefined);}finally{globalThis.document=previous;}
});
test('indexed glyph pixels resolve through a tiny palette lookup with glow derived after color mapping',async()=>{
 const {createPalettePaint}=await import('../src/ui/palettePaint.ts');const previous=globalThis.document;
 class Element{children=[];attrs={};style={setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];}};setAttribute(k,v){this.attrs[k]=v;}toggleAttribute(k,v){if(v)this.attrs[k]='';else delete this.attrs[k];}append(...nodes){this.children.push(...nodes);}replaceChildren(){this.children=[];}remove(){}}
 const body=new Element();globalThis.document={body,createElementNS:()=>new Element(),createElement:()=>({getContext:()=>({createImageData:w=>({data:new Uint8ClampedArray(w*4)}),putImageData(){}}),toDataURL:()=> 'data:image/png;base64,pattern'})};
 try{const host=new Element(),sink=createPalettePaint(host,true),paint={palette:p,glow:1};sink.render(paint);const filter=body.children[1].children[0],lookup=filter.children[0];assert.equal(lookup.attrs.result,'paletteInk');assert.equal(lookup.children[0].attrs.type,'discrete');assert.equal(lookup.children[0].attrs.tableValues,'1 0');assert.equal(lookup.children[2].attrs.tableValues,'0 1');const smooth=filter.children.find(node=>node.attrs.result==='softPaletteInk'),opaque=filter.children.find(node=>node.attrs.result==='opaquePaletteInk'),restore=filter.children.find(node=>node.attrs.result==='smoothPaletteInk');assert.equal(smooth.attrs.in,'paletteInk');assert.equal(smooth.attrs.stdDeviation,'0.5');assert.equal(opaque.attrs.in,'softPaletteInk');assert.equal(restore.attrs.in,'opaquePaletteInk');assert.equal(restore.attrs.in2,'SourceGraphic');assert.equal(restore.attrs.operator,'in');const alphaRow=opaque.attrs.values.split(' ').slice(15).map(Number);assert.deepEqual(alphaRow,[0,0,0,0,1]);for(const sourceAlpha of [0,.1,.25,.7,1])for(const blurredAlpha of [0,.2,.8,1])assert.equal((alphaRow[3]*blurredAlpha+alphaRow[4])*sourceAlpha,sourceAlpha);assert.equal(filter.children.find(node=>node.attrs.result==='glowColor').attrs.in,'smoothPaletteInk');assert.equal(filter.children.at(-1).children.at(-1).attrs.in,'smoothPaletteInk');
  const scan=scanInk(image.width,image.height,image.data),indexed=paintInkScan(scan,p,true),rgb=paintInkScan(scan,p);for(let i=0;i<indexed.length;i+=4){const chosen=Math.min(1,Math.floor(indexed[i]/255*2));for(let c=0;c<3;c++)assert.equal(Number(lookup.children[c].attrs.tableValues.split(' ')[chosen])*255,rgb[i+c]);}
  sink.render({...paint,palette:{...p,colors:['#00ff00','#ff00ff']}});assert.equal(body.children.length,2);assert.equal(filter.children[0].children[1].attrs.tableValues,'1 0');
  sink.render({color:'#ffffff',palette:{...p,fillOpacity:0}});
  for(const [root,source] of [[body.children[0],'SourceGraphic'],[body.children[1],'smoothPaletteInk']]){
   const outlineFilter=root.children[0],outputs=new Map(outlineFilter.children.map(node=>[node.attrs.result,node.attrs]));
   assert.equal(outputs.get('edgeInk').in,source);
   assert.equal(outputs.get('outlineColor').in,'edgeInk');
   assert.equal(outputs.get('outline').in2,'outlineMask');
   assert.equal(outputs.get('interior'),undefined);
   assert.deepEqual(outlineFilter.children.at(-1).children.map(node=>node.attrs.in),['outline']);
  }
  sink.render({color:'#ff0000',palette:{...p,colors:['#ff0000'],fillOpacity:0}});
  assert.equal(body.children[0].children[0].children.find(node=>node.attrs.result==='outlineColor').attrs['flood-color'],'#ff0000');
  const pixels={mode:'text',distribution:'pixels',ink:'pale',colors:['#ff0000'],fillOpacity:1};
  sink.render({color:'#ff0000',palette:pixels});
  assert.ok('data-document-image-pixels' in host.attrs);
  const pixelFilter=body.children[2].children[0];
  assert.equal(host.style['--document-image-filter'],`url(#${pixelFilter.attrs.id})`);
  const primitive=name=>pixelFilter.children.find(node=>node.attrs.result===name);
  const weights=primitive('edgeLuminance').attrs.values.split(' ').slice(0,3).map(Number);
  const table=primitive('outlineColor').children[0].attrs.tableValues.split(' ').map(Number);
  const stroke=rgb=>table[Math.min(1,Math.floor(2*weights.reduce((value,weight,index)=>value+weight*rgb[index],0)))];
  assert.equal(stroke([.05,.05,.05]),1);
  assert.equal(stroke([.85,.85,.85]),0);
  assert.equal(primitive('outline').attrs.in2,'outlineMask');
  assert.equal(primitive('interior').attrs.in,'SourceGraphic');
  assert.equal(primitive('interior').children[0].attrs.slope,'0.25');
  assert.equal(primitive('interior').children.at(-1).attrs.slope,'1');
  sink.render({color:'#ff0000',palette:{...pixels,fillOpacity:0}});
  assert.equal(primitive('interior'),undefined);
  assert.ok(primitive('outline'));
  sink.render({palette:p});
  assert.ok(!('data-document-image-pixels' in host.attrs));
  sink.dispose();
 }finally{globalThis.document=previous;}
});
test('document ink measurement coalesces changes, invalidates typography and ignores work after disposal',async()=>{
 const {EditorState}=await import('@codemirror/state'),{documentPalette,showDocumentPalette,setDocumentPalette,setDocumentInkTypography}=await import('../src/text/palettePresentation.ts'),{glyphField}=await import('../src/text/source.ts');
 let state=EditorState.create({doc:'xt',extensions:[glyphField.init(()=>[])]});const measures=[],view={state,visibleRanges:[{from:0,to:2}],requestMeasure:measure=>measures.push(measure)},plugin=documentPalette.create(view);
 const update=effects=>{const tr=view.state.update({effects});view.state=tr.state;plugin.update({view,transactions:[tr],docChanged:false,viewportChanged:false,geometryChanged:false});};
 update([setDocumentPalette.of(p),showDocumentPalette.of(true),setDocumentInkTypography.of('font-a')]);assert.equal(measures.length,1);plugin.dirty=false;update(setDocumentPalette.of({...p,colors:['#00ff00','#ff00ff']}));assert.equal(measures.length,1);assert.equal(plugin.dirty,false);update(setDocumentInkTypography.of('font-b'));assert.equal(plugin.dirty,true);assert.equal(measures.length,1);plugin.destroy();assert.deepEqual(measures[0].read(view),[]);measures[0].write([]);assert.equal(plugin.queued,false);
});
test('native ink color sampling preserves fractional phase inside each original ink cell',async()=>{
 const {inkProgressionShader}=await import('../src/textureInkProgression.ts');const yExpression=inkProgressionShader.match(/float y=(.*?),up=/)[1],yValue=Function('rank','nativeY','sy','fract',`return ${yExpression};`),fract=n=>n-Math.floor(n),positionExpression=inkProgressionShader.match(/return (column\.r[^;]+);/)[1],position=Function('column','sx','sy','subColumn','y','up','mix','max',`return ${positionExpression};`),mix=(a,b,t)=>a+(b-a)*t;
 for(const fraction of [.1,.25,.5,.75,.9]){const y=yValue(2,2+fraction,1,fract);assert.ok(Math.abs(y-(2+fraction))<1e-6);assert.ok(Math.abs(position({r:7,g:3},1,1,0,y,0,mix,Math.max)-(9+fraction))<1e-6);assert.ok(Math.abs(position({r:7,g:3},1,1,0,y,1,mix,Math.max)-(8-fraction))<1e-6);}
});
test('vertical distribution advances down occupied rows and keeps left/right ink serpentine',()=>{
 const scan=scanInk(image.width,image.height,image.data,3,4,[0,image.height],1),expected=[[0,0,0],[3,0,1],[4,0,2],[4,1,3],[0,1,4],[0,2,5],[1,2,6],[4,2,7]];assert.equal(scan.major,image.height);for(const [x,y,position]of expected)assert.equal(inkPosition(scan,x,y),position);
 const gaps=mask(['#..##','.....','#...#','.....','##..#']),spaced=scanInk(gaps.width,gaps.height,gaps.data,3,4,[0,gaps.height],1);for(const [x,y,position]of expected)assert.equal(inkPosition(spaced,x,y*2),position);
});
test('native distribution direction transposes the ink map without disabling serpentine',()=>{
 const packed=new Uint8ClampedArray(image.data);for(let i=0;i<packed.length;i+=4){packed[i]=image.data[i+3];packed[i+1]=200;packed[i+3]=255;}let reads=0;const canvas={width:image.width,height:image.height,getContext:()=>({getImageData:()=>{reads++;return {data:new Uint8ClampedArray(packed)};},putImageData:data=>packed.set(data.data)})},texture=new T.CanvasTexture(canvas),material=new T.MeshBasicMaterial({map:texture});packedTextureGlow(material);configureTextureInkRows(material,0,image.height,1);updateTextureTextPalette(material,p);const shader={uniforms:{},fragmentShader:T.ShaderLib.basic.fragmentShader};material.onBeforeCompile(shader,{});const old=shader.uniforms.textInkColumns.value;let released=0;old.addEventListener('dispose',()=>released++);updateTextureTextPalette(material,{...p,distributionAxis:'vertical'});const scan=scanInk(image.width,image.height,image.data,3,4,[0,image.height],1),table=shader.uniforms.textInkColumns.value;assert.equal(shader.uniforms.textInkScan.value,1);assert.equal(shader.uniforms.textInkAxis.value,1);assert.equal(shader.uniforms.textPaletteAxis.value,1);assert.deepEqual(table.image.data,scan.columns);assert.equal(table.image.width,image.height);assert.equal(released,1);assert.equal(reads,2);
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const at=(y*image.width+x)*4,count=scan.columns[y*4+1];assert.equal(Math.round(packed[at+2]/255*Math.max(0,count-1)),scan.ranks[y*image.width+x]);assert.equal(packed[at],image.data[at+3]);assert.equal(packed[at+1],200);assert.equal(packed[at+3],255);}
 const flowExpression=shader.fragmentShader.match(/vec2 flow=([^;]+);/)[1],flow=Function('textInkAxis','uv','vec2',`return ${flowExpression};`);assert.deepEqual(flow(1,{x:.25,y:1},(x,y)=>({x,y})),{x:0,y:.25});updateTextureTextPalette(material,{...p,distributionAxis:'vertical',scale:2});assert.equal(reads,2);assert.equal(shader.uniforms.textInkColumns.value,table);material.dispose();texture.dispose();
});
test('document ink maps change direction while preserving the selected progression and color cache',()=>{
 const previous=globalThis.document;let scans=0;const written=[];globalThis.document={createElement:()=>({getContext:()=>({fillText(){},getImageData:()=>{scans++;return {data:image.data};},createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:data=>written.push(data.data)}),toDataURL:()=>`data:image/png;base64,${written.length}`})};const style={setProperty(){},removeProperty(){}},row={key:'xt',fragments:[{text:'xt',font:'12px sans-serif',spacing:'0px',wordSpacing:'0px',width:image.width}],marks:[{element:{style},start:0,ascent:2}],width:image.width,height:image.height,ascent:2},painter=createInkTextPainter();
 try{painter.render([row],p);const first=written[0],vertical={...p,distributionAxis:'vertical'};painter.render([row],vertical);assert.equal(scans,2);assert.notDeepEqual(written[1],first);assert.deepEqual(written[1],paintInkScan(scanInk(image.width,image.height,image.data,3,4,[0,image.height],1),vertical,true));painter.render([row],{...vertical,colors:['#00ff00','#ff00ff']});assert.equal(scans,2);assert.equal(written.length,2);painter.clear();}finally{globalThis.document=previous;}
});
test('multiline vertical maps use local row tables and restart each text row',()=>{
 const m=mask(['#.#','###','...','###','#.#']),scan=scanInk(m.width,m.height,m.data,3,4,[0,3,5],1);assert.equal(scan.major,3);assert.equal(scan.columns.length,3*2*4);assert.equal(inkPosition(scan,0,0,0),0);assert.equal(inkPosition(scan,0,3,1),0);assert.equal(inkPosition(scan,2,4,1),3);assert.equal(inkPosition(scan,0,4,1),4);
});
