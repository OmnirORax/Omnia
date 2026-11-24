import test from 'node:test';
import assert from 'node:assert/strict';
import {searchMatches,searchText,searchIndex} from '../src/ui/search.ts';
test('symbol queries remain meaningful and emoji presentation variants match',()=>{
 assert.equal(searchMatches('Camera settings','♾️'),false);
 assert.equal(searchMatches(searchIndex({label:'♾️ · Account'}),'♾'),true);
 assert.equal(searchMatches('♾ · Account','♾️'),true);
 assert.equal(searchMatches('Camera settings','...'),false);
 assert.equal(searchMatches('Camera settings',''),true);
});
test('Unicode text and math symbols remain searchable alongside accent and camel-case normalization',()=>{
 assert.equal(searchMatches('日本語 настройки Δ','日本'),true);
 assert.equal(searchMatches('日本語 настройки Δ','настрой'),true);
 assert.equal(searchMatches('Radius ≥ 5','≥'),true);
 assert.equal(searchText('glowColor café'),'glow color cafe');
});
