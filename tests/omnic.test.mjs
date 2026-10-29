import { insertConstruction } from '../src/omnic/tools.ts';
import { deleteComponents, memberTargets, rootTargets } from '../src/omnic/componentTargets.ts';
import { compactGeometry, targetBounds, targetLevels, fitDegreeValue } from '../src/omnic/contextGeometry.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipe, validateRecipeReferences, LIMITS } from '../src/omnic/model.ts';
import { GENERATORS, OPERATORS } from '../src/omnic/registry.ts';
import { createRecipe, PRESETS } from '../src/omnic/presets.ts';
import { evaluateRecipe } from '../src/omnic/evaluate.ts';
import { renderSVG, evaluationBounds, pickStructuralNode } from '../src/omnic/svg.ts';
import { atoms, ungroupAtoms, rotateAtoms, atomnicSettings, atomnicEditable, addAtom, legalAtoms } from '../src/omnic/atomnic.ts';
import { snapTurn, turnDelta } from '../src/properties/halving.ts';
import { targetDegrees, targetDegreeValue, writeTargetDegree, translateTargets, targetParameter } from '../src/omnic/targetDegrees.ts';
const op=(id,operator,targets=[],params={})=>({id,operator,targets,params,enabled:true});
const recipe=(components,operations=[],frames=[])=>({version:1,revision:0,components,operations,frames});
const dot=(id,x=0,y=0)=>({id,generator:'dot',params:{x,y,size:5}});
const memberFixture=()=>recipe([{id:"units",generator:"chain",params:{count:2,size:10,spacing:28}}],[op("mark","highlight",["units"],{which:"index",index:1,fraction:1,color:"#ffffff"})]);
const partFixture=()=>recipe([{id:"unit",generator:"dot",params:{size:18}}],[op("mark","highlight",["unit"],{which:"all",fraction:.5,start:0,color:"#ffffff"})]);
const almost=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('target freedoms derive from writable generator parameters and applicable operation adapters',()=>{
  const source=validateRecipe({...recipe([dot('a'),dot('b',20),{id:'rim',generator:'ring',params:{radius:30}}]),atomnic:{mode:'free'}});
  const adapters=[{id:'move',label:'Move',adjusts:['omnic.coordinate.x','omnic.coordinate.y']},{id:'rotate',label:'Rotate',adjusts:['omnic.angle']}];
  const dots=targetDegrees(source,['a','b'],adapters);
  assert.ok(dots.some(d=>d.action==='rotate'));assert.ok(dots.some(d=>d.action==='move'),'shared position adapter remains available alongside dragging');
  assert.equal(dots.filter(d=>d.properties.includes('omnic.coordinate.x')||d.properties.includes('omnic.coordinate.y')).length,1,'one shared Move adapter owns both coordinates');
  assert.ok(!targetDegrees(source,['rim'],adapters).some(d=>d.action==='rotate'),'no invented rotation when its writable direction is absent');
  assert.ok(!targetDegrees(source,['a','rim'],adapters).some(d=>d.properties.includes('omnic.angle')),'mixed selection exposes only common freedoms');
  assert.ok(!targetDegrees(source,['a'],adapters,['omnic.extent']).some(d=>d.properties.includes('omnic.extent')),'profile removes fixed target freedoms');
  const color=dots.find(d=>d.properties[0]==='color'),next=writeTargetDegree(source,color,'#ff0000');
  assert.equal(targetDegreeValue(next,color),'#ff0000');assert.equal(next.components[1].params.color,'#ff0000');
  assert.equal(next.components[2].params.color,source.components[2].params.color,'unselected targets are unchanged');
  assert.throws(()=>writeTargetDegree({...source,components:source.components.slice(1)},color,'#ffffff'),/no longer exists/,'stale identities never widen the scope');
});
test('preset discovery includes every applicable component and operation freedom without widening writes',()=>{
  const source=validateRecipe(partFixture());
  const ids=[...source.components.map(c=>c.id),...source.operations.map(o=>o.id)];
  const degrees=targetDegrees(source,ids,[],[],'available');
  const fraction=degrees.find(d=>d.id==='omnic.regionFraction');
  assert.ok(fraction,'operator-only freedoms are detected alongside geometry');
  assert.ok(degrees.some(d=>d.id==='omnic.extent'));
  for(const property of ['omnic.coordinate.x','omnic.coordinate.y'])assert.ok(degrees.some(d=>d.id===property),'preset menus expose writable position inputs alongside direct dragging');
  assert.ok(!targetDegrees(source,ids).some(d=>d.id==='omnic.regionFraction'),'ordinary multi-target menus retain common-only discovery');
  const next=writeTargetDegree(source,fraction,.25);
  assert.equal(targetDegreeValue(next,fraction),.25);
  assert.equal(next.components[0].params.fraction,undefined,'only the applicable owner is written');
  assert.equal(source.operations[0].params.fraction,.5,'preview writes do not mutate the prior draft');
  assert.ok(targetDegrees(next,ids,[],[],'available').some(d=>d.id==='omnic.regionAngle'));
  const whole=writeTargetDegree(next,fraction,1);
  assert.ok(!targetDegrees(whole,ids,[],[],'available').some(d=>d.id==='omnic.regionAngle'),'conditional freedoms disappear when inapplicable');
  assert.throws(()=>writeTargetDegree({...source,operations:[]},fraction,.2),/no longer exists/);
});
test('construction insertion retains existing objects and remaps independent internal scopes',()=>{
  const source=validateRecipe({...partFixture(),frames:[{id:'frame',property:'part',state:'unspecified',scope:['unit:shape']}]});
  const existing=validateRecipe(createRecipe('line')),before=JSON.stringify(existing);let n=0;
  const a=insertConstruction(existing,source,{x:30,y:-20},()=>`copy-${++n}`);
  const b=insertConstruction(a.recipe,source,{x:-30,y:20},()=>`copy-${++n}`);
  assert.equal(b.recipe.components.length,3);assert.equal(b.recipe.components[0].id,'line');
  assert.equal(a.recipe.components[1].params.x,30);assert.equal(a.recipe.components[1].params.y,-20);
  assert.deepEqual(a.recipe.operations[0].targets,a.roots);
  assert.deepEqual(a.recipe.frames[0].scope,[`${a.roots[0]}:shape`]);
  assert.notEqual(a.roots[0],b.roots[0]);assert.ok(!a.ids.includes(a.recipe.frames[0].id),'non-editable frame identities do not erase detected preset DOFs');
  assert.equal(JSON.stringify(existing),before,'prior draft snapshot remains available to Undo');
  assert.equal(source.components[0].id,'unit','the library preset is not mutated');
  assert.doesNotThrow(()=>evaluateRecipe(b.recipe));
});
test('MC geometry scopes preserve hierarchy and deletion never widens explicit operations',()=>{
  const source=validateRecipe(recipe([{id:'group',generator:'group',params:{},children:[dot('a'),dot('b',20)]},dot('a:b',60)],
    [op('only-a','highlight',['a:shape']),op('pair','highlight',['a:shape','b:shape']),op('colon-owner','highlight',['a:b:shape'])]));
  const before=JSON.stringify(source),next=deleteComponents(source,new Set(['a']));
  assert.deepEqual(rootTargets(source,['group','a']),['group']);
  assert.deepEqual(memberTargets(source,['group']),['a','b']);
  assert.deepEqual(targetLevels(source,['a']),[['a'],['group'],['group','a:b']]);
  assert.ok(!next.operations.some(item=>item.id==='only-a'));
  assert.deepEqual(next.operations.find(item=>item.id==='pair').targets,['b:shape']);
  assert.deepEqual(next.operations.find(item=>item.id==='colon-owner').targets,['a:b:shape']);
  const groupRemoved=deleteComponents(source,new Set(['group']));assert.deepEqual(groupRemoved.components.map(c=>c.id),['a:b']);
  assert.equal(JSON.stringify(source),before,'selection operations retain the prior undo snapshot');
  const mixed=validateRecipe(recipe([dot('a'),{id:'line',generator:'line',params:{length:80}}]));
  const extent=targetDegrees(mixed,['a','line']).find(d=>d.id==='omnic.extent');
  assert.equal(targetParameter(extent).min,1);assert.equal(targetParameter(extent).max,100);
});
test('MC edge fit respects off-centre geometry, independent thickness and selected DOF bounds',()=>{
  const area={x:-100,y:-100,width:200,height:200};
  const source=validateRecipe({...recipe([dot('a',50)]),atomnic:{mode:'free'}}),evaluation=evaluateRecipe(source);
  const size=targetDegrees(source,['a']).find(d=>d.id==='omnic.extent');
  almost(fitDegreeValue(source,evaluation,size,['a'],area),49);
  const line=validateRecipe({...createRecipe('line'),atomnic:{mode:'free'}}),lineResult=evaluateRecipe(line);
  const width=targetDegrees(line,['line']).find(d=>d.id==='omnic.thickness');
  almost(fitDegreeValue(line,lineResult,width,['line'],area),12);
});
test('MC compact reuses bounded packing for components and group members while preserving constraints',()=>{
  const source=validateRecipe({...recipe([dot('a',-60),dot('b',60)]),atomnic:{mode:'free'}});
  const area={x:-100,y:-100,width:200,height:200},result=compactGeometry(source,evaluateRecipe(source),['a','b'],area);
  assert.ok(targetBounds(evaluateRecipe(result),['a','b']).width<targetBounds(evaluateRecipe(source),['a','b']).width);
  assert.deepEqual(result.components.map(c=>c.id),['a','b']);assert.equal(result.components[0].params.size,5);
  const group=validateRecipe({...recipe([{id:'g',generator:'group',params:{},children:source.components}]),atomnic:{mode:'free'}});
  assert.doesNotThrow(()=>compactGeometry(group,evaluateRecipe(group),['g'],area));
  const large=validateRecipe({...recipe(Array.from({length:33},(_,i)=>dot(`d${i}`,i*5))),atomnic:{mode:'free'}});
  assert.throws(()=>compactGeometry(large,evaluateRecipe(large),large.components.map(c=>c.id),area),/32/);
});
test('normal radar picks follow rendered ring contours, complete line segments and generated roles',()=>{
  const result=evaluateRecipe(recipe([dot('unit'),{id:'rim',generator:'ring',params:{radius:30}},
    {id:'line',generator:'line',params:{y:40,length:80}},
    {id:'array',generator:'chain',params:{count:3,y:-40}}]));
  assert.equal(pickStructuralNode(result.nodes,{x:30,y:0}).componentId,'rim');
  assert.equal(pickStructuralNode(result.nodes,{x:0,y:15}),undefined,'empty ring interior does not select its boundary');
  assert.equal(pickStructuralNode(result.nodes,{x:37,y:40}).componentId,'line');
  assert.equal(pickStructuralNode(result.nodes,{x:0,y:0}).componentId,'unit');
  assert.equal(pickStructuralNode(result.nodes,{x:300,y:300},'array:unit:1').componentId,'array','local SVG roles resolve their actual generator');
});

