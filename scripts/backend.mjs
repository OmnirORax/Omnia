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
    SUPABASE_USE_SLIM_IMAGES: process.env.SUPABASE_USE_SLIM_IMAGES ?? 'true' },
});
child.on('error', () => { console.error('Supabase CLI could not start. Install dependencies with yarn install --immutable.'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
