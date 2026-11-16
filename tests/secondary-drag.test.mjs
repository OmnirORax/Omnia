import test from 'node:test';
import assert from 'node:assert/strict';
import {createSecondaryRelease} from '../src/composer/runtime/ui/secondaryRelease.ts';
for(const contextFirst of [true,false])test(`right-drag never opens a menu after returning to start; context first=${contextFirst}`,()=>{const menu=createSecondaryRelease();menu.press('open',{x:10,y:10});if(contextFirst)assert.equal(menu.context(),undefined);assert.equal(menu.move({x:20,y:10}),true);menu.move({x:10,y:10});assert.equal(menu.release('open'),undefined);assert.equal(menu.context(),undefined);assert.equal(menu.hasPress(),false);});
test('right-click jitter still permits one menu',()=>{const menu=createSecondaryRelease();menu.press('open',{x:10,y:10});assert.equal(menu.move({x:11,y:11}),false);menu.context();assert.equal(menu.release('open'),'open');assert.equal(menu.context(),undefined);});
