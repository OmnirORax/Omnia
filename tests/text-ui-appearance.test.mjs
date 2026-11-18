import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addStructure,validateWorld} from '../src/core/model.ts';
import {readPaint,writePaint,paintPreview} from '../src/core/appearance.ts';
import {textStyle,textBorderStyle,updateUIAppearance} from '../src/ui/appearance.ts';
import {visualProperties} from '../src/properties/visual.ts';
import {TARGETS,sharedUIDecoration} from '../src/composer/runtime/appearance/registry.ts';

test('old text channels and background glow retire on import without changing node body or fill settings',()=>{
 const world=emptyWorld(),node=addStructure(world,[0,0,0],1);node.opacity=.4;node.brightness=2;
 world.appearance.text={color:'#204060',glow:2,brightness:0,brightnessEnabled:true,opacity:0,translucency:1};
 node.textAppearance={color:'#102030',brightness:3,opacity:0,translucency:1};
 world.appearance.background={color:'#112233',translucency:.6,glow:1,glowColor:'#abcdef'};
 validateWorld(world);
 for(const paint of [world.appearance.text,node.textAppearance])for(const key of ['brightness','brightnessEnabled','opacity','translucency'])assert.equal(paint[key],undefined);
 assert.deepEqual(world.appearance.background,{color:'#112233',translucency:.6});assert.equal(node.opacity,.4);assert.equal(node.brightness,2);
 assert.equal(readPaint(world,'nodeText',node.origin).color,'#102030');
 validateWorld(JSON.parse(JSON.stringify(world)));
 for(const patch of [{brightness:.5},{brightnessEnabled:true},{opacity:1},{translucency:0}])assert.throws(()=>writePaint(world,'text',[],patch),/Invalid/);
});
test('text controls own UI decoration capabilities while fills and body channels remain independent',()=>{
 assert.ok(!visualProperties(true).some(p=>['brightness','brightnessEnabled','opacity','translucency'].includes(p.key)));
 assert.ok(!visualProperties(false).some(p=>['glow','glowColor'].includes(p.key)));
 for(const target of TARGETS){
  if(target.binding?.text)assert.ok(!target.properties.some(key=>['brightness','brightnessEnabled','opacity','translucency'].includes(key)),target.id);
  if(sharedUIDecoration(target.binding))assert.ok(!target.properties.some(key=>['glow','glowColor'].includes(key)),target.id);
 }
 const world=emptyWorld(),node=addStructure(world,[0,0,0],1),before=JSON.stringify(world);
 const preview=paintPreview(world,'text',[],{color:'#204060',glowColor:'#00aaff',glow:2,glowSpread:10});
 assert.equal(textBorderStyle(preview.appearance.text).borderColor,'#204060');assert.ok(textBorderStyle(preview.appearance.text).boxShadow.includes('#00aaff'));
 assert.equal(JSON.stringify(world),before);assert.equal(node.color,world.nodes[0].color);
});
test('text and UI decoration switch together even when a legacy background has a different glow',()=>{
 const properties=new Map(),rules=[],attributes=new Map();
 globalThis.document={createElement:()=>({dataset:{},textContent:''}),head:{append:element=>rules.push(element)},documentElement:{style:{setProperty:(key,value)=>properties.set(key,value)},toggleAttribute:(key,value)=>attributes.set(key,value)}};
 const background={color:'#112233',translucency:.5,glow:2,glowColor:'#ff0000'};
 updateUIAppearance({text:{color:'#00aaff',glow:0},background});
 assert.equal(properties.get('--visual-text-border-shadow'),'var(--omnium-custom-shadow,0 0 0 transparent)');
 assert.equal(properties.get('--visual-text-textShadow'),'none');assert.equal(properties.get('--visual-background'),'#11223380');
 updateUIAppearance({text:{color:'#204060',glowColor:'#00aaff',glow:2,glowSpread:10},background});
 assert.ok(properties.get('--visual-text-border-shadow').includes('#00aaff'));assert.equal(properties.get('--visual-text-border-color'),'#204060');
 assert.equal(rules.length,1);assert.ok(rules[0].textContent.includes('!important'));assert.ok(rules[0].textContent.includes('.panel'));assert.ok(rules[0].textContent.includes('input'));
 assert.equal(properties.has('--visual-background-glow'),false);
 assert.equal(textStyle({color:'#204060',brightness:0,opacity:0,translucency:1}).color,'#204060ff');
});
