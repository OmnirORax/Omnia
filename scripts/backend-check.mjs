import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const child = spawn(resolve(root, 'node_modules/.bin', process.platform === 'win32' ? 'deno.cmd' : 'deno'),
  ['check', '--frozen', '--config', 'supabase/functions/backend/deno.json', 'supabase/functions/backend/index.ts'], {
    cwd: root, stdio: 'inherit', env: { ...process.env, DENO_DIR: process.env.DENO_DIR ?? resolve(root, '.cache/deno'),
      DENO_TLS_CA_STORE: process.env.DENO_TLS_CA_STORE ?? 'system' },
  });
child.on('error', () => { console.error('Install pinned development dependencies first.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
