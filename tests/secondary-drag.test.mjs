import test from 'node:test';
import assert from 'node:assert/strict';
import {createSecondaryRelease} from '../src/composer/runtime/ui/secondaryRelease.ts';
for(const contextFirst of [true,false])test(`right-drag never opens a menu after returning to start; context first=${contextFirst}`,()=>{const menu=createSecondaryRelease();menu.press('open',{x:10,y:10});if(contextFirst)assert.equal(menu.context(),undefined);assert.equal(menu.move({x:20,y:10}),true);menu.move({x:10,y:10});assert.equal(menu.release('open'),undefined);assert.equal(menu.context(),undefined);assert.equal(menu.hasPress(),false);});
test('even one pixel of right-button movement cancels the menu',()=>{const menu=createSecondaryRelease();menu.press('open',{x:10,y:10});assert.equal(menu.move({x:11,y:10}),true);menu.context();assert.equal(menu.release('open'),undefined);});
test('stationary right-click opens once, while release displacement without a move event cancels',()=>{const menu=createSecondaryRelease();menu.press('open',{x:10,y:10});menu.context();assert.equal(menu.release('open',{x:10,y:10}),'open');menu.press('open',{x:10,y:10});menu.context();assert.equal(menu.release('open',{x:11,y:10}),undefined);});

test('movement after a stationary release does not cancel a delayed context event',()=>{const menu=createSecondaryRelease();menu.press('open',{x:10,y:10});assert.equal(menu.release('open',{x:10,y:10}),undefined);assert.equal(menu.move({x:20,y:10}),false);assert.equal(menu.context(),'open');});
