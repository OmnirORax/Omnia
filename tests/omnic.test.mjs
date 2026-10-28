import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipe, validateRecipeReferences, LIMITS } from '../src/omnic/model.ts';
import { GENERATORS, OPERATORS } from '../src/omnic/registry.ts';
import { createRecipe, PRESETS } from '../src/omnic/presets.ts';
import { evaluateRecipe } from '../src/omnic/evaluate.ts';
import { renderSVG, evaluationBounds } from '../src/omnic/svg.ts';
import { atoms, ungroupAtoms, rotateAtoms, atomnicSettings } from '../src/omnic/atomnic.ts';
import { snapTurn, turnDelta } from '../src/properties/halving.ts';
const op=(id,operator,targets=[],params={})=>({id,operator,targets,params,enabled:true});
const recipe=(components,operations=[],frames=[])=>({version:1,revision:0,components,operations,frames});
const dot=(id,x=0,y=0)=>({id,generator:'dot',params:{x,y,size:5}});
const almost=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('retained halving steps govern drag snapping in either direction, including zero',()=>{
  almost(snapTurn(.14,1,2),2/12);
  almost(snapTurn(-.14,1,2),-2/12);
  almost(snapTurn(.14,1,-2),2/12);
  assert.equal(snapTurn(.49,1,0),0);
  almost(snapTurn(.14,1),2/12);
  let total=0,previous=0;
  for(const next of [.25,.49,-.25,0,.25]){total+=turnDelta(previous,next);previous=next;}
  almost(total,1.25);
  total=0;previous=0;
  for(const next of [-.25,-.49,.25,0,-.25]){total+=turnDelta(previous,next);previous=next;}
  almost(total,-1.25);
});

test('ungroup preserves nested positions, atom identities, marks and frame scopes',()=>{
  const source=validateRecipe({...recipe([
    {id:'outer',generator:'group',params:{x:20,y:10},children:[
      {id:'inner',generator:'group',params:{x:-5,y:15},children:[dot('a',-10),dot('b',10)]},
      dot('c',30)]},dot('other',-70)
  ],[op('mark','highlight',['inner'],{which:'all',fraction:.5,color:'#ff0000'})],
  [{id:'scope',property:'example',state:'unspecified',scope:['inner','other:shape']}]),atomnic:{mode:'free'}});
  const before=atoms(source),rendered=evaluateRecipe(source).nodes.filter(n=>n.kind==='dot');
  const next=ungroupAtoms(source,new Set(['a']));
  assert.deepEqual(atoms(next).map(a=>[a.id,a.x,a.y]),before.map(a=>[a.id,a.x,a.y]));
  assert.equal(atoms(next).find(a=>a.id==='a').group,'outer');
  assert.equal(atoms(next).find(a=>a.id==='other').group,'@root');
  assert.deepEqual(next.operations[0].targets,['a','b']);
  assert.deepEqual(next.frames[0].scope,['a','b','other:shape']);
  const after=evaluateRecipe(next);
  assert.deepEqual(after.nodes.filter(n=>n.kind==='dot').map(({parent,...n})=>n),rendered.map(({parent,...n})=>n));
  assert.equal(after.diagnostics.length,0);
  assert.deepEqual(source.operations[0].targets,['inner'],'input is unchanged');
  assert.equal(ungroupAtoms(source,new Set(['other'])),source,'ungroup at root is a no-op');
});

test('ungroup dissolves multiple nearest levels only when selected and retains legal rotation',()=>{
  const source=validateRecipe({...recipe([{id:'outer',generator:'group',params:{},children:[
    {id:'inner',generator:'group',params:{},children:[dot('a',0,-20)]},dot('b',0,20)
  ]}],[op('mark','highlight',['outer'],{which:'all',fraction:.5})]),atomnic:{...atomnicSettings(recipe([])),mode:'constrained',size:5}});
  const next=ungroupAtoms(source,new Set(['a','b']));
  assert.deepEqual(next.components.map(c=>c.id),['a','b']);
  assert.deepEqual(next.operations[0].targets,['a','b']);
  const rotated=rotateAtoms(next,new Set(['a','b']),{x:0,y:0},1/6);
  almost(atoms(rotated)[0].x,20*Math.sqrt(3)/2);
  assert.equal(rotated.operations[0].params.start,60);
});

