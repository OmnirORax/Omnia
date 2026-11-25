import test from 'node:test';
import assert from 'node:assert/strict';
import {bindOperationValueControl} from '../src/ui/operationValueControl.ts';
import {installValueDrag,registerValueDrag} from '../src/ui/valueDrag.ts';
import {createOperationNumber} from '../src/ui/operationNumber.ts';
import {installPointerBindings,POINTER_BINDINGS} from '../src/ui/pointerBindings.ts';
import {shortcuts} from '../src/ui/shortcuts.ts';

function environment(routing=false){
 const names=['window','document','Element','Node','HTMLInputElement'],saved=Object.fromEntries(names.map(name=>[name,globalThis[name]])),handlers=new Map(),doc=new EventTarget();
 const classes=new Set();doc.pointerLockElement=null;doc.hidden=false;doc.documentElement={classList:{add:key=>classes.add(key),remove:key=>classes.delete(key),contains:key=>classes.has(key)}};doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'));};
 class Element{
  isConnected=true;dataset={};style={};children=[];ownerDocument=doc;
  closest(selector){return selector==='[data-value-drag]'&&this.dataset.valueDrag!==undefined?this:null;}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}append(node){this.children.push(node);node.parent=this;}remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
  focus(){doc.activeElement=this;}getBoundingClientRect(){return {left:0,top:0,width:80,height:24};}hasPointerCapture(){return false;}
  requestPointerLock(){doc.pointerLockElement=this;doc.dispatchEvent(new Event('pointerlockchange'));}
 }
 class Input extends Element{
  type='button';inputMode='';disabled=false;readOnly=false;min='';max='';step='any';text='12';validationMessage='';
  get value(){return this.text;}set value(value){this.text=String(value);}
  dispatchEvent(event){this.events??=[];this.events.push(event.type);return true;}
  setCustomValidity(message){this.validationMessage=message;}reportValidity(){return !this.validationMessage;}blur(){}
 }
 doc.body=new Element();doc.createElement=()=>new Element();Object.assign(globalThis,{Element,Node:Element,HTMLInputElement:Input,document:doc,window:{addEventListener(type,fn){handlers.set(type,[...(handlers.get(type)??[]),fn]);},removeEventListener(){}}});if(routing)installPointerBindings(()=> 'world');installValueDrag();
 const input=new Input(),send=(type,extra={})=>{const event={type,target:input,button:0,buttons:0,pointerType:'mouse',pointerId:1,clientX:0,clientY:0,movementX:0,movementY:0,detail:1,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};for(const fn of handlers.get(type)??[]){fn(event);if(event.stopped)break;}if(type==='keydown'&&extra.key==='Enter'&&!extra.repeat)send('keyup',{key:'Enter'});return event;};
 return {doc,input,send,type:text=>{for(const key of text)send('keydown',{key});},restore(){send('keydown',{key:'Escape'});for(const [name,value]of Object.entries(saved))if(value===undefined)delete globalThis[name];else globalThis[name]=value;}};
}
test('clicked value boxes preview typed numbers, ignore movement while typing and apply only on acceptance',()=>{
 const f=environment(),writes=[],previews=[],errors=[];let value=12,dispose;
 try{
  dispose=bindOperationValueControl(f.input,{label:'Size',min:6,max:72,integer:true,step:1,read:()=>value,preview:n=>previews.push(n),commit:n=>{value=n;writes.push(n);},feedback:error=>errors.push(error),loadDial:async()=>assert.fail('typing must not open a dial')});
  f.send('pointerdown');f.send('pointerup');f.send('mousemove',{movementY:-600});assert.equal(previews.at(-1),undefined,'vertical motion does not adjust a value box');f.send('mousemove',{movementX:12});assert.equal(previews.at(-1),14);
  f.type('18');assert.equal(f.input.value,'18');assert.equal(previews.at(-1),18);assert.equal(value,12);assert.deepEqual(errors,[]);
  f.send('mousemove',{movementX:600});assert.equal(previews.at(-1),18);f.send('keydown',{key:'Enter'});assert.deepEqual(writes,[18]);assert.equal(f.doc.pointerLockElement,null);
  f.send('pointerdown');f.type('25');f.send('pointerdown');assert.deepEqual(writes,[18,25]);
  f.send('pointerdown');f.type('30');f.send('keydown',{key:'Escape'});assert.equal(value,25);assert.equal(f.input.value,'25');assert.equal(previews.at(-1),undefined);
 }finally{dispose?.();f.restore();}
});
test('invalid or fractional integer text stays editable; backspace and Delete can correct it',()=>{
 const f=environment(),errors=[];let value=12,dispose;
 try{
  dispose=bindOperationValueControl(f.input,{label:'Size',min:6,max:72,integer:true,step:1,read:()=>value,preview(){},commit:n=>value=n,feedback:error=>errors.push(error),loadDial:async()=>assert.fail('no dial')});
  f.send('pointerdown');f.type('99');f.send('keydown',{key:'Enter'});assert.equal(value,12);assert.equal(f.doc.pointerLockElement,f.input);assert.match(errors.at(-1),/Maximum/);
  f.send('keydown',{key:'Backspace'});f.send('keydown',{key:'Enter'});assert.equal(value,9);
  f.send('pointerdown');f.type('6.5');f.send('keydown',{key:'Enter'});assert.equal(value,9);assert.match(errors.at(-1),/whole number/);
  f.send('keydown',{key:'Delete'});f.type('8');f.send('pointerdown');assert.equal(value,8);
  f.send('pointerdown');f.type('-');f.send('keydown',{key:'Enter'});assert.equal(value,8);assert.match(errors.at(-1),/finite/);
 }finally{dispose?.();f.restore();}
});
test('ordinary numeric inputs share signed decimal and scientific typing with cancellation',()=>{
 const f=environment();f.input.type='number';f.input.min='-10';f.input.max='10';f.input.value='2';
 try{
  f.send('pointerdown');f.type('-.75');assert.equal(f.input.value,'-.75');f.send('mousemove',{movementX:200});assert.equal(f.input.value,'-.75');f.send('keydown',{key:'Enter'});assert.equal(f.input.value,'-0.75');assert.equal(f.input.events.at(-1),'change');
  f.send('pointerdown');f.type('1e-1');f.send('pointerdown');assert.equal(f.input.value,'0.1');
  f.send('pointerdown');f.type('99');f.send('keydown',{key:'Enter'});assert.match(f.input.validationMessage,/Maximum/);f.send('keydown',{key:'Escape'});assert.equal(f.input.value,'0.1');assert.equal(f.input.validationMessage,'');
 }finally{f.restore();}
});
test('typing addresses the numeric owner directly and replaces a prior arithmetic count with an absolute value',()=>{
 const applied=[],number=createOperationNumber({label:'Size',value:6,min:0,max:72,integer:false,initialConfiguration:{mode:'halving',base:1,anchor:12,count:1,value:6},apply:(n,phase)=>applied.push([n,phase]),reject:message=>assert.fail(message)});
 assert.equal(number.type('18.25'),true);assert.equal(number.current,18.25);assert.equal(number.value,6);assert.equal(number.currentConfiguration.mode,'value');assert.equal(number.type('1e'),false);assert.equal(number.current,18.25);
 number.commit(number.current,number.currentConfiguration);assert.equal(number.value,18.25);assert.equal(number.scrub().toValue(number.scrub().value),18.25);
});
test('typed values hand off through Shift configuration and resume sliding without an authored edit or jump',async()=>{
 const f=environment(),previews=[];let value=12,number,dispose;
 try{
  dispose=bindOperationValueControl(f.input,{label:'Size',min:6,max:72,integer:true,step:1,read:()=>value,preview:n=>previews.push(n),commit:n=>value=n,feedback:error=>assert.fail(error),loadDial:async()=>({mountOperationMathDial(_host,parameter){number=parameter;return()=>parameter.restore();}})});
  f.send('pointerdown');f.send('pointerup');f.type('18');f.send('keydown',{key:'Shift'});await Promise.resolve();assert.equal(number.value,18);assert.equal(value,12);assert.equal(f.doc.pointerLockElement,null);
  f.send('keydown',{key:'Shift'});assert.equal(f.doc.pointerLockElement,f.input);assert.equal(previews.at(-1),18);
  f.send('mousemove',{movementX:6});assert.equal(previews.at(-1),19);f.send('keydown',{key:'Enter'});assert.equal(value,19);
 }finally{dispose?.();f.restore();}
});
test('slide confirmation is accepted outside the box before world activation bindings can reject it',()=>{
 const saved=shortcuts.getSnapshot(),f=environment(true);let value=12,dispose;
 try{
  shortcuts.initialize({getItem:()=>null,setItem(){}});shortcuts.assign(POINTER_BINDINGS.find(item=>item.id==='gesture:move'),'',POINTER_BINDINGS);
  dispose=bindOperationValueControl(f.input,{label:'Size',min:6,max:72,integer:true,step:1,read:()=>value,preview(){},commit:n=>value=n,feedback:error=>assert.fail(error),loadDial:async()=>assert.fail('no dial')});
  f.send('pointerdown');f.send('pointerup');f.send('mousemove',{movementX:12});
  const outside=new Element();outside.closest=selector=>selector==='#world,.cm-content'?outside:null;
  const click=f.send('pointerdown',{target:outside,clientX:5000,clientY:-1000});assert.equal(click.prevented,true);assert.equal(value,14);assert.equal(f.doc.pointerLockElement,null);
 }finally{dispose?.();f.restore();shortcuts.restore(saved);}
});
test('sliding ignores unlocked cursor drift while waiting for the browser lock',async()=>{
 const f=environment(),previews=[];let grant,value=12,dispose;
 try{
  f.input.requestPointerLock=()=>new Promise(resolve=>{grant=()=>{f.doc.pointerLockElement=f.input;f.doc.dispatchEvent(new Event('pointerlockchange'));resolve();};});
  dispose=bindOperationValueControl(f.input,{label:'Size',min:6,max:72,integer:true,step:1,read:()=>value,preview:n=>previews.push(n),commit:n=>value=n,feedback:error=>assert.fail(error),loadDial:async()=>assert.fail('no dial')});
  f.send('pointerdown');f.send('pointermove',{clientX:5000,clientY:2000,movementX:1000});assert.equal(previews.at(-1),undefined);
  grant();await Promise.resolve();f.send('pointerup');f.send('mousemove',{clientX:5000,clientY:2000,movementX:6,movementY:1000});assert.equal(previews.at(-1),13,'only relative horizontal movement contributes after lock');
  f.send('pointerdown');assert.equal(value,13);assert.equal(f.doc.pointerLockElement,null);
 }finally{dispose?.();f.restore();}
});

