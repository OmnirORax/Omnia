import test from 'node:test';
import assert from 'node:assert/strict';
import {createReleaseShortcuts} from '../src/ui/releaseShortcuts.ts';
const key=(key,extra={})=>({key,code:`Key${key.toUpperCase()}`,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,...extra});
test('commands confirm exactly once on release, not press/repeat; blur cancels',()=>{const queue=createReleaseShortcuts();let calls=0;queue.press(key('n'),()=>calls++);queue.press(key('n'),()=>calls++);assert.equal(calls,0);assert.equal(queue.release(key('n')),true);assert.equal(calls,1);assert.equal(queue.release(key('n')),false);queue.press(key('x'),()=>calls++);queue.cancel();queue.release(key('x'));assert.equal(calls,1);});
for(const prefixFirst of [true,false])test(`V+Q consumes standalone V regardless of release order: prefix first=${prefixFirst}`,()=>{const queue=createReleaseShortcuts();let views=0,chord=false;queue.press(key('v'),()=>views++);queue.press(key('q'),()=>{chord=queue.held('V');},['V']);if(prefixFirst)queue.release(key('v'));queue.release(key('q'));if(!prefixFirst)queue.release(key('v'));assert.equal(chord,true);assert.equal(views,0);});
test('pointer chord consumption prevents X release from moving the origin',()=>{const queue=createReleaseShortcuts();let moved=false;queue.press(key('x'),()=>moved=true);assert.equal(queue.held('X'),true);queue.consume('X');queue.release(key('x'));assert.equal(moved,false);});

test('installed gateway dispatches a command only on physical release and cancels on focus/blur',async()=>{
 const {installReleaseShortcuts,releaseShortcuts}=await import('../src/ui/releaseShortcuts.ts');const saved=Object.fromEntries(['window','document','Node','Element','KeyboardEvent'].map(name=>[name,globalThis[name]])),listeners=new Map(),documentListeners=new Map(),seen=[];
 class Node{isConnected=true;}class Element extends Node{editing=false;closest(){return this.editing?this:null;}dispatchEvent(event){event.target=this;emit(event.type,event);return true;}}
 class KeyboardEvent{isTrusted=false;stopped=false;constructor(type,init){this.type=type;Object.assign(this,init);}preventDefault(){}stopImmediatePropagation(){this.stopped=true;}}
 const emit=(type,event)=>{for(const listener of listeners.get(type)??[]){listener(event);if(event?.stopped)break;}};const target=new Element();
 Object.assign(globalThis,{Node,Element,KeyboardEvent,window:{addEventListener(type,listener){listeners.set(type,[...(listeners.get(type)??[]),listener]);}},document:{activeElement:target,hidden:false,addEventListener(type,listener){documentListeners.set(type,listener);}}});
 const physical=()=>({isTrusted:true,...key('n'),target,preventDefault(){},stopImmediatePropagation(){this.stopped=true;}});
 try{let inspections=0;installReleaseShortcuts(event=>{inspections++;return event.key==='n';});for(const type of ['keydown','keyup'])listeners.get(type).push(event=>{if(!event.isTrusted)seen.push(type);});emit('keydown',physical());emit('keydown',physical());assert.equal(inspections,1,'held-key repeats must not rebuild command metadata');assert.deepEqual(seen,[]);emit('keyup',physical());assert.deepEqual(seen,['keydown','keyup']);seen.length=0;
 emit('keydown',physical());const input=new Element();input.editing=true;document.activeElement=input;emit('keyup',physical());assert.deepEqual(seen,[]);document.activeElement=target;emit('keydown',physical());emit('blur');emit('keyup',physical());assert.deepEqual(seen,[]);

 let starts=0,commits=0,cancels=0;installReleaseShortcuts(event=>event.key==='x',()=>[],()=>{starts++;return {release:()=>commits++,cancel:()=>cancels++};});const originKey=()=>({...physical(),key:'x',code:'KeyX'});
 emit('keydown',originKey());assert.equal(starts,1);assert.equal(commits,0);emit('keyup',originKey());assert.equal(commits,1);
 emit('keydown',originKey());document.activeElement=input;emit('keyup',originKey());assert.equal(commits,1);assert.equal(cancels,1);document.activeElement=target;
 emit('keydown',originKey());emit('blur');emit('keyup',originKey());assert.equal(commits,1);assert.equal(cancels,2);
 }finally{releaseShortcuts.cancel();Object.assign(globalThis,saved);}
});

test('a released cancel command suppresses other still-held pending commands',()=>{const queue=createReleaseShortcuts();let changed=false;queue.press(key('x'),()=>changed=true);queue.press(key('Escape'),()=>queue.cancel());queue.release(key('Escape'));queue.release(key('x'));assert.equal(changed,false);});

test('consuming an origin chord cancels its press session immediately and release cannot author it later',()=>{
 const queue=createReleaseShortcuts();let cancelled=0,committed=0;queue.press(key('x'),()=>committed++,[],()=>cancelled++);queue.consume('X');assert.equal(cancelled,1);queue.release(key('x'));assert.equal(committed,0);assert.equal(cancelled,1);
 queue.press(key('x'),()=>committed++,[],()=>cancelled++);queue.cancel();queue.release(key('x'));assert.equal(committed,0);assert.equal(cancelled,2);
 queue.press(key('x'),()=>committed++,[],()=>cancelled++);queue.release(key('x'));assert.equal(committed,1);assert.equal(cancelled,2);
});