test('all starter generators and presets reconstruct deterministically without drawing or renderer objects',()=>{
  assert.deepEqual(GENERATORS.map(g=>g.id),['dot','ring','line','chain','radial','group','reference']);
  for(const preset of PRESETS){
    const source=createRecipe(preset.id), before=JSON.stringify(source), a=evaluateRecipe(source),b=evaluateRecipe(validateRecipe(JSON.parse(before)));
    assert.deepEqual(a,b);assert.equal(JSON.stringify(source),before);assert.equal(renderSVG(a),renderSVG(b));
  }
  assert.equal(evaluateRecipe(createRecipe()).properties.count,6);
  assert.ok(OPERATORS.some(o=>o.id==='inspect'));
});

test('generated slots keep stable identities as count changes and missing roles do not redirect',()=>{
  const source=createRecipe();source.components[0].params.count=8;
  source.operations=[op('pick','select',['radial:unit:7']),op('reduce','count',['radial'],{count:3}),op('fill','fill',[],{fill:false,color:'#ff0000',opacity:1})];
  const result=evaluateRecipe(source);
  assert.equal(result.properties.count,3);assert.deepEqual(result.selection,['radial:unit:7']);
  assert.ok(result.diagnostics.some(d=>d.code==='unresolved-target'&&d.target==='radial:unit:7'));
  assert.ok(result.nodes.filter(n=>n.kind==='dot').every(n=>n.fill===true),'lost selection never broadens to the whole structure');
  assert.deepEqual(result.nodes.filter(n=>n.kind==='dot').map(n=>n.id),['radial:unit:0','radial:unit:1','radial:unit:2']);
});

test('operation order and scoped selection affect resulting structure',()=>{
  const components=[dot('left',-20),dot('right',20)];
  const select=op('select','select',['left']),rotate=op('turn','rotate',[],{angle:90,pivotX:0,pivotY:0});
  const scoped=evaluateRecipe(recipe(components,[select,rotate])),all=evaluateRecipe(recipe(components,[rotate,select]));
  almost(scoped.nodes.find(n=>n.id==='right:shape').x,20);
  almost(all.nodes.find(n=>n.id==='right:shape').x,0);almost(all.nodes.find(n=>n.id==='right:shape').y,20);
  assert.notDeepEqual(scoped.nodes,all.nodes);
  const copy=structuredClone(rotate);copy.enabled=false;
  almost(evaluateRecipe(recipe(components,[copy])).nodes.find(n=>n.id==='left:shape').x,-20);
});

test('nested groups and shared current references expand without duplicating canonical identity',()=>{
  const shared=recipe([{id:'units',generator:'chain',params:{count:3,size:2,spacing:10}}]);
  const source=recipe([{id:'container',generator:'group',params:{x:20},children:[{id:'use-a',generator:'reference',reference:'shared-object',params:{}},{id:'use-b',generator:'reference',reference:'shared-object',params:{y:30}}]}]);
  const map=new Map([['root',source],['shared-object',shared]]);validateRecipeReferences(map);
  const result=evaluateRecipe(source,id=>map.get(id));assert.equal(result.properties.count,6);
  assert.equal(new Set(result.nodes.map(n=>n.id)).size,result.nodes.length);
  assert.ok(result.nodes.some(n=>n.id==='use-a:ref:shared-object/units:unit:2'));
  shared.components[0].params.count=4;
  assert.equal(evaluateRecipe(source,id=>map.get(id)).properties.count,8,'editing shared definition changes both uses');
  assert.equal(source.components[0].children[0].reference,'shared-object');
});