test('Atomnic toggles tools on one recipe and permits other geometry alongside authored dots',()=>{
  const source=validateRecipe({...recipe([dot('a'),{id:'boundary',generator:'ring',params:{radius:30}},
    {id:'path',generator:'line',params:{y:40,length:80}},
    {id:'array',generator:'chain',params:{y:-40,count:3}}]),atomnic:{active:true,mode:'constrained',size:5}});
  const off=validateRecipe({...source,atomnic:{...source.atomnic,active:false}});
  assert.deepEqual(evaluateRecipe(off).nodes,evaluateRecipe(source).nodes);
  assert.equal(atomnicEditable(source),true);
  const next=addAtom(source,{x:0,y:-10},'b');
  assert.deepEqual(next.components.filter(c=>c.generator!=='dot'),source.components.filter(c=>c.generator!=='dot'));
  assert.equal(atoms(next).length,2);
  const transformed={...next,operations:[op('rotate','rotate',[],{angle:30})]};
  assert.equal(atomnicEditable(transformed),false,'evaluated transforms still require their coordinate adapter');
  assert.equal(atomnicEditable({...transformed,operations:[{...transformed.operations[0],enabled:false}]}),true);
});

test('Free accepts fractional overlapping placements while Realistic rejects incompatible geometry',()=>{
  const free=validateRecipe({...recipe([dot('a')]),atomnic:{mode:'free',size:5,step:1}});
  const overlapping=addAtom(free,{x:1,y:0},'b');
  assert.equal(atoms(overlapping)[1].x,1);assert.equal(legalAtoms(overlapping),true);
  assert.equal(legalAtoms({...overlapping,atomnic:{...overlapping.atomnic,mode:'constrained'}}),false);
  const realistic=validateRecipe({...free,atomnic:{...free.atomnic,mode:'constrained'}});
  const next=addAtom(realistic,{x:1,y:-10},'b');
  assert.equal(atoms(next)[1].x,0);assert.equal(atoms(next)[1].y,-10);
  assert.equal(legalAtoms(next),true);
  assert.throws(()=>rotateAtoms(next,new Set(['b']),{x:0,y:0},1/12),/touching-lattice/);
  assert.equal(legalAtoms(rotateAtoms(next,new Set(['b']),{x:0,y:0},1/6)),true);
  assert.deepEqual(atoms(overlapping).map(a=>[a.id,a.x,a.y]),[['a',0,0],['b',1,0]],'rejected realistic candidates do not mutate Free source');
});

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
  assert.deepEqual(GENERATORS.map(g=>g.id),['count-grid','dot','ring','rings','line','chain','radial','group','reference']);
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

