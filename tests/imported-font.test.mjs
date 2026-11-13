import test from 'node:test';
import assert from 'node:assert/strict';
import {isImportedFont,importFont} from '../src/properties/importedFont.ts';
import {validatePaint} from '../src/properties/visual.ts';
import {emptyWorld} from '../src/core/model.ts';
import {createStore} from '../src/core/store.ts';
test('embedded fonts survive saved worlds and reject URLs or oversized data',()=>{
 const font='data:font/woff2;base64,d09GMg==';assert.equal(isImportedFont(font),true);validatePaint({font},true);
 const world=emptyWorld();world.appearance.text={font};const saved=JSON.stringify(world);assert.equal(createStore({getItem:()=>saved,setItem:()=>{}}).world.appearance.text.font,font);
 for(const font of ['https://example.com/font.woff2','data:text/html;base64,AAAA','data:font/woff2;base64,'+'A'.repeat(700000)])assert.throws(()=>validatePaint({font},true));
 assert.throws(()=>validatePaint({font},false));
});
test('font import rejects invalid signatures and oversized files before decoding',async()=>{
 await assert.rejects(importFont(new File(['bad'],'bad.woff2')),/Choose a WOFF/);
 await assert.rejects(importFont(new File([new Uint8Array(512*1024+1)],'huge.woff2')),/512 KiB/);
});
