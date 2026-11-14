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
 class FakeElement {isConnected=true;dataset={};capture=false;closest(){return this;}hasPointerCapture(){return this.capture;}setPointerCapture(){this.capture=true;}releasePointerCapture(){this.capture=false;}}
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
  const send=(type,x=0,extra={})=>{const event={target:input,button:0,buttons:1,pointerType:'mouse',pointerId:1,clientX:x,detail:1,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};for(const fn of handlers.get(type)??[]){fn(event);if(event.stopped)break;}return event;};
  send('pointerdown',10);send('pointermove',12);assert.equal(input.value,'50');assert.equal(send('pointerup',12).prevented,undefined);assert.equal(changes.length,0);
  send('pointerdown',10);send('pointermove',30);assert.equal(input.value,'60');assert.equal(classes.has('value-dragging'),true);
  send('pointermove',-10);assert.equal(input.value,'40');send('pointerup',-10);assert.equal(input.blurred,true);assert.deepEqual(changes,['40']);assert.equal(classes.size,0);
  assert.equal(send('click').prevented,true);assert.equal(send('click').prevented,undefined);
  send('pointerdown',0);send('pointermove',40);assert.equal(input.value,'60');assert.equal(send('keydown',0,{key:'Escape'}).prevented,true);assert.equal(input.value,'40');assert.equal(input.capture,false);
  send('pointerdown',0);send('pointermove',-20);assert.equal(input.value,'30');send('pointercancel');assert.equal(input.value,'40');
  input.dataset.valuePixelsPerStep='1';input.max='255';input.value='128';
  send('pointerdown',100);send('pointermove',101);assert.equal(input.value,'129');send('pointermove',102);assert.equal(input.value,'130');send('pointerup',102);delete input.dataset.valuePixelsPerStep;
  input.readOnly=true;send('pointerdown',0);send('pointermove',50);send('pointerup',50);assert.equal(input.value,'130');
  const readout=new FakeElement(),values=[],commits=[],stop=registerValueDrag(readout,{read:()=>({value:10,min:0,max:20,step:1}),input:value=>values.push(value),commit:value=>commits.push(value),cancel:value=>values.push(value)});
  send('pointerdown',0,{target:readout});send('pointermove',50,{target:readout});send('pointerup',50,{target:readout});assert.deepEqual(values,[15]);assert.deepEqual(commits,[15]);stop();
 }finally{for(const [key,value]of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('slider readout grabs preserve the initial value and use a fixed left/right axis',()=>{
 const scrub=createValueScrub({origin:{x:100,y:100},width:200,value:50,min:0,max:100,step:1,horizontal:true});
 assert.equal(scrub.sample({x:100,y:100}),50);assert.equal(scrub.sample({x:80,y:150}),40);assert.equal(scrub.sample({x:120,y:50}),60);
});
