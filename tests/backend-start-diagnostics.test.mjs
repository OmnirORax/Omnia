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