test('Line and Ring presets are independent and oscillation belongs to motion effects',()=>{
  assert.deepEqual(createRecipe('line').components.map(c=>c.generator),['line']);
  assert.deepEqual(createRecipe('boundary').components.map(c=>c.generator),['ring']);
  assert.ok(!PRESETS.some(p=>p.id==='oscillation'));
  const effect=OPERATORS.find(o=>o.id==='oscillate');assert.equal(effect.category,'mfx');
  for(const preset of ['line','boundary','radial','chain','nested']){
    const source=createRecipe(preset),targets=source.components.map(c=>c.id);
    const before=evaluateRecipe(source),after=evaluateRecipe({...source,operations:[op('motion','oscillate',targets,{amplitude:10,frequency:1,axis:'y'})]},undefined,.25);
    assert.equal(after.motion,true);assert.equal(after.properties.count,before.properties.count);
    for(const node of before.nodes){const moved=after.nodes.find(n=>n.id===node.id);almost(moved.y,node.y+10);}
  }
});
test('semantic oscillation is deterministic at explicit time and paused at time zero',()=>{
  const source=recipe([dot('disk')],[op('oscillation','oscillate',['disk'],{amplitude:15,frequency:1,axis:'y'})]),zero=evaluateRecipe(source),quarter=evaluateRecipe(source,undefined,.25),again=evaluateRecipe(source,undefined,.25);
  assert.equal(zero.motion,true);almost(zero.nodes.find(n=>n.kind==='dot').y,0);almost(quarter.nodes.find(n=>n.kind==='dot').y,15);
  assert.deepEqual(quarter,again);assert.throws(()=>evaluateRecipe(source,undefined,Infinity),/time/);
});

