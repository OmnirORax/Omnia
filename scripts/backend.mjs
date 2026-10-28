import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// CLI state belongs in a writable, ignored directory, not the execution user's home.
const root = fileURLToPath(new URL('../', import.meta.url));
const state = process.env.SUPABASE_HOME ?? resolve(root, '.cache/supabase-cli');
mkdirSync(state, { recursive: true });
const cli = resolve(root, 'node_modules/.bin', process.platform === 'win32' ? 'supabase.cmd' : 'supabase');
const child = spawn(cli, process.argv.slice(2), {
  cwd: root, stdio: 'inherit', env: { ...process.env, SUPABASE_HOME: state,
    // CI slim-image registry pulls have returned HTTP 403. All CI lifecycle
    // commands share the standard distribution; local users retain slim images.
    SUPABASE_USE_SLIM_IMAGES: process.env.SUPABASE_USE_SLIM_IMAGES ?? (process.env.CI === 'true' ? 'false' : 'true') },
});
child.on('error', () => { console.error('Supabase CLI could not start. Install dependencies with yarn install --immutable.'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
