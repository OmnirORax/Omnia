import test from 'node:test';
import assert from 'node:assert/strict';
import {createWindowDismissal} from '../src/ui/windowDismissal.ts';
const root = (parent) => ({parent,isConnected:true,contains(node){for(let current=node;current;current=current.parent)if(current===this)return true;return false;}});

test('outside clicks retain windows; Escape closes only the last interacted live window',()=>{
 const windows=createWindowDismissal(),first=root(),second=root(),outside=root(),closed=[];
 windows.register(first,()=>{closed.push('first');first.isConnected=false;});
 windows.register(second,()=>{closed.push('second');second.isConnected=false;});
 windows.activate(first);windows.activate(outside);assert.deepEqual(closed,[]);
 assert.equal(windows.close(),true);assert.deepEqual(closed,['first']);
 windows.close();assert.deepEqual(closed,['first','second']);assert.equal(windows.close(),false);
});
test('nested and portalled menus close before their enclosing window',()=>{
 const windows=createWindowDismissal(),window=root(),nested=root(window),portal=root(),childPortal=root(),closed=[];
 windows.register(window,()=>closed.push('window'));
 windows.register(nested,()=>closed.push('nested'));
 windows.activate(nested);windows.close();assert.deepEqual(closed,['nested']);
 const stopChild=windows.register(childPortal,()=>closed.push('child'),2);
 const stopParent=windows.register(portal,()=>closed.push('parent'),1);
 windows.activate(window);windows.close();assert.equal(closed.at(-1),'child');
 stopChild();windows.close();assert.equal(closed.at(-1),'parent');stopParent();
});
test('close veto and disposed registrations never fall through to another window',()=>{
 const windows=createWindowDismissal(),first=root(),second=root(),closed=[];
 windows.register(first,()=>closed.push('first'));
 const dispose=windows.register(second,()=>{closed.push('veto');return false;});
 assert.equal(windows.close(),true);assert.deepEqual(closed,['veto']);
 dispose();windows.close();assert.deepEqual(closed,['veto','first']);
});
