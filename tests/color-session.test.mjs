import test from 'node:test';
import assert from 'node:assert/strict';
import {createColorSession} from '../src/ui/colorSession.ts';
import {createStore} from '../src/core/store.ts';
import {readPaint,writePaint,paintPreview} from '../src/core/appearance.ts';

test('unit RGB updates preview immediately and accept once, without world storage/history per sample',()=>{
 let saves=0;const store=createStore({getItem:()=>null,setItem(){saves++;}}),base=store.world,seen=[];
 const session=createColorSession({value:readPaint(base,'text').color,preview:value=>{const candidate=paintPreview(base,'text',[],{color:value});seen.push(candidate.appearance.text.color);},commit:value=>store.change(world=>writePaint(world,'text',[],{color:value})),cancel(){}});
 for(let i=1;i<=40;i++)session.input(`#${i.toString(16).padStart(2,'0')}0000`);
 assert.equal(seen.length,40);assert.equal(seen[0],'#010000');assert.equal(seen[39],'#280000');assert.equal(store.world,base);assert.equal(saves,0);assert.equal(store.canUndo,false);
 session.accept();assert.equal(saves,1);assert.equal(store.canUndo,true);session.accept();assert.equal(saves,1);
 store.undo();assert.equal(readPaint(store.world,'text').color,readPaint(base,'text').color);
});
test('cancel restores baseline, external updates synchronize and unchanged colors do not commit',()=>{
 const commits=[],previews=[];let cancels=0;
 const session=createColorSession({value:'#000000',preview:value=>previews.push(value),commit:value=>commits.push(value),cancel:()=>cancels++});
 session.input('#010000');session.input('#010000');assert.equal(previews.length,1);session.cancel();assert.equal(session.value,'#000000');assert.equal(cancels,1);assert.equal(commits.length,0);
 session.sync('#ffffff');session.input('#fffffe');session.sync('#123456');assert.equal(session.value,'#fffffe');session.accept();assert.deepEqual(commits,['#fffffe']);
});