test('canonical dependency cycles, missing objects and recursive budget violations are explicit',()=>{
  const a=recipe([{id:'a',generator:'reference',reference:'b',params:{}}]),b=recipe([{id:'b',generator:'reference',reference:'a',params:{}}]);
  assert.throws(()=>validateRecipeReferences(new Map([['a',a],['b',b]])),/Circular/);
  assert.throws(()=>evaluateRecipe(a,id=>id==='a'?a:b),/Circular/);
  assert.throws(()=>validateRecipeReferences(new Map([['a',a]])),/Missing/);
  assert.equal(evaluateRecipe(a).diagnostics[0].code,'unresolved-object');
  const many=recipe(Array.from({length:20},(_,i)=>({id:`array-${i}`,generator:'radial',params:{count:64}})));
  assert.throws(()=>evaluateRecipe(many),/output exceeds/);
  const tooMany=recipe(Array.from({length:LIMITS.components+1},(_,i)=>dot(`d${i}`)));
  assert.throws(()=>validateRecipe(tooMany),/budget/);
});

test('schema rejects unsupported ranges, duplicate identities and executable payload values',()=>{
  const source=createRecipe();source.components[0].params.count=2.5;assert.throws(()=>validateRecipe(source),/range/);
  source.components[0].params.count=65;assert.throws(()=>validateRecipe(source),/range/);
  source.components[0].params.count=6;source.components.push(dot('radial'));assert.throws(()=>validateRecipe(source),/duplicate/);
  assert.throws(()=>validateRecipe(recipe([{id:'bad',generator:'dot',params:{color:'red" onload="alert(1)'}}])),/RGB/);
  assert.throws(()=>validateRecipe(recipe([{id:'bad',generator:'dot',params:{size:Infinity}}])),/range/);
  assert.throws(()=>validateRecipe(recipe([{id:'bad',generator:'arbitraryScript',params:{}}])),/Unknown/);
});

test('frames preserve inactive, active-unspecified and specified scopes without inferred semantics',()=>{
  const states=[{id:'direction',property:'direction',state:'inactive',scope:[]},{id:'count',property:'count',state:'unspecified',scope:['disk']},{id:'negation',property:'negation',state:'specified',value:false,scope:['disk:shape']}];
  const result=evaluateRecipe(recipe([dot('disk')],[],states));assert.deepEqual(result.frames,states);
  assert.equal(result.properties.count,1);assert.equal(result.nodes.find(n=>n.kind==='dot').fill,true,'negation frame is not silently converted into absence');
  assert.throws(()=>validateRecipe(recipe([dot('disk')],[],[{...states[0],value:true}])),/must not/);
  assert.throws(()=>validateRecipe(recipe([dot('disk')],[],[{...states[2],value:undefined}])),/requires/);
});

test('count extraction is nonvisual and internal connections do not increase unit count',()=>{
  const source=createRecipe('chain');source.operations=[op('inspect','inspect',['chain']),op('connect','connect',['chain'],{color:'#abcdef',thickness:2})];
  const result=evaluateRecipe(source);assert.equal(result.properties.count,5);
  assert.equal(result.nodes.filter(n=>n.kind==='line').length,4);
  assert.equal(result.properties.componentCount,1);
  assert.equal(source.components.length,1,'evaluation never writes canonical object/relationship lists');
});

test('semantic oscillation is deterministic at explicit time and paused at time zero',()=>{
  const source=createRecipe('oscillation'),zero=evaluateRecipe(source),quarter=evaluateRecipe(source,undefined,.25),again=evaluateRecipe(source,undefined,.25);
  assert.equal(zero.motion,true);almost(zero.nodes.find(n=>n.kind==='dot').y,0);almost(quarter.nodes.find(n=>n.kind==='dot').y,15);
  assert.deepEqual(quarter,again);assert.throws(()=>evaluateRecipe(source,undefined,Infinity),/time/);
});

test('SVG adapter is self-contained, deterministic, bounded and exposes stable role addresses',()=>{
  const result=evaluateRecipe(createRecipe('boundary')),svg=renderSVG(result),bounds=evaluationBounds(result);
  assert.ok(svg.startsWith('<svg xmlns='));assert.match(svg,/data-omnic-role="radial:unit:0"/);assert.match(svg,/data-omnic-component="radial"/);
  assert.ok(!/<script|href=|foreignObject|filter=/.test(svg));assert.ok(bounds.width>120&&bounds.height>120);
  assert.equal(svg,renderSVG(result));
});