test('SVG adapter is self-contained, deterministic, bounded and exposes stable role addresses',()=>{
  const source=createRecipe('boundary');source.components.push(...createRecipe('radial').components);
  const result=evaluateRecipe(source),svg=renderSVG(result),bounds=evaluationBounds(result);
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
  const member=evaluateRecipe(memberFixture());
  assert.equal(member.properties.count,2);
  assert.deepEqual(member.nodes.filter(n=>n.highlight).map(n=>n.id),['units:unit:0']);
  const part=evaluateRecipe(partFixture());
  assert.equal(part.properties.count,1);
  assert.equal(part.nodes.find(n=>n.highlight).highlight.fraction,.5);
  const svg=renderSVG(part);
  assert.match(svg,/data-omnic-fraction="0.5"/);assert.match(svg,/<path /);
  const source=memberFixture();source.operations[0].params.index=3;
  const unavailable=evaluateRecipe(source);
  assert.equal(unavailable.nodes.filter(n=>n.highlight).length,0);
  assert.ok(unavailable.diagnostics.some(d=>d.message.includes('outside this scope')));
});
test('region, per-unit and group rotations have distinct pivots and saved snapping',()=>{
  const source=partFixture();source.components[0].params.x=25;
  source.operations.push(op('turn','rotate',[],{angle:50,snap:30,scope:'region',pivot:'center'}));
  const region=evaluateRecipe(source).nodes.find(n=>n.highlight);
  almost(region.x,25);almost(region.highlight.start,60);
  const pair=memberFixture();pair.operations.push(op('turn','rotate',[],{angle:90,scope:'each',pivot:'center'}));
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
  const tool=operationTool(partFixture().operations[0]);assert.ok(isOperationTool(tool));
  const before=JSON.stringify(tool);
  const target=createRecipe('chain');let count=0;
  const stamped=applyOperationTool(target,tool,['chain'],()=>`copy-${++count}`);
  assert.equal(stamped.operations.length,1);
  assert.equal(evaluateRecipe(stamped).nodes.filter(n=>n.highlight).length,5);
  assert.equal(JSON.stringify(tool),before);assert.equal(target.operations.length,0);
  assert.throws(()=>applyOperationTool(target,partFixture(),[],()=>`copy-${++count}`));
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

test('direct target translation preserves group geometry, scope and profile legality',()=>{
  const recipe={version:2,revision:1,atomnic:{active:false,mode:'free'},components:[{id:'g',generator:'group',params:{x:10,y:20},children:[{id:'r',generator:'ring',params:{x:3,y:4,radius:10}}]},{id:'other',generator:'line',params:{length:30}}],operations:[],frames:[]};
  const next=translateTargets(recipe,new Set(['g','r']),{x:7,y:-2});
  assert.deepEqual(next.components[0].params,{x:17,y:18});
  assert.deepEqual(next.components[0].children[0].params,recipe.components[0].children[0].params,'selected ancestors prevent double translation');
  assert.deepEqual(next.components[1],recipe.components[1]);assert.deepEqual(recipe.components[0].params,{x:10,y:20});
  assert.throws(()=>translateTargets(recipe,new Set(['stale']),{x:1,y:0}),/no longer exists/);
  const dot={...recipe,atomnic:{mode:'constrained',size:10},components:[{id:'dot',generator:'dot',params:{size:10,x:0,y:0}}]};
  assert.throws(()=>translateTargets(dot,new Set(['dot']),{x:1,y:0}),/Realistic/);
});

test('nested rings expose bounded count, spacing, drift and visual progression',()=>{
  const source=createRecipe('nested-rings');
  const initial=evaluateRecipe(source).nodes.filter(n=>n.kind==='ring');
  assert.deepEqual(initial.map(n=>n.radius),[20,40,60]);
  source.components[0].params={count:4,radius:10,spacing:5,growth:2,drift:3,angle:90,thickness:2,thicknessGrowth:1.5,opacity:.8,opacityGrowth:.5,fill:false};
  const rings=evaluateRecipe(source).nodes.filter(n=>n.kind==='ring');
  assert.deepEqual(rings.map(n=>n.radius),[10,15,25,45]);
  assert.deepEqual(rings.map(n=>n.y),[0,3,6,9]);
  almost(rings[3].thickness,6.75);almost(rings[3].opacity,.1);
  source.components[0].params={count:64,growth:2,spacing:100};
  assert.throws(()=>evaluateRecipe(source),/extent/);
});

test('selection sweep collects intervening dots, ring boundaries and lines without filling ring holes',async()=>{
  const {structuralIdsAlong}=await import('../src/omnic/svg.ts');
  const nodes=evaluateRecipe(recipe([dot('a',-20),dot('b',20),{id:'ring',generator:'ring',params:{radius:40,fill:false}},{id:'line',generator:'line',params:{length:80,angle:90}}])).nodes;
  assert.deepEqual([...structuralIdsAlong(nodes,{x:-60,y:0},{x:60,y:0})].sort(),['a','b','line','ring']);
  assert.equal(structuralIdsAlong(nodes,{x:10,y:0},{x:12,y:0}).has('ring'),false);
  assert.equal(structuralIdsAlong(nodes,{x:-20,y:30},{x:20,y:30}).has('line'),true);
});

 test('appearance degrees inherit one category in preset, target and MC projections',()=>{
  const source=createRecipe('nested-rings');
  const degrees=targetDegrees(source,['rings']);
  for(const property of ['color','opacity','omnic.opacityProgression']){
    const degree=degrees.find(d=>d.properties.includes(property));
    assert.equal(degree.group[0].id,'visual');assert.equal(degree.group[0].label,'Appearance');assert.equal(degree.group[0].symbol,'✨');
  }
  for(const property of ['omnic.count','omnic.fill','omnic.thickness','omnic.strokeProgression'])assert.equal(degrees.find(d=>d.properties.includes(property)).group[0].symbol,'●●');
  assert.equal(degrees.find(d=>d.properties.includes('omnic.radius')).group[0].symbol,'⨮');
  for(const property of ['omnic.spacing','omnic.ringDrift','omnic.ringGrowth','omnic.angle'])assert.equal(degrees.find(d=>d.properties.includes(property)).group[0].symbol,'⨮');
});


test('mathematical slot rules anchor normal and recursion to base and pack circumference',async()=>{
 const {mathematicalSlotValue,radialSlotCapacity}=await import('../src/properties/mathematicalDial.ts');
 assert.equal(mathematicalSlotValue(2,2,'normal'),4);
 assert.equal(mathematicalSlotValue(2,6,'normal'),12);
 assert.equal(mathematicalSlotValue(2,1,'recursion'),4);
 assert.equal(mathematicalSlotValue(2,3,'recursion'),16);
 assert.equal(mathematicalSlotValue(2,6,'recursion'),128);
 assert.equal(mathematicalSlotValue(2,9,'recursion'),1024);
 assert.equal(mathematicalSlotValue(2,4,'normal')+mathematicalSlotValue(2,6,'recursion'),136);
 assert.equal(radialSlotCapacity(24,24),6);
 assert.equal(radialSlotCapacity(36,24),9);
 assert.equal(radialSlotCapacity(60,24),15);
 assert.equal(radialSlotCapacity(84,24),21);
 for(const radius of [24,36,48,60,72,84]){const count=radialSlotCapacity(radius,24);assert.ok(2*radius*Math.sin(Math.PI/count)>=24-1e-8);assert.ok(2*radius*Math.sin(Math.PI/(count+1))<24);}
});


test('mathematical outer ring activation requires an extra mark beyond the current rim',async()=>{
 const {canAddMathematicalRing}=await import('../src/properties/mathematicalDial.ts');
 assert.equal(canAddMathematicalRing(1,[]),false);
 assert.equal(canAddMathematicalRing(1,[0]),false);
 assert.equal(canAddMathematicalRing(1,[0,1]),true);
 assert.equal(canAddMathematicalRing(2,[0,1]),false);
 assert.equal(canAddMathematicalRing(2,[0,1,2]),true);
 assert.equal(canAddMathematicalRing(4,[4]),false);
});


test('mathematical fill sweep covers crossed slots without toggling or mutating earlier marks',async()=>{
 const {fillMathematicalSlots}=await import('../src/properties/mathematicalDial.ts');
 const slots=[{key:'a',x:20,y:0,radius:5},{key:'b',x:50,y:0,radius:5},{key:'c',x:80,y:0,radius:5},{key:'off',x:50,y:30,radius:5}];
 const before=['c'],after=fillMathematicalSlots(before,slots,{x:0,y:0},{x:100,y:0});
 assert.deepEqual(new Set(after),new Set(['a','b','c']));assert.deepEqual(before,['c']);
 assert.equal(fillMathematicalSlots(after,slots,{x:100,y:0},{x:0,y:0}),after);
 assert.equal(fillMathematicalSlots(after,slots,{x:0,y:20},{x:20,y:20}),after);
});


test('all mathematical slots use the confirmed rule through sum, property write and rendered grid',async()=>{
 const {mathematicalSlotValue,mathematicalSelectionValue,radialSlotCapacity}=await import('../src/properties/mathematicalDial.ts');
 for(const base of [1,2])for(let order=0;order<4;order++){
  const size=24,radius=(base+1)*size/2+order*size,count=radialSlotCapacity(radius,size);
  for(let ordinal=1;ordinal<=count;ordinal++)for(const mode of ['normal','recursion']){
   const expected=mode==='normal'?base*ordinal:base**(ordinal+1),key=`${order}:${ordinal}`;
   assert.equal(mathematicalSlotValue(base,ordinal,mode),expected);
   const selection=[{key,ordinal,mode}],sum=mathematicalSelectionValue(base,selection);
   if(base===1&&mode==='recursion'){assert.ok(Number.isNaN(sum));continue;}
   assert.equal(sum,expected);assert.equal(mathematicalSelectionValue(base,[...selection,...selection]),expected);
   if(expected<=512){const source=createRecipe('count-grid'),degree=targetDegrees(source,['count-grid']).find(d=>d.id==='omnic.count');
    const next=writeTargetDegree(source,degree,sum);assert.equal(targetDegreeValue(next,degree),expected);assert.equal(evaluateRecipe(next).nodes.filter(n=>n.kind==='dot').length,expected);}
  }
 }
 const pair=[{key:'normal',ordinal:4,mode:'normal'},{key:'recursion',ordinal:6,mode:'recursion'}];
 assert.equal(mathematicalSelectionValue(2,pair),136);
 assert.equal(mathematicalSelectionValue(2,pair.filter(s=>s.key!=='normal')),128);
 assert.equal(mathematicalSelectionValue(2,[]),0);
});


test('mathematical brush stamps its mode only into visited slots and preview does not mutate marks',async()=>{
 const {paintMathematicalSlots,mathematicalSelectionValue}=await import('../src/properties/mathematicalDial.ts');
 const original={selected:['0:0','0:1'],modes:{'0:0':'normal','0:1':'normal'}},before=JSON.stringify(original);
 const value=marks=>mathematicalSelectionValue(2,marks.selected.map(key=>({key,ordinal:Number(key.split(':')[1])+1,mode:marks.modes[key]??'normal'})));
 assert.equal(value(original),6);
 const preview=paintMathematicalSlots(original,['0:0'],'recursion');
 assert.equal(value(preview),8);assert.equal(preview.modes['0:1'],'normal');assert.equal(JSON.stringify(original),before);
 const swept=paintMathematicalSlots(original,['0:0','0:1'],'recursion');assert.equal(value(swept),12);
 assert.equal(paintMathematicalSlots(swept,['0:0','0:1'],'recursion'),swept);
 assert.equal(value(paintMathematicalSlots(swept,['0:0'],'normal')),10);
});
