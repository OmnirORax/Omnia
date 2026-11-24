import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {minimumRatio,imageRatio,focusRatio,focusPattern,focusPeriod} from '../src/properties/focusPalette.ts';
import {imageColorCombo,matchedImageColors} from '../src/scene/colorCombo.ts';
import {packedTextureGlow,updateTextureTextPalette,textPixelRatio} from '../src/textureGlow.ts';
import {validTextPalette} from '../src/properties/textPalette.ts';
const palette={mode:'text',colors:['#ff0000','#0000ff'],distribution:'balanced',ink:'color'};
const sample=(parts)=>new Uint8ClampedArray(parts.flatMap(([count,rgb])=>Array.from({length:count},()=>[...rgb,255]).flat()));
test('ratios reduce to minimum integer pixels without imposing a 20px floor',()=>{
 assert.deepEqual(minimumRatio([6,2]),[3,1]);assert.deepEqual(minimumRatio([7,3]),[7,3]);assert.deepEqual(imageRatio([.75,.25]),[3,1]);assert.deepEqual(imageRatio([.7,.3]),[7,3]);assert.deepEqual(focusRatio({...palette,imageRatio:[6,2]}),[3,1]);assert.equal(focusPeriod({...palette,imageRatio:[6,2]}),4);
});
test('image coverage supplies ratios, independent of motif prominence or saturation',()=>{
 const source=imageColorCombo(sample([[60,[255,0,0]],[20,[0,0,255]]]));
 for(const saturation of [.4,.7,1]){const combo=matchedImageColors(source,{distribution:'balanced',ink:'color',saturation,selection:'top',top:2});assert.deepEqual(combo.textRatio,[3,1]);assert.deepEqual(combo.textWeights,[.75,.25]);}
});
test('top color ranking changes with selected coverage or motif focus and reports its actual max',()=>{
 const source={...imageColorCombo(sample([[1,[255,0,0]]])),source:{tones:{background:0,low:0,high:1,darkSupport:false},neutrals:[],accents:[{color:'#aaaaee',weight:.8,salience:.001},{color:'#ff6600',weight:.15,salience:.3},{color:'#00ff00',weight:.05,salience:.2}]}};
 const dominant=matchedImageColors(source,{distribution:'balanced',selection:'top',top:1}),motif=matchedImageColors(source,{distribution:'balanced',selection:'top-motif',top:1});assert.equal(dominant.textPalette.length,1);assert.equal(motif.textPalette.length,1);assert.notEqual(dominant.textGlow,motif.textGlow);assert.equal(dominant.textAvailable,3);assert.equal(motif.textAvailable,2);
});
test('balanced spacing is stable; distribution and scale preserve measured counts',()=>{
 assert.deepEqual(focusPattern({...palette,imageRatio:[1,2]}).indices,[1,0,1]);
 for(const distribution of ['balanced','grouped','centered','mirrored']){const p={...palette,imageRatio:[7,3],distribution},pattern=focusPattern(p),red=pattern.indices.filter(i=>i===0).length,blue=pattern.indices.filter(i=>i===1).length;assert.equal(red/blue,7/3);assert.equal(focusPattern({...p,scale:2}),pattern);assert.equal(focusPeriod({...p,scale:2}),pattern.indices.length*2);}
 const p={...palette,imageRatio:[4095,1]};assert.equal(focusPattern(p).indices.length,4096);
});
test('saved ratios, counts and scale reject unbounded or invalid pixel allocations',()=>{
 for(const extra of [{imageRatio:[0,1]},{imageRatio:[1.2,2]},{imageRatio:[4096,1]},{imageRatio:[1]},{available:9},{scale:0},{top:9},{distribution:'junk'}])assert.equal(validTextPalette({...palette,...extra}),false);
 assert.equal(validTextPalette({...palette,imageRatio:[7,3],available:2,scale:1,top:2}),true);
});
test('world labels consume the canonical pixel cycle and separate screen pixels from DPI',()=>{
 const p={...palette,imageRatio:[1,2],scale:2},material=new T.MeshBasicMaterial();packedTextureGlow(material);updateTextureTextPalette(material,p);const shader={uniforms:{},fragmentShader:T.ShaderLib.basic.fragmentShader};material.onBeforeCompile(shader,{});
 assert.equal(shader.uniforms.textPaletteFocus.value,1);assert.equal(shader.uniforms.textPalettePeriod.value,6);assert.equal(shader.uniforms.textPixelRatio,textPixelRatio);assert.deepEqual(shader.uniforms.textPalettePattern.value.image.data,focusPattern(p).glow);assert.equal(shader.uniforms.textPalettePattern.value.magFilter,T.LinearFilter);material.dispose();
});
test('focus previews and commits inherit inclusions while retiring old layout deltas',async()=>{
 const {createAutoColors,configureAutoColors}=await import('../src/scene/autoColors.ts'),{focusTheme,setThemeFocus}=await import('../src/scene/themeControls.ts'),{createStore}=await import('../src/core/store.ts'),{readPaint}=await import('../src/core/appearance.ts');
 const store=createStore({getItem:()=>null,setItem(){}}),errors=[];let samples=0;const controller=createAutoColors({read:()=>store.world,change:edit=>store.change(edit),sample:async()=>{samples++;return sample([[60,[255,0,0]],[20,[0,0,255]]]);},error:e=>errors.push(e)});store.subscribe(controller.update);store.change(w=>configureAutoColors(w,undefined,true));await controller.settle();const original=JSON.stringify(store.world),settings=focusTheme(store.world.appearance.imageColors.default.palette,{scale:3});const preview=controller.preview(store.world,undefined,settings);assert.equal(JSON.stringify(store.world),original);assert.equal(preview.palette.scale,3);assert.deepEqual(focusRatio(preview.palette),[3,1]);store.change(w=>setThemeFocus(w,undefined,{scale:3}));await controller.settle();assert.deepEqual(readPaint(store.world,'text').palette,preview.palette);assert.equal(samples,1);assert.deepEqual(errors,[]);controller.dispose();
 for(const ink of ['pale','color']){const selected=focusTheme({}, {ink});assert.equal(focusTheme(selected,{scale:2}).ink,ink);assert.equal(focusTheme(selected,{saturation:.5}).ink,ink);assert.equal(focusTheme(selected,{selection:'top',top:1}).ink,ink);}
 const edited=focusTheme({included:['#ff0000'],selection:'pair',match:'dark',layout:'radial',pattern:'generated',spread:'dense'},{scale:2});assert.deepEqual(edited.included,['#ff0000']);assert.equal(edited.selection,'top-motif');assert.equal(edited.top,2);for(const key of ['layout','pattern','spread','match'])assert.equal(edited[key],undefined);
});
test('hue inclusions inherit image coverage rather than equal swatch weights',()=>{
 const source=imageColorCombo(sample([[60,[255,0,0]],[20,[0,0,255]]]));const combo=matchedImageColors(source,{distribution:'balanced',included:['#ff0000','#0000ff'],selection:'top',top:2});assert.deepEqual(combo.textRatio,[3,1]);assert.deepEqual(combo.textWeights,[.75,.25]);
});
test('document and window paint reuse one pixel tile and scale it without regenerating colors',async()=>{
 const {createPalettePaint}=await import('../src/ui/palettePaint.ts');const previous=globalThis.document;let rasterizations=0;const pixels=[];
 globalThis.document={createElement:()=>({getContext:()=>({createImageData:w=>({data:new Uint8ClampedArray(w*4)}),putImageData:image=>pixels.push(image.data)}),toDataURL:()=>{rasterizations++;return 'data:image/png;base64,test';}})};
 const host={attrs:new Set(),setAttribute(k){this.attrs.add(k);},toggleAttribute(k,v){if(v)this.attrs.add(k);else this.attrs.delete(k);},style:{setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];}}};
 try{const sink=createPalettePaint(host),paint={palette:{...palette,imageRatio:[1,2]},glow:0};sink.render(paint);assert.equal(host.style['--document-palette-size'],'3px 100%');assert.equal(host.style['--document-palette-repeat'],'repeat-x');assert.ok(host.attrs.has('data-focus-theme'));assert.deepEqual([...pixels[0]], [...focusPattern(paint.palette).ink]);sink.render({...paint,palette:{...paint.palette,scale:2}});assert.equal(host.style['--document-palette-size'],'6px 100%');assert.equal(rasterizations,1);sink.render({});assert.equal(host.attrs.has('data-focus-theme'),false);sink.dispose();}finally{globalThis.document=previous;}
});
test('retired manual ratios cannot override image-derived proportions, including saved themes',async()=>{
 const {emptyWorld,addStructure,validateWorld}=await import('../src/core/model.ts'),{configureAutoColors}=await import('../src/scene/autoColors.ts');
 const automatic={...palette,imageRatio:[3,1]},stale={...automatic,ratio:[1,7]};assert.deepEqual(focusRatio(stale),[3,1]);assert.equal(focusPattern(stale),focusPattern(automatic));
 const world=emptyWorld(),node=addStructure(world,[0,0,0],1);configureAutoColors(world,undefined,true,false,{ratio:[1,7]});assert.equal(world.appearance.imageColors.default.palette.ratio,undefined);
 world.appearance.text.palette={...stale};node.textAppearance={palette:{...stale}};world.appearance.imageColors.default.palette.ratio=[1,7];validateWorld(world);assert.equal(world.appearance.text.palette.ratio,undefined);assert.equal(node.textAppearance.palette.ratio,undefined);assert.equal(world.appearance.imageColors.default.palette.ratio,undefined);
 const source=imageColorCombo(sample([[60,[255,0,0]],[20,[0,0,255]]]));for(const selection of ['top','top-motif']){const all=matchedImageColors(source,{distribution:'balanced',selection,top:2}),one=matchedImageColors(source,{distribution:'balanced',selection,top:1});assert.deepEqual(all.textRatio,[3,1]);assert.deepEqual(one.textRatio,[1]);}
});
test('distribution modes rearrange the same 3:7 counts into distinct pixel sequences',()=>{
 const expected={grouped:'0001111111',centered:'1110001111',balanced:'1011011101',alternating:'0101011111','alternating-end':'1111010101',paired:'0011011111',growing:'0100111111'};
 for(const [distribution,sequence]of Object.entries(expected)){const p={...palette,imageRatio:[3,7],distribution},pattern=focusPattern(p);assert.equal(pattern.indices.join(''),sequence,distribution);assert.equal(pattern.indices.filter(i=>i===0).length,3);assert.equal(pattern.indices.filter(i=>i===1).length,7);assert.equal(focusPattern({...p,scale:5}),pattern);assert.equal(focusPeriod({...p,scale:5}),50);}
});
test('Macro and restored legacy rules cannot fall back to the old stretched gradient',async()=>{
 const {createAutoColors,configureAutoColors}=await import('../src/scene/autoColors.ts'),{setThemeFocus,varyTheme}=await import('../src/scene/themeControls.ts'),{createStore}=await import('../src/core/store.ts'),{readPaint}=await import('../src/core/appearance.ts');
 const store=createStore({getItem:()=>null,setItem(){}}),errors=[];let samples=0;const controller=createAutoColors({read:()=>store.world,change:edit=>store.change(edit),sample:async()=>{samples++;return sample([[30,[255,0,0]],[70,[0,0,255]]]);},error:e=>errors.push(e)});store.subscribe(controller.update);
 store.change(w=>configureAutoColors(w,undefined,true));await controller.settle();store.change(w=>setThemeFocus(w,undefined,{distribution:'grouped',scale:5}));await controller.settle();store.change(w=>varyTheme(w,undefined,'macro'));await controller.settle();assert.equal(readPaint(store.world,'text').palette.distribution,'grouped');assert.equal(readPaint(store.world,'text').palette.scale,5);
 store.change(w=>{w.appearance.imageColors.default={enabled:true,manual:[],palette:{ink:'pale',selection:'motif',pattern:'smooth',layout:'horizontal'}};});await controller.settle();assert.equal(readPaint(store.world,'text').palette.distribution,'balanced');assert.equal(samples,1);assert.deepEqual(errors,[]);controller.dispose();
});
