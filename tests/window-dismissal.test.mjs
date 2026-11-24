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

test('Escape dismisses a composer popup but leaves its protected composer open',()=>{
 const windows=createWindowDismissal(),other=root(),composer=root(),popup=root(),closed=[];
 windows.register(other,()=>closed.push('other'));
 windows.register(composer,()=>closed.push('composer'),0,false);
 const stop=windows.register(popup,()=>{closed.push('popup');popup.isConnected=false;},1);
 windows.close();assert.deepEqual(closed,['popup']);stop();
 assert.equal(windows.close(),true);assert.deepEqual(closed,['popup']);
 windows.activate(other);windows.close();assert.deepEqual(closed,['popup','other']);
});

test('window confirmation and typed-input ownership follow the same top window as dismissal',()=>{
 const windows=createWindowDismissal(),calls=[],a={isConnected:true,contains:n=>n==='a'},b={isConnected:true,contains:n=>n==='b'};
 windows.register(a,()=>calls.push('close a'),1,true,()=>calls.push('confirm a'));
 const stop=windows.register(b,()=>calls.push('close b'),2,true,()=>calls.push('confirm b'));
 assert.equal(windows.owns('a'),false);assert.equal(windows.owns('b'),true);assert.equal(windows.canConfirm(),true);assert.equal(windows.confirm(),true);assert.deepEqual(calls,['confirm b']);
 stop();windows.confirm();assert.deepEqual(calls,['confirm b','confirm a']);a.isConnected=false;assert.equal(windows.canConfirm(),false);assert.equal(windows.confirm(),false);
});

test('Enter on a focused dial button confirms on release rather than clicking the dot again',async()=>{
 const {createWindowConfirmation}=await import('../src/ui/windowDismissal.ts');
 const windows=createWindowDismissal(),button={kind:'button'},input={kind:'input'},calls=[],dial={isConnected:true,contains:target=>target===button||target===input};
 windows.register(dial,()=>{},1,true,()=>calls.push('apply'));
 const keyboard=createWindowConfirmation(windows,target=>target===input),event=(target=button,extra={})=>({key:'Enter',target,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra});
 const down=event();keyboard.keydown(down);assert.equal(down.prevented,true);assert.equal(down.stopped,true);assert.deepEqual(calls,[]);
 keyboard.keydown(event(button,{repeat:true}));keyboard.keyup(event());assert.deepEqual(calls,['apply']);keyboard.keyup(event());assert.equal(calls.length,1);
 const host={matches:()=>true,contains:node=>node===dial};keyboard.keydown(event(host));keyboard.keyup(event(host));assert.deepEqual(calls,['apply','apply'],'pointer selection keeps focus on the popup host, which still confirms its nested dial');
 const typing=event(input);keyboard.keydown(typing);keyboard.keyup(event(input));assert.equal(typing.prevented,undefined);assert.equal(calls.length,2);
 const outside=event({kind:'other button'});keyboard.keydown(outside);assert.equal(outside.prevented,undefined);
 keyboard.keydown(event());keyboard.cancel();keyboard.keyup(event());assert.equal(calls.length,2);
 keyboard.keydown(event());windows.register({isConnected:true,contains:()=>true},()=>{},2,true,()=>calls.push('different'));keyboard.keyup(event());assert.deepEqual(calls,['apply','apply']);
});

test('pointer selection transfers Enter ownership from the opening field to its active dial',async()=>{
 const {registerWindow}=await import('../src/ui/windowDismissal.ts'),names=['window','document','Node','Element'],saved=Object.fromEntries(names.map(name=>[name,globalThis[name]])),handlers=new Map();let calls=0;
 class Element{
  isConnected=true;tabIndex=0;
  constructor(kind='div',parent,type='text'){this.kind=kind;this.parent=parent;this.type=type;}
  contains(node){for(let current=node;current;current=current.parent)if(current===this)return true;return false;}
  closest(){return this.kind==='input'&&!['button','submit','reset'].includes(this.type)?this:null;}
  hasAttribute(){return false;}
  focus(){globalThis.document.activeElement=this;send('focusin',this);}
 }
 const send=(type,target,extra={})=>{const event={type,target,key:'Enter',ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};for(const fn of handlers.get(type)??[]){fn(event);if(event.stopped)break;}return event;};
 const opening=new Element('input'),dial=new Element(),dot=new Element('button',dial),field=new Element('input',dial),box=new Element('input',dial,'button');
 Object.assign(globalThis,{Node:Element,Element,document:{activeElement:opening},window:{addEventListener(type,fn){handlers.set(type,[...(handlers.get(type)??[]),fn]);}}});
 let dispose,replacement;
 try{
  dispose=registerWindow(dial,()=>{},1,true,()=>calls++);
  send('pointerdown',dot);assert.equal(document.activeElement,dial,'a prevented dot press must not leave Enter in its opening input');send('keydown',document.activeElement);send('keyup',document.activeElement);assert.equal(calls,1);
  document.activeElement=field;send('pointerdown',dot);assert.equal(document.activeElement,dial,'choosing a dot also leaves a typed field inside the dial');send('keydown',dial);send('keyup',dial);assert.equal(calls,2);
  send('pointerdown',field);document.activeElement=field;send('focusin',field);send('keydown',field);send('keyup',field);assert.equal(calls,2,'text entry keeps native Enter');
  document.activeElement=box;send('keydown',box);send('keyup',box);assert.equal(calls,3,'a numeric button is a control, not a text-entry field');
  document.activeElement=opening;send('keydown',opening);send('keyup',opening);assert.equal(calls,3);
  dispose();document.activeElement=new Element('body');const next=new Element();replacement=registerWindow(next,()=>{},1,true,()=>calls++);
  assert.equal(document.activeElement,next,'a replacement dial stage receives keyboard ownership without another pointer click');send('keydown',document.activeElement);send('keyup',document.activeElement);assert.equal(calls,4);
 }finally{replacement?.();dispose?.();for(const [name,value]of Object.entries(saved))if(value===undefined)delete globalThis[name];else globalThis[name]=value;}
});
