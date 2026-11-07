import test from 'node:test';
import assert from 'node:assert/strict';
import {startupFailureSummary} from '../scripts/backend-start-diagnostics.mjs';
test('backend startup diagnostics identify useful failure categories without echoing credentials',()=>{
 const secret='sb_secret_never_print_this',jwt='eyJprivate.payload.signature',password='private-password';
 const fixtures=[
  [`HealthCheckTimeoutError supabase_auth_omnia container is not ready: unhealthy ${secret}`,'health checks failed (auth)'],
  [`Error response from daemon: Get https://registry.invalid/v2/: Forbidden ${password}`,'HTTP 403'],
  [`image pull returned 429 ${jwt}`,'rate limit'],
  [`no space left on device ${secret}`,'disk space'],
  [`Cannot connect to the Docker daemon ${password}`,'Docker daemon'],
  [`ERROR bad statement (SQLSTATE 42P01) ${jwt}`,'SQLSTATE 42P01'],
  [`network is unreachable ${secret}`,'connection failed'],
  [`unexpected ${secret} ${jwt} postgres://name:${password}@localhost/db`,'intentionally not printed'],
 ];
 for(const [input,expected] of fixtures){const output=startupFailureSummary(input);assert.ok(output.includes(expected),output);for(const value of [secret,jwt,password])assert.ok(!output.includes(value));}
});

test('isolated backend retries transient registry throttling with bounded waits, never health/SQL/config failures',async()=>{
 const {startBackendWithRetries}=await import('../scripts/backend-start-policy.mjs');
 const waits=[],reports=[];let calls=0;
 const recovered=await startBackendWithRetries({attempt:()=>({status:++calls<3?7:0,log:'image pull returned 429 synthetic-secret'}),wait:ms=>waits.push(ms),report:item=>reports.push(item)});
 assert.equal(recovered.status,0);assert.equal(calls,3);assert.deepEqual(waits,[15000,45000]);assert.ok(!JSON.stringify(reports).includes('synthetic-secret'));
 for(const log of ['HealthCheckTimeoutError image pull 429','ERROR SQLSTATE 42901 rate limit','invalid config image 429','registry forbidden HTTP 403','auth service returned 429 too many requests']){
  let attempts=0;const result=await startBackendWithRetries({attempt:()=>{attempts++;return {status:19,log};},wait:()=>assert.fail('non-registry failures must not retry')});assert.equal(result.status,19);assert.equal(attempts,1);
 }
});
test('persistent registry throttling still fails after three attempts with its original exit status',async()=>{
 const {startBackendWithRetries}=await import('../scripts/backend-start-policy.mjs');let attempts=0;
 const result=await startBackendWithRetries({attempt:()=>{attempts++;return {status:23,log:'image registry rate limit'};},wait:()=>{}});
 assert.equal(attempts,3);assert.equal(result.status,23);assert.match(result.summary,/rate limit/);
});
