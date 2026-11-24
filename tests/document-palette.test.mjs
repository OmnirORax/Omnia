import test from 'node:test';import assert from 'node:assert/strict';
import {EditorState} from '@codemirror/state';
import {documentPalette,showDocumentPalette,createDocumentPalettePaint} from '../src/text/palettePresentation.ts';
import {glyphField,toSource} from '../src/text/source.ts';
test('document gradients decorate visible text runs, exclude glyphs, and disappear outside within-text mode',()=>{
 const source=toSource({version:1,content:['abc ',{glyph:'x',word:'glyph'},' def\nsecond line\nhidden']});let state=EditorState.create({doc:source.text,extensions:[glyphField.init(()=>source.glyphs)]});const view={state,visibleRanges:[{from:0,to:state.doc.line(2).to}]},plugin=documentPalette.create(view),tr=state.update({effects:showDocumentPalette.of(true)});view.state=tr.state;plugin.update({view,transactions:[tr],docChanged:false,viewportChanged:false});const spans=[];plugin.decorations.between(0,view.state.doc.length,(from,to)=>spans.push([from,to]));assert.equal(spans.length,3);assert.ok(spans.every(([from,to])=>to<=view.visibleRanges[0].to&&!(from<=4&&to>4)));
 const off=view.state.update({effects:showDocumentPalette.of(false)});view.state=off.state;plugin.update({view,transactions:[off]});assert.equal(plugin.decorations.size,0);
});
test('one reusable document filter derives full-saturation glow and reuses unchanged strength/spread',()=>{
 const old=globalThis.document;let created=0;class Element{children=[];style={setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];}};attrs={};setAttribute(k,v){this.attrs[k]=v;}append(n){this.children.push(n);n.parent=this;}replaceChildren(){this.children=[];}remove(){this.parent.children=this.parent.children.filter(n=>n!==this);}}
 const body=new Element();globalThis.document={body,createElementNS:()=>{created++;return new Element();}};
 try{const host=new Element(),paint={palette:{mode:'text',colors:['#ff0000','#0000ff']},glow:1,glowSpread:6},sink=createDocumentPalettePaint(host);assert.equal(sink.render(paint),true);assert.equal(body.children.length,1);assert.match(host.style['--document-palette-gradient'],/hsl shorter hue/);const first=created;sink.render({...paint,fontSize:18});assert.equal(created,first);const transfer=body.children[0].children[0].children[0];assert.equal(transfer.children[0].attrs.slope,'4');assert.equal(transfer.children[0].attrs.intercept,'-3');assert.equal(sink.render({...paint,palette:{...paint.palette,mode:'nodes'}}),true);assert.equal(host.style['--document-palette-gradient'],undefined);sink.dispose();assert.equal(body.children.length,0);
 }finally{globalThis.document=old;}
});
