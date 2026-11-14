import test from 'node:test';
import assert from 'node:assert/strict';
import {queueImageDeletion,pendingImageDeletions,acknowledgeImageDeletions,restoreImageDeletions} from '../src/cloud/imageDeletions.ts';
const image='sha256:'+'a'.repeat(64);
function storage(){const slots=new Map();return {getItem:key=>slots.get(key)??null,setItem:(key,value)=>slots.set(key,value)};}
test('deletions survive retries and only the acknowledged generation is cleared',()=>{
 const store=storage();queueImageDeletion(image,store);const sent=pendingImageDeletions(store);
 assert.equal(sent.length,1);assert.deepEqual(pendingImageDeletions(store),sent);
 queueImageDeletion(image,store);acknowledgeImageDeletions(sent,store);assert.equal(pendingImageDeletions(store).length,1);
 acknowledgeImageDeletions(pendingImageDeletions(store),store);assert.deepEqual(pendingImageDeletions(store),[]);
});
test('reimporting or pulling an image cancels its pending deletion',()=>{
 const store=storage();queueImageDeletion(image,store);restoreImageDeletions([image],store);assert.deepEqual(pendingImageDeletions(store),[]);
});
