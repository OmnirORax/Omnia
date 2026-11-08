import test from 'node:test';import assert from 'node:assert/strict';
import {PATTERN_FIELDS,PATTERN_FUNCTION,patternProperty,patternSettings,resolvePattern,patternTile,scenePalette} from '../src/paint/pattern.ts';
import {patternApplies,patternCSS} from '../src/paint/routing.ts';
import {emptyController,createTargetIndex} from '../src/appearance/model.ts';

test('one pattern owns scene colour inheritance while consumers keep references and manual fallback',()=>{
 const config=patternSettings(),original=JSON.stringify(config),first=resolvePattern(config,{source:'scene.image.palette',revision:'a',colors:['#00aa44','#ffdd00']}),second=resolvePattern(config,{source:'scene.image.palette',revision:'b',colors:['#8844ee','#cc1144']});
 assert.deepEqual(first.colors,['#00aa44','#ffdd00']);assert.deepEqual(second.colors,['#8844ee','#cc1144']);assert.equal(first.inherited,true);assert.notEqual(first.revision,second.revision);assert.equal(JSON.stringify(config),original);
 assert.deepEqual(resolvePattern(config,null).colors,[config.colorA,config.colorB]);assert.equal(resolvePattern({...config,source:'manual'}, {source:'scene.image.palette',revision:'c',colors:['#000000','#ffffff']}).inherited,false);
});
test('palette detection retains dominant and meaningful accent colours deterministically',()=>{
 const pixels=Uint8ClampedArray.from({length:400},(_,i)=>{const n=Math.floor(i/4),color=n<80?[0,180,60,255]:[240,210,0,255];return color[i%4];}),before=pixels.slice();
 assert.deepEqual(scenePalette(pixels),['#00b43c','#f0d200']);assert.deepEqual(scenePalette(pixels),scenePalette(pixels));assert.deepEqual(pixels,before);
 const mono=scenePalette(new Uint8ClampedArray([0,180,60,255,0,180,60,255]));assert.notEqual(mono[0],mono[1]);assert.deepEqual(scenePalette(new Uint8ClampedArray([255,0,0,0])),['#32c890','#ffda55']);
});
test('shared presets produce safe bounded reusable tiles with both colours for every adapter',()=>{
 for(const preset of ['rings','dots','checker','stripes']){
  const paint=resolvePattern({...patternSettings(),source:'manual',preset},null),tile=patternTile(paint),svg=decodeURIComponent(tile.url.slice('url("data:image/svg+xml,'.length,-2));
  assert.ok(svg.includes(paint.colors[0]));assert.ok(svg.includes(paint.colors[1]));assert.ok(!svg.includes('<script'));assert.ok(!svg.includes('<foreignObject'));assert.equal(patternTile(paint),tile);assert.equal(tile.size,paint.settings.cell*2);
  assert.match(patternCSS('text',tile,.35,'#ffffff'),/background-clip:text/);assert.match(patternCSS('background',tile,.35,'#ffffff'),/omnium-pattern-surface/);assert.match(patternCSS('contour',tile,.35,'#ffffff'),/border-image-source/);
 }
 const p=patternSettings({[patternProperty('cell')]:999,[patternProperty('colorA')]:'url(javascript:x)',[patternProperty('global')]:false});assert.equal(p.cell,24);assert.equal(p.colorA,'#32c890');assert.equal(p.global,false);
});
test('global and selective application inherit existing hierarchy locks and bypass without changing values',()=>{
 const targets=[{id:'all'},{id:'ui',parent:'all'},{id:'frame',parent:'ui',properties:['color','patternUse']},{id:'text',parent:'frame',properties:['color','patternUse']},{id:'native',parent:'all',properties:['color']}],state=emptyController(),index=createTargetIndex(targets),text=targets[3];
 assert.equal(patternApplies(state,targets,text,false,index),false);assert.equal(patternApplies(state,targets,text,true,index),true);assert.equal(patternApplies(state,targets,targets[4],true,index),false);
 state.values.frame={patternUse:'on'};assert.equal(patternApplies(state,targets,text,false,index),true);state.values.text={patternUse:'off',color:'#112233'};assert.equal(patternApplies(state,targets,text,true,index),false);
 state.values.text.patternUse='inherit';assert.equal(patternApplies(state,targets,text,false,index),true);state.locks.ui={properties:['color']};assert.equal(patternApplies(state,targets,text,true,index),false);state.locks={};state.disconnected.frame={properties:['patternUse']};assert.equal(patternApplies(state,targets,text,true,index),false);
 assert.equal(state.values.text.color,'#112233');assert.deepEqual(index.path('text'),['all','ui','frame','text']);
});
test('pattern controls and per-socket references persist through existing settings/controller owners',async()=>{
 const {defaultSettings,normalizeSettings}=await import('../src/workspaceActions.ts');const {loadController,controllerTargets}=await import('../src/appearance/registry.ts');const fn=(await import('../src/paint/pattern.function.ts')).default;
 let settings=defaultSettings();for(const field of PATTERN_FIELDS){const id=patternProperty(field.key);settings=fn.inputs[id].write(settings,field.initial);}settings=fn.inputs[patternProperty('global')].write(settings,true);const restored=normalizeSettings(JSON.parse(JSON.stringify(settings)));assert.equal(patternSettings(restored.functionValues[PATTERN_FUNCTION]).global,true);
 const controller=loadController({...emptyController(),values:{'text.ui.buttons':{patternUse:'on',color:'#112233'},'ui.windows.background':{patternUse:'off'}}});assert.equal(controller.values['text.ui.buttons'].patternUse,'on');assert.equal(controller.values['text.ui.buttons'].color,'#112233');const targets=controllerTargets(controller);assert.ok(targets.find(t=>t.id==='text.ui.buttons').properties.includes('patternUse'));assert.ok(!targets.find(t=>t.id==='text.nodes').properties.includes('patternUse'));assert.ok(!targets.find(t=>t.id==='text.ui.placeholders').properties.includes('patternUse'));
});
