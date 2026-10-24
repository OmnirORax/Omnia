import { setTimeout } from 'node:timers/promises';
import { localBackendStatus } from './backend-status.mjs';
const config = localBackendStatus();
for (let attempt = 0; attempt < 45; attempt++) {
  try {
    const result = await fetch(`${config.API_URL}/functions/v1/backend`, {
      headers: { apikey: config.ANON_KEY ?? config.PUBLISHABLE_KEY }, signal: AbortSignal.timeout(2000),
    });
    const body = await result.json();
    if (result.status === 405 && body.error?.code === 'invalid_input' && body.error.requestId) {
      console.log('Local backend handler is ready. Run test:backend to verify permissions.'); process.exit(0);
    }
  } catch { /* The local function worker may still be loading dependencies. */ }
  await setTimeout(1000);
}
console.error('Local backend handler did not become ready; inspect functions serve and container health.');
process.exitCode = 1;
