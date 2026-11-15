import test from 'node:test';
import assert from 'node:assert/strict';

test('live edits commit the latest value once per frame, flush before closing and skip incomplete values', async () => {
  globalThis.document = new EventTarget(); globalThis.window = new EventTarget();
  const frames = new Map(); let next = 0;
  globalThis.requestAnimationFrame = callback => { frames.set(++next, callback); return next; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const { liveForm } = await import('../src/ui/liveForm.ts');
  const form = new EventTarget(); let valid = true, value = '', writes = [];
  form.isConnected = true;
  form.checkValidity = () => valid;
  const dispose=liveForm(form, group => writes.push({value, group}));
  value='a';form.dispatchEvent(new Event('input'));
  value='ab';form.dispatchEvent(new Event('input'));
  assert.equal(frames.size,1);assert.equal(writes.length,0);
  [...frames.values()][0]();assert.equal(writes[0].value,'ab');assert.equal(frames.size,0);
  value='abc';form.dispatchEvent(new Event('input'));
  document.dispatchEvent(new Event('pointerdown'));
  assert.equal(writes[1].value,'abc');assert.equal(writes[0].group,writes[1].group);assert.equal(frames.size,0);
  valid=false;value='';form.dispatchEvent(new Event('input'));form.dispatchEvent(new Event('change'));
  assert.equal(writes.length,2);
  valid=true;value='done';form.dispatchEvent(new Event('input'));form.dispatchEvent(new Event('change'));
  assert.equal(writes[2].value,'done');assert.equal(frames.size,0);
  const submit=new Event('submit',{cancelable:true});form.dispatchEvent(submit);assert.equal(submit.defaultPrevented,true);
  value='undoable';form.dispatchEvent(new Event('input'));
  const undo=new Event('keydown');Object.assign(undo,{key:'z',ctrlKey:true});document.dispatchEvent(undo);
  assert.equal(writes.at(-1).value,'undoable');assert.equal(frames.size,0);
  value='saved';form.dispatchEvent(new Event('input'));window.dispatchEvent(new Event('pagehide'));
  assert.equal(writes.at(-1).value,'saved');assert.equal(frames.size,0);
  for(const type of ['range']){
    value=type;const input=new Event('input');Object.defineProperty(input,'target',{value:{type}});
    form.dispatchEvent(input);assert.equal(writes.at(-1).value,type);assert.equal(frames.size,0);
  }
  const colorInput=()=>{const input=new Event('input');Object.defineProperty(input,'target',{value:{type:'color'}});form.dispatchEvent(input);};
  const beforeColor=writes.length;
  value='#001122';colorInput();value='#112233';colorInput();
  assert.equal(writes.length,beforeColor);assert.equal(frames.size,1);
  [...frames.values()][0]();assert.equal(writes.at(-1).value,'#112233');assert.equal(frames.size,0);
  value='#223344';colorInput();form.dispatchEvent(new Event('change'));
  assert.equal(writes.at(-1).value,'#223344');assert.equal(frames.size,0);
  const before=writes.length;
  form.isConnected=false;form.dispatchEvent(new Event('input'));window.dispatchEvent(new Event('pagehide'));assert.equal(writes.length,before);
  form.isConnected=true;form.dispatchEvent(new Event('input'));dispose();assert.equal(frames.size,0);
  document.dispatchEvent(new Event('pointerdown'));assert.equal(writes.length,before);
  form.dispatchEvent(new Event('input'));assert.equal(frames.size,0);

});
