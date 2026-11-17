import test from 'node:test';import assert from 'node:assert/strict';
import {createOperationNumber} from '../src/ui/operationNumber.ts';
import {createOperationDial} from '../src/ui/operationDial.ts';
import {formatMathConfiguration} from '../src/ui/cursorReadout.ts';
import {selectionLatch} from '../src/ui/selectionLatch.ts';
test('one parameter owner separates accepted configuration from previews and restores the last accepted step',()=>{const applied=[],errors=[],number=createOperationNumber({label:'Step',value:1,min:0,max:4,apply:n=>applied.push(n),reject:m=>errors.push(m)});number.preview(.25);assert.equal(number.value,1);assert.equal(number.current,.25);number.restore();assert.equal(number.current,1);number.commit(.5,{mode:'halving',anchor:1,count:1,value:.5});number.preview(.125);assert.equal(number.value,.5);assert.equal(number.configuration.value,.5);number.restore();assert.equal(applied.at(-1),.5);assert.equal(number.commit(5),false);assert.equal(number.value,.5);assert.match(errors.at(-1),/Maximum/);});
test('confirmed cursor text contains the actual half/double calculation rather than a preview',()=>{assert.equal(formatMathConfiguration({mode:'halving',anchor:1,count:3,value:.125}),'1/2^3 = 0.125');assert.equal(formatMathConfiguration({mode:'doubling',anchor:1,count:2,value:4}),'1×2^2 = 4');assert.equal(formatMathConfiguration({mode:'value',anchor:3,count:0,value:3}),'3');});
test('Shift works only after activation, does not latch selection, and closing during a lazy open cannot mount stale UI',async()=>{let active=false,mounted=0,disposed=0;const number=createOperationNumber({label:'Step',value:1,min:0,max:4,apply(){},reject(){}}),host={hidden:true},dial=createOperationDial({host,active:()=>active,number:()=>number,feedback(){},mount:()=>{mounted++;return()=>disposed++;}}),key=()=>({key:'Shift',repeat:false,ctrlKey:false,metaKey:false,altKey:false,preventDefault(){},stopImmediatePropagation(){}});assert.equal(dial.key(key()),false);active=true;selectionLatch.press('Shift');assert.equal(dial.key(key()),true);selectionLatch.release('Shift');assert.equal(selectionLatch.shift,false);dial.close();await Promise.resolve();assert.equal(mounted,0);dial.open();await Promise.resolve();assert.equal(mounted,1);dial.close();assert.equal(disposed,1);assert.equal(host.hidden,true);selectionLatch.clear();});

test('working limits constrain commits, end previews, clamp accepted values and preserve hard bounds',()=>{
 const applied=[],errors=[],number=createOperationNumber({label:'Step',value:4,min:0,max:10,integer:true,apply:n=>applied.push(n),reject:r=>errors.push(r)});
 number.preview(8);assert.equal(number.setLimit('max',6),true);assert.equal(number.current,4);assert.equal(applied.at(-1),4);
 assert.equal(number.commit(7),false);assert.equal(number.setLimit('min',5),true);assert.equal(number.value,5);assert.equal(number.configuration.value,5);
 for(const [kind,n] of [['min',7],['max',11],['min',4.5],['max',NaN]])assert.equal(number.setLimit(kind,n),false);
 assert.equal(number.min,5);assert.equal(number.max,6);assert.equal(errors.length,5);
 number.resetLimits();assert.equal(number.min,0);assert.equal(number.max,10);assert.equal(number.commit(9),true);
});

test('parameter formatting resolves the current mode without replacing accepted values with previews',()=>{
 let base=90;const number=createOperationNumber({label:'Snap multiplier',value:1,min:0,max:4,formatValue:n=>`${n} × ${base}° = ${n*base}°`,apply(){},reject(){}});
 assert.equal(number.formatValue(number.value),'1 × 90° = 90°');number.preview(.5);
 assert.equal(number.formatValue(number.value),'1 × 90° = 90°');assert.equal(number.formatValue(number.current),'0.5 × 90° = 45°');
 number.restore();base=60;assert.equal(number.formatValue(number.value),'1 × 60° = 60°');
 const raw=createOperationNumber({label:'Count',value:8,min:1,max:100,apply(){},reject(){}});assert.equal(raw.formatValue(raw.value),'8');
});

test('cursor configuration distinguishes grid steps from halvings and reciprocals',()=>{
 assert.equal(formatMathConfiguration({mode:'value',anchor:.75,count:2,value:.75,equilibrium:.5,snap:.125}),'0.5 + 2×0.125 = 0.75');
 assert.equal(formatMathConfiguration({mode:'division',anchor:1,count:5,value:.2}),'1/5 = 0.2');
});

test('Shift keeps an open operation dial available for Shift-click Snap fields',async()=>{
 let mounts=0;
 const number=createOperationNumber({label:'Step',value:1,min:0,max:4,apply(){},reject(){}}),dial=createOperationDial({host:{hidden:true},active:()=>true,number:()=>number,feedback(){},mount:()=>{mounts++;return()=>{};}}),event=()=>({key:'Shift',repeat:false,ctrlKey:false,metaKey:false,altKey:false,preventDefault(){},stopImmediatePropagation(){}});
 dial.key(event());await Promise.resolve();dial.key(event());assert.equal(dial.active,true);assert.equal(mounts,1);dial.close();
});
