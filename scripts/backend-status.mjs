import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Keep credential-bearing CLI output in memory, including on CLI failures. */
export function localBackendStatus() {
  let config;
  try {
    config = JSON.parse(execFileSync(process.execPath, ['scripts/backend.mjs', 'status', '--output', 'json'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }));
  } catch { throw new Error('Local backend is unavailable. Start the stack and inspect container health.'); }
  try {
    if (!['127.0.0.1', 'localhost'].includes(new URL(config.API_URL).hostname)) throw new Error();
  } catch { throw new Error('This helper only operates on the local backend.'); }
  return config;
}