test('native slide acceptance commits the owned sample even if the field was resynchronized',()=>{
 const f=environment();f.input.type='number';f.input.min='0';f.input.max='100';f.input.step='1';
 try{
  for(const accept of [()=>f.send('pointerdown'),()=>f.send('keydown',{key:'Enter'})]){
   f.input.value='12';f.send('pointerdown');f.send('pointerup');f.send('mousemove',{movementX:12});assert.equal(f.input.value,'18');
   f.input.value='12';accept();assert.equal(f.input.value,'18');assert.equal(f.input.events.at(-1),'change');assert.equal(f.doc.pointerLockElement,null);
  }
 }finally{f.restore();}
});
test('acceptance cannot restore the candidate through configuration teardown',()=>{
 const f=environment();let value=12,committed,dispose;
 try{
  dispose=registerValueDrag(f.input,{read:()=>({value,step:1,pixelsPerStep:6}),input:n=>value=n,commit:()=>committed=value,cancel:n=>value=n,configure:{open(){},close(){value=12;}}});
  f.send('pointerdown');f.send('pointerup');f.send('mousemove',{movementX:12});assert.equal(value,14);f.send('keydown',{key:'Enter'});assert.equal(committed,14);
 }finally{dispose?.();f.restore();}
});

test('the numeric session owns the whole Enter press before general context handlers',()=>{
 const f=environment();let value=12,dispose;const leaked=[];
 try{
  window.addEventListener('keydown',e=>{if(e.key==='Enter')leaked.push(e.type);});window.addEventListener('keyup',e=>{if(e.key==='Enter')leaked.push(e.type);});
  dispose=bindOperationValueControl(f.input,{label:'Size',min:0,max:100,step:1,read:()=>value,preview(){},commit:n=>value=n,feedback:message=>assert.fail(message),loadDial:async()=>assert.fail('no dial')});
  f.send('pointerdown');f.send('pointerup');f.send('mousemove',{movementX:12});f.send('keydown',{key:'Enter'});assert.equal(value,14);assert.deepEqual(leaked,[]);
 }finally{dispose?.();f.restore();}
});