test('registry additions provide executable behavior and ordered nonvisual results without evaluator changes',async()=>{
  const {registerOperator}=await import('../src/omnic/registry.ts');
  const dispose=registerOperator({id:'half-turn',label:'Half turn',parameters:[],input:['structure'],output:'structure',apply:ctx=>ctx.transform('rotate',{angle:180,pivotX:0,pivotY:0})});
  try{
    const source=recipe([dot('disk',20)],[op('before','inspect'),op('half-turn','half-turn'),op('select','select',['disk:shape']),op('after','inspect')]);
    const result=evaluateRecipe(source);almost(result.nodes.find(n=>n.kind==='dot').x,-20);
    assert.deepEqual(result.results.map(r=>[r.operation,r.kind,r.value]),[['before','count',1],['after','count',1]]);
    assert.equal(result.results[1].scope[0],'disk:shape');
  }finally{dispose();}
  assert.throws(()=>validateRecipe(recipe([dot('disk')],[op('gone','half-turn')])),/Unknown/);
  const array=createRecipe();array.operations=[op('before','inspect'),op('change','count',['radial'],{count:3}),op('after','inspect')];
  assert.deepEqual(evaluateRecipe(array).results.map(r=>r.value),[6,3]);
});

test('combined group and reference nesting respects one global hierarchy budget',()=>{
  const nested=()=>{let component=dot('leaf');for(let i=0;i<8;i++)component={id:`group-${i}`,generator:'group',params:{},children:[component]};return recipe([component]);};
  const outer=recipe([{id:'ref',generator:'reference',reference:'nested',params:{}}]);
  const deep=nested();let component={id:'deep-reference',generator:'reference',reference:'outer',params:{}};for(let i=0;i<5;i++)component={id:`outer-group-${i}`,generator:'group',params:{},children:[component]};
  const root=recipe([component]);
  assert.throws(()=>evaluateRecipe(root,id=>id==='outer'?outer:deep),/depth exceeded/);
});


test('compounded geometry stays finite and within the aggregate extent budget without silent clamps',()=>{
  const source=recipe([dot('disk',20)],Array.from({length:12},(_,i)=>op(`scale-${i}`,'size',['disk'],{factor:4})));
  assert.throws(()=>evaluateRecipe(source),/geometric extent exceeded/);
  // Later contraction cannot legitimize an earlier unsupported intermediate state.
  source.operations.push(...Array.from({length:20},(_,i)=>op(`contract-${i}`,'size',['disk'],{factor:.1})));
  assert.throws(()=>evaluateRecipe(source),/geometric extent exceeded/);
  const allowed=evaluateRecipe(recipe([dot('disk',20)],[op('scale','size',['disk'],{factor:4})]));
  assert.equal(allowed.nodes.find(n=>n.kind==='dot').x,80);
  assert.equal(LIMITS.extent,1_000_000);
});

test('derived SVG images use capped intrinsic dimensions with an independent aspect-correct viewBox',()=>{
  const output=renderSVG(evaluateRecipe(createRecipe('chain')));
  assert.match(output, /width="256" height="256" preserveAspectRatio="xMidYMid meet"/);
  assert.match(output, /viewBox="[-\d.]+ [-\d.]+ [\d.]+ [\d.]+"/);
});

test('existing Unicode canonical identities remain referenceable and generated scopes retain their exact addresses',()=>{
  const canonical='意味 / object',child=createRecipe(),parent=recipe([{id:'reuse',generator:'reference',reference:canonical,params:{}}]);
  validateRecipeReferences(new Map([[canonical,child],['parent',parent]]));
  const initial=evaluateRecipe(parent,id=>id===canonical?child:undefined),target=initial.nodes.find(n=>n.kind==='dot').id;
  parent.operations=[op('pick','select',[target])];
  const selected=evaluateRecipe(validateRecipe(parent),id=>id===canonical?child:undefined);
  assert.deepEqual(selected.selection,[target]);assert.match(renderSVG(selected),/data-omnic-role=/);
});

