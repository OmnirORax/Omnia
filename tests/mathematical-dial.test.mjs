import test from 'node:test';
import assert from 'node:assert/strict';
import {mathematicalScaleValue,mathematicalScaleMaximum,mathematicalValueRejection,mathematicalRingOrders,mathematicalNumberValue} from '../src/properties/mathematicalDial.ts';

test('halving counts repeated divisions of a frozen input and stops before fractional integer results',()=>{const domain={min:1,max:1000,integer:true};assert.equal(mathematicalScaleValue(100,1,'halving'),50);assert.equal(mathematicalScaleValue(100,2,'halving'),25);assert.equal(mathematicalScaleValue(100,3,'halving'),12.5);assert.equal(mathematicalScaleValue(100,6,'halving'),1.5625);assert.equal(mathematicalScaleMaximum(100,'halving',domain),2);assert.equal(mathematicalScaleValue(100,0,'halving'),100);assert.equal(mathematicalScaleMaximum(3,'halving',domain),0);});
test('doubling uses the same frozen anchor and respects the consumer maximum',()=>{assert.equal(mathematicalScaleMaximum(100,'doubling',{min:1,max:1000,integer:true}),3);assert.equal(mathematicalScaleValue(100,3,'doubling'),800);assert.equal(mathematicalScaleValue(100,4,'doubling'),1600);assert.equal(mathematicalScaleMaximum(NaN,'doubling',{min:1,max:1000}),0);assert.ok(Number.isNaN(mathematicalScaleValue(NaN,1,'halving')));assert.ok(Number.isNaN(mathematicalScaleValue(100,-1,'halving')));assert.ok(Number.isNaN(mathematicalScaleValue(100,1.5,'halving')));});
test('fractional snap values can halve beyond eight without a degree-based rule or an eight-step cap',()=>{const maximum=mathematicalScaleMaximum(.25,'halving',{min:0,max:1});assert.ok(maximum>8);assert.equal(mathematicalScaleValue(.25,3,'halving'),.03125);assert.equal(mathematicalScaleValue(.25,9,'halving'),.25/512);assert.ok(mathematicalScaleValue(.25,maximum,'halving')>0);assert.equal(mathematicalScaleValue(.25,maximum+1,'halving'),0);});
test('value rejections distinguish upper/lower limits, integer requirements and non-finite input',()=>{const domain={min:1,max:100,integer:true};assert.equal(mathematicalValueRejection(101,domain),'Maximum value is 100.');assert.equal(mathematicalValueRejection(0,domain),'Minimum value is 1.');assert.match(mathematicalValueRejection(12.5,domain),/whole number/);assert.match(mathematicalValueRejection(NaN,domain),/finite/);assert.equal(mathematicalValueRejection(25,domain),undefined);});
test('accepted outer marks expose a new ring and removing them retracts unused rings',()=>{assert.equal(mathematicalRingOrders([]),1);assert.equal(mathematicalRingOrders(['0:0']),1);assert.equal(mathematicalRingOrders(['0:0','1:2']),2);assert.equal(mathematicalRingOrders(['0:0','1:2','2:3']),3);assert.equal(mathematicalRingOrders(['0:0','1:2']),2);assert.equal(mathematicalRingOrders(['0:0']),1);assert.equal(mathematicalRingOrders(['4:0']),5);assert.equal(mathematicalRingOrders([]),1);});
test('the default value setter retains the existing numeral arithmetic',()=>{assert.equal(mathematicalNumberValue(2,[{key:'0:0',ordinal:1,mode:'normal'},{key:'0:2',ordinal:3,mode:'normal'}]),8);});
test('scaling reports its exponent maximum and rejects negative or fractional exponent input',async()=>{const {mathematicalScaleRejection}=await import('../src/properties/mathematicalDial.ts');const domain={min:1,max:1000,integer:true};assert.match(mathematicalScaleRejection(100,3,'halving',domain),/Maximum halves is 2/);assert.match(mathematicalScaleRejection(100,-1,'halving',domain),/non-negative whole/);assert.match(mathematicalScaleRejection(100,1.5,'doubling',domain),/non-negative whole/);assert.equal(mathematicalScaleRejection(100,2,'halving',domain),undefined);});

test('editable limits reject reversed, nonfinite, fractional and out-of-domain ranges',async()=>{
 const {mathematicalLimitsRejection:reject}=await import('../src/properties/mathematicalDial.ts'),domain={min:0,max:100,integer:true};
 assert.equal(reject(10,80,domain),undefined);assert.match(reject(80,10,domain),/Minimum cannot exceed maximum/);
 assert.match(reject(NaN,10,domain),/finite/);assert.match(reject(0,Infinity,domain),/finite/);
 assert.match(reject(-1,10,domain),/Minimum value/);assert.match(reject(0,101,domain),/Maximum value/);assert.match(reject(1.5,10,domain),/whole number/);
});

test('full-period refinement and current-value doubling remain independently useful',async()=>{
 const {mathematicalScaleAnchor}=await import('../src/properties/mathematicalDial.ts');
 assert.equal(mathematicalScaleValue(mathematicalScaleAnchor('halving',.25,1),3,'halving'),.125);
 assert.equal(mathematicalScaleValue(mathematicalScaleAnchor('division',.25,1),8,'division'),.125);
 assert.equal(mathematicalScaleValue(mathematicalScaleAnchor('doubling',.125,1),3,'doubling'),1);
});
