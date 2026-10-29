import test from 'node:test';
import assert from 'node:assert/strict';
import { PROPERTY_REGISTRY } from '../src/appearance/registry.ts';
import { preparePropertyChanges } from '../src/properties/registry.ts';
import { contextPropertyBindings, installContextBindings } from '../src/properties/contextBindings.ts';
import { commitOmnicParameter, omnicPropertyBindings } from '../src/omnic/propertyAdapter.ts';
import { GENERATORS, OPERATORS } from '../src/omnic/registry.ts';
const generator=id=>GENERATORS.find(item=>item.id===id);

test('Omnic aliases share one property but write the selected parameter key and bounds',()=>{
  let dot={size:6},line={length:80};
  const a=omnicPropertyBindings(dot,next=>dot=next,generator('dot').parameters);
  const b=omnicPropertyBindings(line,next=>line=next,generator('line').parameters);
  assert.equal(a.values['omnic.composer']['omnic.extent'],6);
  assert.equal(b.values['omnic.composer']['omnic.extent'],80);
  assert.deepEqual(a.limits['omnic.composer']['omnic.extent'],{min:.5,max:100});
  assert.deepEqual(b.limits['omnic.composer']['omnic.extent'],{min:1,max:300});
  a.commit(preparePropertyChanges(PROPERTY_REGISTRY,'omnic.extent',200,['omnic.composer']));
  assert.deepEqual(dot,{size:100});assert.deepEqual(line,{length:80});
  b.commit(preparePropertyChanges(PROPERTY_REGISTRY,'omnic.extent',200,['omnic.composer']));
  assert.deepEqual(line,{length:200});assert.equal('size' in line,false);
});

test('Omnic count is integral and contextual bindings expose only active inputs',()=>{
  const spec=generator('radial'), count=spec.parameters.find(parameter=>parameter.key==='count');
  assert.deepEqual(commitOmnicParameter({count:6},count,2.8),{count:3});
  assert.deepEqual(commitOmnicParameter({count:6},count,1000),{count:64});
  const values=omnicPropertyBindings({count:6},()=>{},OPERATORS.find(item=>item.id==='count').parameters).values['omnic.composer'];
  assert.deepEqual(Object.keys(values),['omnic.count']);
  assert.equal(PROPERTY_REGISTRY.consumer('omnic.composer').channels.color,'color');
  assert.equal(PROPERTY_REGISTRY.definitions.filter(property=>property.id==='color').length,1);
});

test('context owner bindings route commits to the current owner and disappear on unmount',()=>{
  const writes=[];
  const base={values:{settings:{value:1}},commit:changes=>writes.push(['base',changes])};
  const first={values:{active:{value:2}},limits:{active:{value:{min:0,max:3}}},commit:changes=>writes.push(['first',changes])};
  const owner=installContextBindings(first);
  try {
    const merged=contextPropertyBindings(base);
    assert.equal(merged.values.settings.value,1);assert.equal(merged.values.active.value,2);
    merged.commit([{consumer:'settings',property:'value',value:2},{consumer:'active',property:'value',value:3}]);
    assert.deepEqual(writes.map(write=>write[0]),['base','first']);
    owner.update({...first,values:{active:{value:3}}});
    assert.equal(contextPropertyBindings(base).values.active.value,3);
  } finally {owner.dispose();}
  assert.equal(contextPropertyBindings(base),base);
});

test('an inactive Omnic parameter cannot introduce an unrelated recipe field',()=>{
  let writes=0;
  const params={angle:45};
  const binding=omnicPropertyBindings(params,()=>writes++,OPERATORS.find(item=>item.id==='rotate').parameters);
  binding.commit(preparePropertyChanges(PROPERTY_REGISTRY,'omnic.count',3,['omnic.composer']));
  assert.equal(writes,0);assert.deepEqual(params,{angle:45});
});

test('whole-number domains are declared once and shared by numeral editing and recipe adapters',()=>{
 for(const property of ['omnic.count','omnic.unitIndex','halving.angularOrder','halving.turnSteps','halving.axisStep'])assert.equal(PROPERTY_REGISTRY.property(property).integer,true);
 for(const property of ['omnic.coordinate.x','omnic.extent','omnic.angle','opacity'])assert.ok(!PROPERTY_REGISTRY.property(property).integer);
 for(const spec of [...GENERATORS,...OPERATORS])for(const parameter of spec.parameters.filter(p=>p.integer)){
  assert.equal(parameter.kind,'number');
  const input=Math.min(parameter.max,Math.max(parameter.min,parameter.initial+0.25));
  assert.equal(commitOmnicParameter({},parameter,input)[parameter.key],Math.round(input));
 }
});
