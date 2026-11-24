import test from 'node:test';
import assert from 'node:assert/strict';
import {shortcuts} from '../src/ui/shortcuts.ts';
import {normalizeActivation} from '../src/ui/activationCombo.ts';
import {POINTER_BINDINGS,resolvePointerBinding,installPointerBindings} from '../src/ui/pointerBindings.ts';
test('activation combinations normalize modifiers, held keys and mouse buttons',()=>{
 assert.equal(normalizeActivation('Ctrl + Shift + LC'),'Ctrl+Shift+MB1');assert.equal(normalizeActivation('x + MB3'),'X+MB3');assert.equal(normalizeActivation('Ctrl + RC'),'Ctrl+MB2');assert.equal(normalizeActivation('Ctrl + drag'),undefined);
});
test('reassigning depth selection swaps activation only and survives reload',()=>{
 let saved=null;const storage={getItem:()=>saved,setItem:(_key,value)=>saved=value};shortcuts.initialize(storage);
 try{const depth=POINTER_BINDINGS.find(d=>d.id==='gesture:multi-depth');shortcuts.assign(depth,'Ctrl+MB1',POINTER_BINDINGS);
 assert.equal(resolvePointerBinding('Ctrl+MB1','world').id,depth.id);assert.equal(resolvePointerBinding('Ctrl+MB1','world').combo,'Ctrl+Shift+MB1');assert.equal(resolvePointerBinding('Ctrl+Shift+MB1','world').combo,'Ctrl+MB1');
 shortcuts.initialize(storage);assert.equal(resolvePointerBinding('Ctrl+MB1','world').combo,'Ctrl+Shift+MB1');
 }finally{shortcuts.initialize({getItem:()=>null,setItem(){}});}
});
test('the input boundary preserves selection behavior and release ownership after rebinding',()=>{
 const old={window:globalThis.window,Element:globalThis.Element},handlers=new Map();class Element{closest(selector){return selector==='#world,.cm-content'||selector==='#world'?this:null;}};
 globalThis.Element=Element;globalThis.window={addEventListener:(name,fn)=>{handlers.set(name,fn);}};
 shortcuts.initialize({getItem:()=>null,setItem(){}});
 try{shortcuts.assign(POINTER_BINDINGS.find(d=>d.id==='gesture:multi-depth'),'Ctrl+MB2',POINTER_BINDINGS);installPointerBindings(()=> 'world');
 const down={target:new Element(),pointerId:7,button:2,ctrlKey:true,shiftKey:false,altKey:false,metaKey:false};handlers.get('pointerdown')(down);assert.equal(down.button,0);assert.equal(down.shiftKey,true);assert.equal(down.ctrlKey,true);
 const wheel={target:new Element(),button:0,ctrlKey:true,shiftKey:true,altKey:false,metaKey:false};handlers.get('wheel')(wheel);assert.equal(wheel.ctrlKey,false);assert.equal(wheel.shiftKey,false);
 const up={pointerId:7,button:2,ctrlKey:false,shiftKey:false,altKey:false,metaKey:false};handlers.get('pointerup')(up);assert.equal(up.button,0);assert.equal(up.shiftKey,true);
 }finally{Object.assign(globalThis,old);shortcuts.initialize({getItem:()=>null,setItem(){}});}
});

test('activation capture records held letters with mouse buttons without changing the stored binding',async()=>{
 const {installShortcutCapture,captureShortcut}=await import('../src/ui/shortcuts.ts');
 const old={window:globalThis.window,Element:globalThis.Element},handlers=new Map(),captured=[];
 class Element{closest(){return null;}}
 globalThis.Element=Element;globalThis.window={addEventListener:(name,fn)=>handlers.set(name,fn)};
 try{installShortcutCapture();const stop=captureShortcut(value=>captured.push(value),()=>{},true);
 const event={key:'x',repeat:false,ctrlKey:false,shiftKey:false,altKey:false,metaKey:false,preventDefault(){},stopImmediatePropagation(){}};
 handlers.get('keydown')(event);handlers.get('pointerdown')({...event,target:new Element(),button:1});assert.deepEqual(captured,['X+MB3']);stop();
 }finally{Object.assign(globalThis,old);}
});
test('camera rotation activation is inherited by creation mode after rebinding',()=>{
 shortcuts.initialize({getItem:()=>null,setItem(){}});
 try{
  const rotate=POINTER_BINDINGS.find(item=>item.id==='gesture:camera-rotate');
  shortcuts.assign(rotate,'Alt+MB2',POINTER_BINDINGS);
  for(const context of ['world','create'])assert.deepEqual(resolvePointerBinding('Alt+MB2',context),{id:rotate.id,combo:'Shift+MB2'});
 }finally{shortcuts.initialize({getItem:()=>null,setItem(){}});}
});

test('side buttons are available only to explicit side-command consumers and never alias rotation',async()=>{const {pointerCombo}=await import('../src/ui/activationCombo.ts');for(const [button,key]of [[3,'MB4'],[4,'MB5']])for(const ctrlKey of [true,false]){const event={button,ctrlKey,metaKey:false,altKey:false,shiftKey:false};assert.equal(pointerCombo(event),undefined);assert.equal(pointerCombo(event,[],false,true),`${ctrlKey?'Ctrl+':''}${key}`);}for(const button of [5,-1])assert.equal(pointerCombo({button,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false},[],false,true),undefined);});

test('MB4 and MB5 reach history before world rotation, including compatibility mouse events',async()=>{
 const {installHistoryBindings}=await import('../src/ui/historyBindings.ts');
 const old={window:globalThis.window,Element:globalThis.Element},handlers=new Map();class Element{closest(selector){return selector==='#world,.cm-content'||selector==='#world'?this:null;}}
 globalThis.Element=Element;globalThis.window={addEventListener:(name,fn)=>{const list=handlers.get(name)??[];list.push(fn);handlers.set(name,list);}};let undo=0,redo=0;
 try{installPointerBindings(()=> 'world');installHistoryBindings({undo(){undo++;},redo(){redo++;},configure(){}});
 const emit=(type,button)=>{const event={target:new Element(),pointerId:1,button,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};for(const fn of handlers.get(type)??[]){fn(event);if(event.stopped)break;}assert.equal(event.button,button);};
 for(const button of [3,4]){emit('pointerdown',button);emit('mousedown',button);emit('pointerup',button);emit('mouseup',button);}assert.equal(undo,1);assert.equal(redo,1);
 }finally{Object.assign(globalThis,old);}
});