test('a registered numeric field keeps its declared parameter owner',()=>{
 const f=environment();f.input.type='number';let committed,dispose;
 try{
  dispose=registerValueDrag(f.input,{read:()=>({value:12,step:1,pixelsPerStep:6}),input(){},commit:n=>committed=n,cancel(){}});
  f.send('pointerdown');f.send('pointerup');f.send('mousemove',{movementX:12});f.send('pointerdown');assert.equal(committed,14);
 }finally{dispose?.();f.restore();}
});

test('movement past native bounds is discarded so reversing responds at either limit',()=>{
 const f=environment();f.input.type='number';f.input.value='50';f.input.min='0';f.input.max='100';f.input.step='1';
 try{
  f.send('pointerdown');f.send('pointerup');f.send('mousemove',{movementX:10000});assert.equal(f.input.value,'100');
  f.send('mousemove',{movementX:10000});f.send('mousemove',{movementX:-2});assert.equal(f.input.value,'99','no hidden overshoot above max');
  f.send('mousemove',{movementX:-10000});assert.equal(f.input.value,'0');f.send('mousemove',{movementX:-10000});
  f.send('mousemove',{movementX:2});assert.equal(f.input.value,'1','no hidden overshoot below min');f.send('keydown',{key:'Enter'});assert.equal(f.input.value,'1');
 }finally{f.restore();}
});
test('bounded sliding retains fractional reverse movement and the original sensitivity',()=>{
 const f=environment();let value=50,dispose;
 try{
  dispose=registerValueDrag(f.input,{read:()=>({value:50,min:0,max:100,step:1,pixelsPerStep:6}),input:n=>value=n,commit:n=>value=n,cancel:n=>value=n});
  f.send('pointerdown');f.send('pointerup');f.send('mousemove',{movementX:10000});assert.equal(value,100);f.send('mousemove',{movementX:10000});
  for(let i=0;i<6;i++)f.send('mousemove',{movementX:-1});assert.equal(value,99,'small reverse events accumulate instead of being discarded at max');
  f.send('mousemove',{movementX:-10000});assert.equal(value,0);for(let i=0;i<6;i++)f.send('mousemove',{movementX:1});assert.equal(value,1);
  f.send('keydown',{key:'Escape'});assert.equal(value,50);
 }finally{dispose?.();f.restore();}
});

