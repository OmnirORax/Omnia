import test from 'node:test';import assert from 'node:assert/strict';import {accessAssertion} from '../src/cloud/accessAssertion.ts';
test('native API transports share assertion-header precedence and exact Access cookie extraction',()=>{
 assert.equal(accessAssertion(new Request('https://example.com',{headers:{'cf-access-jwt-assertion':'header-token',cookie:'other=x; CF_Authorization=cookie-token'}})),'header-token');
 assert.equal(accessAssertion(new Request('https://example.com',{headers:{cookie:'other=x; CF_Authorization=cookie-token; tail=x'}})),'cookie-token');
 assert.equal(accessAssertion(new Request('https://example.com',{headers:{cookie:'Not_CF_Authorization=x'}})),undefined);
});
