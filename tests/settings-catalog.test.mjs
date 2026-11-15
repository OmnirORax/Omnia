import test from 'node:test';
import assert from 'node:assert/strict';
import {createSettingsCatalog} from '../src/ui/settingsCatalog.ts';
import {searchIndex,searchMatches} from '../src/ui/search.ts';
test('menu declarations are searchable before opening and future controls need no search entry',()=>{
 const catalog=createSettingsCatalog();let enabled=false;
 const entries=[{label:'Browser shortcuts',keywords:'world chrome',definition:{key:'browserShortcuts',label:'Browser shortcuts',kind:'toggle'},read:()=>enabled,set:value=>{enabled=value;}}];
 const menu=catalog.define('world',()=>entries);
 const find=query=>catalog.all().filter(item=>searchMatches(searchIndex(item),query));
 assert.equal(find('browser')[0],entries[0]);find('chrome')[0].set(true);assert.equal(menu()[0].read(),true);
 entries.push({label:'Future option',definition:{key:'futureOption',label:'Future option',kind:'number'}});
 assert.equal(find('future option')[0],menu()[1]);
 catalog.define('new-section',()=>[{label:'New feature'}]);assert.equal(find('new feature').length,1);
 assert.throws(()=>catalog.define('world',()=>[]),/Duplicate/);
});
