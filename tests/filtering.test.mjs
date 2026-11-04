import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareFilters,applyFilters,emptyFilters,filterPage} from '../src/filtering/model.ts';
import {questCategory,questFilterContext,questFilterSchema} from '../src/metrics/questFilters.ts';
const data={benchmarks:[{id:'short',seconds:5},{id:'long',seconds:30}],quests:[{id:'a',benchmark_id:'short',target:20},{id:'b',benchmark_id:'long',target:150},{id:'c',benchmark_id:'short',target:50}],claims:['c'],best:{short:25}};
const state=(choices={},query='')=>({choices,query});
test('quest categories include the exact duration boundary and existing seed requirements',()=>{
 assert.equal(questCategory(29).id,'speed');assert.equal(questCategory(30).id,'endurance');
 const index=prepareFilters(data.quests,questFilterSchema,questFilterContext(data));
 assert.deepEqual(applyFilters(index,state({category:'speed'})).items.map(q=>q.id),['a','c']);
 assert.deepEqual(applyFilters(index,state({category:'endurance'})).items.map(q=>q.id),['b']);
 assert.deepEqual(applyFilters(index,state({category:'speed',status:'ready'})).items.map(q=>q.id),['a']);
 assert.deepEqual(applyFilters(index,state({status:'claimed'})).items.map(q=>q.id),['c']);
 assert.deepEqual(applyFilters(index,state({category:'endurance',status:'claimed'})).items,[]);
 assert.equal(applyFilters(index,emptyFilters()).items.length,3);
});
test('text combines with facets and counts apply every other selected facet',()=>{
 const index=prepareFilters(data.quests,questFilterSchema,questFilterContext(data));
 const result=applyFilters(index,state({category:'speed',status:'ready'}));
 assert.deepEqual(result.counts.status,{available:0,ready:1,claimed:1});
 assert.deepEqual(result.counts.category,{speed:1,endurance:0});
 assert.deepEqual(applyFilters(index,state({},'150 endurance')).items.map(q=>q.id),['b']);
 assert.equal(applyFilters(index,state({category:'speed'},'150')).items.length,0);
 assert.equal(applyFilters(index,state({category:'unknown',other:'unregistered'})).items.length,3);
});
test('an independent inventory domain reuses filtering and normalization without quest dependencies',()=>{
 let reads=0;
 const schema={text:item=>{reads++;return item.name;},facets:[{id:'warehouse',label:'Warehouse',options:[{id:'east',label:'East'},{id:'west',label:'West'}],read:item=>{reads++;return item.warehouses;}}]};
 const inventory=[{name:'Café mugs',warehouses:['east','west']},{name:'Coffee beans',warehouses:['west']}];
 const index=prepareFilters(inventory,schema,null),preparedReads=reads;
 assert.deepEqual(applyFilters(index,state({warehouse:'east'},'cafe')).items,[inventory[0]]);
 assert.deepEqual(applyFilters(index,state({warehouse:'west'},'beans')).items,[inventory[1]]);
 assert.equal(reads,preparedReads,'typing and changing filters never recompute domain facts');
 assert.equal(applyFilters(index,state({},'[')).items.length,0,'query is literal text, never regex');
 assert.deepEqual(inventory[0].warehouses,['east','west'],'matching never changes source data');
});
test('new profile snapshots refresh completion facts; no match is empty and pagination clamps safely',()=>{
 const changed={...data,claims:['a','b','c']};
 const index=prepareFilters(changed.quests,questFilterSchema,questFilterContext(changed));
 assert.equal(applyFilters(index,state({status:'claimed'})).items.length,3);
 assert.deepEqual(filterPage([],500,12),{page:0,pages:1,items:[]});
 assert.deepEqual(filterPage([1,2,3],8,2),{page:1,pages:2,items:[3]});
 assert.throws(()=>filterPage([],0,0));
});