test('Member and Part highlighting is authored geometry with unchanged unit identity/count',()=>{
  const member=evaluateRecipe(createRecipe('member'));
  assert.equal(member.properties.count,2);
  assert.deepEqual(member.nodes.filter(n=>n.highlight).map(n=>n.id),['units:unit:0']);
  const part=evaluateRecipe(createRecipe('part'));
  assert.equal(part.properties.count,1);
  assert.equal(part.nodes.find(n=>n.highlight).highlight.fraction,.5);
  const svg=renderSVG(part);
  assert.match(svg,/data-omnic-fraction="0.5"/);assert.match(svg,/<path /);
  const source=createRecipe('member');source.operations[0].params.index=3;
  const unavailable=evaluateRecipe(source);
  assert.equal(unavailable.nodes.filter(n=>n.highlight).length,0);
  assert.ok(unavailable.diagnostics.some(d=>d.message.includes('outside this scope')));
});
test('region, per-unit and group rotations have distinct pivots and saved snapping',()=>{
  const source=createRecipe('part');source.components[0].params.x=25;
  source.operations.push(op('turn','rotate',[],{angle:50,snap:30,scope:'region',pivot:'center'}));
  const region=evaluateRecipe(source).nodes.find(n=>n.highlight);
  almost(region.x,25);almost(region.highlight.start,60);
  const pair=createRecipe('member');pair.operations.push(op('turn','rotate',[],{angle:90,scope:'each',pivot:'center'}));
  const each=evaluateRecipe(pair).nodes.filter(n=>n.kind==='dot');
  almost(each[0].x,-14);almost(each[0].y,0);almost(each[0].highlight.start,90);
  pair.operations.at(-1).params.scope='group';
  const group=evaluateRecipe(pair).nodes.filter(n=>n.kind==='dot');
  almost(group[0].x,0);almost(group[0].y,-14);almost(group[1].y,14);
  const restored=evaluateRecipe(validateRecipe(JSON.parse(JSON.stringify(pair))));
  assert.deepEqual(restored,evaluateRecipe(pair));
});
test('angle grids and explicit angle choices reject invalid constraints and avoid stepping drift',async()=>{
  const {snappedAngle,rotationStops}=await import('../src/omnic/rotation.ts');
  assert.equal(snappedAngle(50,30),60);assert.equal(snappedAngle(50,30,5),65);
  assert.equal(snappedAngle(50,30,0,'0,45,180'),45);
  let angle=0;for(let i=0;i<100;i++)angle=snappedAngle(angle+.1,.1);
  almost(angle,10);
  assert.throws(()=>rotationStops('0,,90'));assert.throws(()=>rotationStops('Infinity'));
  assert.throws(()=>validateRecipe(recipe([dot('a')],[op('bad','rotate',[],{stops:'bad'})])));
});
test('operation tools stamp explicit copies into new scopes without modifying shared definitions',async()=>{
  const {operationTool,applyOperationTool,isOperationTool}=await import('../src/omnic/tools.ts');
  const tool=operationTool(createRecipe('part').operations[0]);assert.ok(isOperationTool(tool));
  const before=JSON.stringify(tool);
  const target=createRecipe('chain');let count=0;
  const stamped=applyOperationTool(target,tool,['chain'],()=>`copy-${++count}`);
  assert.equal(stamped.operations.length,1);
  assert.equal(evaluateRecipe(stamped).nodes.filter(n=>n.highlight).length,5);
  assert.equal(JSON.stringify(tool),before);assert.equal(target.operations.length,0);
  assert.throws(()=>applyOperationTool(target,createRecipe('part'),[],()=>`copy-${++count}`));
});
test('parameter applicability follows registered scope rules without discarding saved values',async()=>{
  const {definition,applicableParameters}=await import('../src/omnic/registry.ts');
  const rotate=definition('rotate');
  const region=applicableParameters(rotate,{scope:'region',pivot:'custom',pivotX:20,snap:0});
  assert.ok(!region.some(p=>p.key==='pivotX'||p.key==='pivot'||p.key==='snapOrigin'));
  const group=applicableParameters(rotate,{scope:'group',pivot:'custom',snap:30});
  assert.ok(group.some(p=>p.key==='pivotX'));assert.ok(group.some(p=>p.key==='snapOrigin'));
  assert.ok(!applicableParameters(definition('highlight'),{which:'all',fraction:1}).some(p=>p.key==='index'||p.key==='start'));
});
