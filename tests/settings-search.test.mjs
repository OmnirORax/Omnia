import test from 'node:test';
import assert from 'node:assert/strict';
import {searchMatches,searchIndex} from '../src/ui/search.ts';
import {NAVIGATION_PROPERTIES} from '../src/navigation/options.ts';
import {NODE_VISUAL_PROPERTIES} from '../src/properties/nodeVisuals.ts';
import {NORMALIZATION_FIELDS,normalizationProperty} from '../src/scene/normalization.ts';

test('search finds declared controls by IDs, options, hierarchy and words in any order',()=>{
 const mode=NAVIGATION_PROPERTIES.find(p=>p.key==='navigation.mode'),indexed=searchIndex({label:'Camera movement',keywords:'world navigation rotation',definition:mode});
 assert.equal(searchMatches(indexed,'orbit camera'),true);assert.equal(searchMatches(indexed,'camera orbit'),true);assert.equal(searchMatches(indexed,'walk'),true);
 const radius=NODE_VISUAL_PROPERTIES.find(p=>p.id==='translucencyRadius');assert.equal(searchMatches(searchIndex({label:radius.label,keywords:'global nodes body',definition:{...radius,key:radius.id}}),'nodes radius'),true);
 const correction=NORMALIZATION_FIELDS.find(p=>p.key==='luminanceMin');assert.equal(searchMatches(searchIndex({label:correction.label,keywords:'scene',definition:{...correction,key:normalizationProperty(correction.key)}}),'normalization minimum'),true);
});
test('related terms find existing controls and unmatched terms stay unmatched',()=>{
 assert.equal(searchMatches('scene audio cooldown ms','blink delay'),false);
 assert.equal(searchMatches('scene audio pulse cooldown ms','blinking delay'),true);
 assert.equal(searchMatches('nodes translucency','node transparency'),true);
 assert.equal(searchMatches('neutral colour tolerance','neutral color tolerance'),true);
 assert.equal(searchMatches('history undo mb4 ctrl z','ctrl z'),true);
 assert.equal(searchMatches('world lattice scale','saturation'),false);
});
