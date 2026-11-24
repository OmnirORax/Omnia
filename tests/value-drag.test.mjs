import test from 'node:test';
import assert from 'node:assert/strict';
import {createValueScrub} from '../src/composer/runtime/ui/valueScrub.ts';
import {horizontalValue,installValueDrag,registerValueDrag} from '../src/ui/valueDrag.ts';

test('horizontal numeric dragging decreases left and increases right without changing on grab',()=>{
 const config={value:50,min:0,max:100,step:1};
 assert.equal(horizontalValue(config,0),50);assert.equal(horizontalValue(config,-20),40);assert.equal(horizontalValue(config,20),60);
 assert.equal(horizontalValue(config,-10000),0);assert.equal(horizontalValue(config,10000),100);
 assert.equal(horizontalValue(config,NaN),50);
});
test('numeric dragging honors fractional steps and unbounded signed values without decimal drift',()=>{
 const config={value:.3,min:0,max:1,step:.05};assert.equal(horizontalValue(config,20),.4);assert.equal(horizontalValue(config,-20),.2);
 assert.equal(horizontalValue({value:5,step:1},-60),-5);
 assert.equal(horizontalValue({value:0},-25),-.25);
 assert.equal(horizontalValue({value:100,min:5},-10000),5);
});
test('numeric inputs and registered readouts share release, click, and cancellation ownership',()=>{
 const originals=Object.fromEntries(['window','document','HTMLInputElement','Element'].map(key=>[key,globalThis[key]]));
 const handlers=new Map(),classes=new Set(),inputs=[],changes=[];
 class FakeElement {isConnected=true;dataset={};capture=false;closest(selector){return selector==='[data-value-drag]'?this:null;}hasPointerCapture(){return this.capture;}setPointerCapture(){this.capture=true;}releasePointerCapture(){this.capture=false;}}
 class FakeInput extends FakeElement {
  type='number';inputMode='';disabled=false;readOnly=false;min='0';max='100';step='1';text='50';blurred=false;
  get value(){return this.text;}set value(next){this.text=next;}
  dispatchEvent(event){if(event.type==='input')inputs.push(this.value);if(event.type==='change')changes.push(this.value);return true;}
  blur(){this.blurred=true;}
 }
 globalThis.Element=FakeElement;globalThis.HTMLInputElement=FakeInput;
 globalThis.window={addEventListener(type,handler){const list=handlers.get(type)??[];list.push(handler);handlers.set(type,list);}};
 globalThis.document={hidden:false,documentElement:{classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)}},addEventListener:()=>{}};
 try{
  installValueDrag();const input=new FakeInput();
  const send=(type,x=0,extra={})=>{const event={type,target:input,button:0,buttons:1,pointerType:'mouse',pointerId:1,clientX:x,clientY:0,detail:1,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};for(const fn of handlers.get(type)??[]){fn(event);if(event.stopped)break;}return event;};
  send('pointerdown',10);assert.equal(classes.has('value-dragging'),true,'click arms immediately');assert.equal(input.value,'50');assert.equal(send('pointerup',10).prevented,true);assert.equal(changes.length,0);send('keydown',10,{key:'Escape'});changes.length=0;
  send('pointerdown',10);send('pointermove',30);assert.equal(input.value,'60');assert.equal(classes.has('value-dragging'),true);
  send('pointermove',-10);assert.equal(input.value,'40');send('pointerup',-10);assert.equal(input.blurred,false);assert.deepEqual(changes,[]);send('pointermove',-20,{buttons:0});assert.equal(input.value,'35');send('pointerdown',-20);assert.equal(input.blurred,true);assert.deepEqual(changes,['35']);assert.equal(classes.size,0);
  assert.equal(send('click').prevented,true);assert.equal(send('click').prevented,undefined);
  send('pointerdown',0);send('pointermove',40);assert.equal(input.value,'55');assert.equal(send('keydown',0,{key:'Escape'}).prevented,true);assert.equal(input.value,'35');assert.equal(input.capture,false);
  send('pointerdown',0);send('pointermove',-20);assert.equal(input.value,'25');send('pointercancel');assert.equal(input.value,'35');
  input.dataset.valuePixelsPerStep='1';input.max='255';input.value='128';
  send('pointerdown',100);send('pointermove',101);assert.equal(input.value,'129');send('pointermove',102);assert.equal(input.value,'130');send('pointerup',102);send('pointerdown',102);delete input.dataset.valuePixelsPerStep;
  input.type='range';send('pointerdown',0);assert.equal(classes.has('value-dragging'),true);send('pointerup',0);send('pointermove',2,{target:new FakeElement(),buttons:0});assert.equal(input.value,'133');send('keydown',2,{key:'Escape'});assert.equal(input.value,'130');input.type='number';
  input.readOnly=true;send('pointerdown',0);send('pointermove',50);send('pointerup',50);assert.equal(input.value,'130');
  const readout=new FakeElement(),values=[],commits=[],stop=registerValueDrag(readout,{read:()=>({value:10,min:0,max:20,step:1}),input:value=>values.push(value),commit:value=>commits.push(value),cancel:value=>values.push(value)});
  send('pointerdown',0,{target:readout});send('pointermove',50,{target:readout});send('pointerup',50,{target:readout});assert.deepEqual(commits,[]);send('pointerdown',50,{target:readout});assert.deepEqual(values,[15]);assert.deepEqual(commits,[15]);stop();
  const launcher=new FakeElement(),releaseLauncher=registerValueDrag(launcher,{read:()=>({value:10,min:0,max:20,step:1,activation:'drag'}),input(){},commit(){},cancel(){}});
  send('pointerdown',0,{target:launcher});assert.equal(classes.has('value-dragging'),false);assert.equal(send('pointerup',0,{target:launcher}).prevented,undefined);assert.equal(send('click',0,{target:launcher}).prevented,undefined,'a launcher click can still open its state field');releaseLauncher();
 }finally{for(const [key,value]of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('slider readout grabs preserve the initial value and use a fixed left/right axis',()=>{
 const scrub=createValueScrub({origin:{x:100,y:100},width:200,value:50,min:0,max:100,step:1,horizontal:true});
 assert.equal(scrub.sample({x:100,y:100}),50);assert.equal(scrub.sample({x:80,y:150}),40);assert.equal(scrub.sample({x:120,y:50}),60);
});

test('diagonal size handles inherit scalar dragging while preserving horizontal defaults',async()=>{
 const {valueDragDistance}=await import('../src/ui/valueDrag.ts');
 assert.equal(valueDragDistance({value:1},10,30),10);assert.ok(Math.abs(valueDragDistance({value:1,axis:{x:1,y:1}},10,10)-Math.sqrt(200))<1e-9);
 assert.ok(valueDragDistance({value:1,axis:{x:1,y:1}},-10,-10)<0);assert.equal(valueDragDistance({value:1,axis:{x:1,y:1}},10,-10),0);
});

test('locked mouse movement keeps editing after release and accepts with a later click',()=>{
 const keys=['window','document','HTMLInputElement','Element'],originals=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
 const handlers=new Map(),doc=new EventTarget(),classes=new Set(),commits=[],values=[];
 doc.pointerLockElement=null;doc.hidden=false;doc.documentElement={classList:{add:key=>classes.add(key),remove:key=>classes.delete(key)}};
 doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'));};
 class ElementStub {isConnected=true;dataset={};capture=false;ownerDocument=doc;closest(selector){return selector==='[data-value-drag]'?this:null;}hasPointerCapture(){return this.capture;}setPointerCapture(){this.capture=true;}releasePointerCapture(){this.capture=false;}requestPointerLock(){doc.pointerLockElement=this;doc.dispatchEvent(new Event('pointerlockchange'));}}
 globalThis.Element=ElementStub;globalThis.HTMLInputElement=class extends ElementStub{};globalThis.document=doc;
 globalThis.window={addEventListener(type,fn){const list=handlers.get(type)??[];list.push(fn);handlers.set(type,list);},removeEventListener(){}};
 try{
  installValueDrag();const root=new ElementStub();let starts=0;registerValueDrag(root,{start:()=>{starts++;},read:()=>({value:50,min:0,max:100,step:1}),input:value=>values.push(value),commit:value=>commits.push(value),cancel:value=>values.push(value)});
  const send=(type,extra={})=>{const event={type,target:root,button:0,buttons:1,pointerType:'mouse',pointerId:1,clientX:0,clientY:0,movementX:0,movementY:0,detail:1,preventDefault(){},stopImmediatePropagation(){this.stopped=true;},...extra};for(const fn of handlers.get(type)??[]){fn(event);if(event.stopped)break;}};
  send('pointerdown');assert.equal(starts,1,'the center releases its previous hover owner before shared adjustment starts');assert.equal(doc.pointerLockElement,root,'click requests lock without movement');send('mousedown');assert.equal(commits.length,0,'activating compatibility mousedown cannot confirm');send('pointermove',{clientX:0,movementX:20});assert.equal(values.at(-1),60);
  send('pointercancel');assert.equal(doc.pointerLockElement,root);
  send('pointerup',{buttons:0,clientX:20});send('lostpointercapture');assert.equal(commits.length,0);assert.equal(doc.pointerLockElement,root);
  send('pointermove',{target:{},buttons:0,movementX:10,clientX:20,timeStamp:100});assert.equal(values.at(-1),65,'locked pointer-only movement updates values');
  send('mousemove',{buttons:0,movementX:10,clientX:20,timeStamp:100});assert.equal(values.at(-1),65,'matching companion movement is not counted twice');
  send('mousemove',{buttons:0,movementX:-30,clientX:20});assert.equal(values.at(-1),50);
  send('mousedown');assert.deepEqual(commits,[50]);assert.equal(doc.pointerLockElement,null);assert.equal(classes.size,0);
  send('pointerdown');send('pointermove',{clientX:0,movementX:20});send('pointerup',{buttons:0});send('mousemove',{buttons:0,movementX:10});send('keydown',{key:'Escape'});assert.equal(values.at(-1),50);assert.deepEqual(commits,[50]);
 }finally{for(const [key,value]of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('automatic hover previews cannot take over while a numerical value edit owns movement',async()=>{
 const {createHoverPreview}=await import('../src/composer/runtime/ui/hoverPreview.ts');
 let available=true,started=0,cancelled=0;const session=createHoverPreview(()=>available),owner={},value={start:()=>started++,move(){},commit(){},cancel:()=>cancelled++};
 session.enter(owner,value,0);assert.equal(started,1);available=false;session.enter({},value,0);assert.equal(session.active(),false);assert.equal(cancelled,1);assert.equal(started,1);
 available=true;session.enter(owner,value,0);assert.equal(session.active(),true);assert.equal(started,2);session.cancel();
});