test('limit reversal preserves fractional steps, diagonal handles and one-sided sensitivity',()=>{
 const f=environment();let dispose;
 try{
  for(const {config,outward,reverse,expected} of [
   {config:{value:1,min:0,max:2,step:.25,pixelsPerStep:6},outward:{movementX:10000},reverse:{movementX:-6},expected:1.75},
   {config:{value:1,min:0,max:2,step:.25,pixelsPerStep:6,axis:{x:1,y:1}},outward:{movementX:10000,movementY:10000},reverse:{movementX:-6,movementY:-6},expected:1.75},
   {config:{value:-500,min:-1000},outward:{movementX:-10000},reverse:{movementX:1},expected:-995},
  ]){
   let value=config.value;dispose=registerValueDrag(f.input,{read:()=>config,input:n=>value=n,commit:n=>value=n,cancel:n=>value=n});
   f.send('pointerdown');f.send('pointerup');f.send('mousemove',outward);f.send('mousemove',outward);f.send('mousemove',reverse);assert.equal(value,expected);f.send('pointerdown');assert.equal(value,expected);dispose();dispose=undefined;
  }
 }finally{dispose?.();f.restore();}
});

test('arrow keys step the active parameter and hand back to mouse movement without a jump',()=>{
 const f=environment(),writes=[],previews=[];let value=12,dispose;
 try{
  dispose=bindOperationValueControl(f.input,{label:'Size',min:6,max:72,integer:true,step:1,read:()=>value,preview:n=>previews.push(n),commit:n=>{value=n;writes.push(n);},feedback:message=>assert.fail(message),loadDial:async()=>assert.fail('no dial')});
  assert.equal(f.send('keydown',{key:'ArrowRight'}).prevented,undefined,'inactive arrows remain available to their context');
  f.send('pointerdown');f.send('pointerup');assert.equal(f.send('keydown',{key:'ArrowRight'}).prevented,true);assert.equal(previews.at(-1),13);f.send('keydown',{key:'ArrowLeft'});assert.equal(previews.at(-1),12);assert.deepEqual(writes,[]);
  f.send('mousemove',{movementX:12});assert.equal(previews.at(-1),14);f.send('keydown',{key:'ArrowRight'});assert.equal(previews.at(-1),15);f.send('mousemove',{movementY:100});assert.equal(previews.at(-1),15);f.send('mousemove',{movementX:-6});assert.equal(previews.at(-1),14);f.send('keydown',{key:'Enter'});assert.deepEqual(writes,[14]);
 }finally{dispose?.();f.restore();}
});
test('arrow stepping respects fractional increments, limits, typing and cancellation',()=>{
 const f=environment();f.input.type='number';f.input.value='.3';f.input.min='0';f.input.max='1';f.input.step='.05';
 try{
  f.send('pointerdown');f.send('pointerup');f.send('keydown',{key:'ArrowRight'});assert.equal(f.input.value,'0.35');f.send('keydown',{key:'ArrowLeft'});assert.equal(f.input.value,'0.3');
  f.send('mousemove',{movementX:10000});f.send('keydown',{key:'ArrowRight',repeat:true});assert.equal(f.input.value,'1');f.send('keydown',{key:'ArrowLeft'});assert.equal(f.input.value,'0.95');f.send('mousemove',{movementX:0});assert.equal(f.input.value,'0.95');
  f.type('.5');f.send('keydown',{key:'ArrowRight'});assert.equal(f.input.value,'0.55');f.send('keydown',{key:'Escape'});assert.equal(f.input.value,'0.3');
  f.input.step='any';f.input.max='100';f.input.value='12.25';f.send('pointerdown');f.send('pointerup');f.send('keydown',{key:'ArrowRight'});assert.equal(f.input.value,'13.25');f.send('keydown',{key:'ArrowLeft',ctrlKey:true});assert.equal(f.input.value,'13.25');f.send('keydown',{key:'Enter'});assert.equal(f.input.value,'13.25');
 }finally{f.restore();}
});
test('arrow steps inherit the configured numeral base and arithmetic',async()=>{
 const f=environment();let dispose;
 try{
  for(const config of [{mode:'value',base:2,anchor:10,count:0,value:10},{mode:'halving',base:1,anchor:24,count:1,value:12}]){
   let value=config.value;dispose=bindOperationValueControl(f.input,{label:'Value',min:0,max:100,integer:true,step:1,read:()=>value,preview(){},commit:n=>value=n,feedback:message=>assert.fail(message),loadDial:async()=>({mountOperationMathDial(_host,number){number.commit(config.value,config);return()=>number.restore();}})});
   f.send('pointerdown');f.send('pointerup');f.send('keydown',{key:'Shift'});await Promise.resolve();f.send('keydown',{key:'Shift'});f.send('keydown',{key:'ArrowRight'});assert.equal(f.input.value,config.mode==='value'?'12':'6');f.send('keydown',{key:'ArrowLeft'});assert.equal(f.input.value,String(config.value));f.send('keydown',{key:'Enter'});assert.equal(value,config.value);dispose();dispose=undefined;
  }
 }finally{dispose?.();f.restore();}
});
