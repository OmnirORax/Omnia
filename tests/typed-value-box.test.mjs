import test from 'node:test';
import assert from 'node:assert/strict';
import {bindOperationValueControl} from '../src/ui/operationValueControl.ts';
import {installValueDrag} from '../src/ui/valueDrag.ts';
import {createOperationNumber} from '../src/ui/operationNumber.ts';

function environment(){
 const names=['window','document','Element','Node','HTMLInputElement'],saved=Object.fromEntries(names.map(name=>[name,globalThis[name]])),handlers=new Map(),doc=new EventTarget();
 doc.pointerLockElement=null;doc.hidden=false;doc.documentElement={classList:{add(){},remove(){}}};doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'));};
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
 doc.body=new Element();doc.createElement=()=>new Element();Object.assign(globalThis,{Element,Node:Element,HTMLInputElement:Input,document:doc,window:{addEventListener(type,fn){handlers.set(type,[...(handlers.get(type)??[]),fn]);},removeEventListener(){}}});installValueDrag();
 const input=new Input(),send=(type,extra={})=>{const event={type,target:input,button:0,buttons:0,pointerType:'mouse',pointerId:1,clientX:0,clientY:0,movementX:0,movementY:0,detail:1,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};for(const fn of handlers.get(type)??[]){fn(event);if(event.stopped)break;}return event;};
 return {doc,input,send,type:text=>{for(const key of text)send('keydown',{key});},restore(){send('keydown',{key:'Escape'});for(const [name,value]of Object.entries(saved))if(value===undefined)delete globalThis[name];else globalThis[name]=value;}};
}
test('clicked value boxes preview typed numbers, ignore movement while typing and apply only on acceptance',()=>{
 const f=environment(),writes=[],previews=[],errors=[];let value=12,dispose;
 try{
  dispose=bindOperationValueControl(f.input,{label:'Size',min:6,max:72,integer:true,step:1,read:()=>value,preview:n=>previews.push(n),commit:n=>{value=n;writes.push(n);},feedback:error=>errors.push(error),loadDial:async()=>assert.fail('typing must not open a dial')});
  f.send('pointerdown');f.send('pointerup');f.send('mousemove',{movementY:-12});assert.equal(previews.at(-1),14);
  f.type('18');assert.equal(f.input.value,'18');assert.equal(previews.at(-1),18);assert.equal(value,12);assert.deepEqual(errors,[]);
  f.send('mousemove',{movementY:-600});assert.equal(previews.at(-1),18);f.send('keydown',{key:'Enter'});assert.deepEqual(writes,[18]);assert.equal(f.doc.pointerLockElement,null);
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
  f.send('mousemove',{movementY:-6});assert.equal(previews.at(-1),19);f.send('keydown',{key:'Enter'});assert.equal(value,19);
 }finally{dispose?.();f.restore();}
});
