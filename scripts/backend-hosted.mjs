// Explicit hosted deployment. Never resets a database or provisions a paid service.
import { readFileSync, readdirSync } from 'node:fs';

const [mode, ref] = process.argv.slice(2);
if (!['plan', 'deploy'].includes(mode) || !/^[a-z]{20}$/.test(ref ?? ''))
  throw new Error('Use: NODE_USE_ENV_PROXY=1 node scripts/backend-hosted.mjs plan|deploy <project-ref>');
if (!process.env.SUPABASE_ACCESS_TOKEN) throw new Error('Configure the deployment token securely before continuing.');
if (new URL(process.env.VITE_SUPABASE_URL ?? '').hostname !== `${ref}.supabase.co`)
  throw new Error('Project ref must match the configured frontend project.');

const base = `https://api.supabase.com/v1/projects/${ref}`;
export async function management(path, method = 'GET', body) {
  const response = await fetch(base + path, {
    method, headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Management operation ${method} ${path} failed (HTTP ${response.status}). No response payload logged.`);
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
const query = (sql, readOnly = true) => management('/database/query', 'POST', { query: sql, read_only: readOnly });
const literal = value => `'${value.replaceAll("'", "''")}'`;
const migrations = readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter(name => /^\d{14}_.+\.sql$/.test(name)).sort()
  .map(name => ({ version: name.slice(0, 14), name: name.slice(15, -4), sql: readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8') }));
const state = (await query("select to_regclass('public.workspaces') is not null as app_exists, to_regclass('supabase_migrations.schema_migrations') is not null as history_exists"))[0];
const history = state.history_exists ? await query('select version, statements from supabase_migrations.schema_migrations order by version') : [];
const pending = migrations.filter(migration => !history.some(row => row.version === migration.version));
for (const migration of migrations) {
  const stored = history.find(row => row.version === migration.version);
  if (stored && stored.statements?.join('\n') !== migration.sql) throw new Error('Stored migration content differs; review before deployment.');
}
if (state.app_exists && !history.length) throw new Error('Existing application tables have no migration history; refusing to overwrite them.');
const auth = await management('/config/auth');
const functions = await management('/functions');
console.log(JSON.stringify({ project: ref, mode, pendingMigrations: pending.map(item => item.version),
  signupDisabled: auth.disable_signup, functions: functions.map(item => item.slug) }));
if (mode === 'plan') process.exit(0);

if (pending.length) {
  const sql = [
    'begin;', "select pg_advisory_xact_lock(hashtextextended('omnia-schema-deployment', 0));",
    'create schema if not exists supabase_migrations;',
    'create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);',
    'revoke all on schema supabase_migrations from public, anon, authenticated;',
    'revoke all on table supabase_migrations.schema_migrations from public, anon, authenticated;',
    ...pending.flatMap(item => [item.sql,
      `insert into supabase_migrations.schema_migrations(version, statements, name) values (${literal(item.version)}, array[${literal(item.sql)}], ${literal(item.name)});`]),
    'commit;',
  ].join('\n');
  await query(sql, false);
  console.log('Database migrations committed atomically.');
}
let signupNeedsDashboard = false;
try {
  await management('/config/auth', 'PATCH', { disable_signup: true });
  console.log('Public signup disabled.');
} catch (error) {
  if (!error.message.includes('HTTP 403')) throw error;
  signupNeedsDashboard = true;
  console.log('Auth settings require additional project permission. Disable public signup in the dashboard; continuing independent deployment.');
}
await management('/secrets', 'POST', [{ name: 'OMNIA_ALLOWED_ORIGINS', value: 'https://omnium.nexus,http://127.0.0.1:5173,http://localhost:5173' }]);
console.log('Backend browser origins configured.');
// Direct Management API supports project-scoped/proxy-backed tokens that the
// CLI's legacy token-format validator rejects. Never fall back to broader tokens.
const form = new FormData();
form.append('metadata', JSON.stringify({ entrypoint_path: 'backend/index.ts', import_map_path: 'backend/deno.json', name: 'backend', verify_jwt: false }));
for (const path of ['backend/index.ts', 'backend/deno.json', 'backend/deno.lock', '_shared/contracts.ts'])
  form.append('file', new Blob([readFileSync(new URL(`../supabase/functions/${path}`, import.meta.url))]), path);
const response = await fetch(base + '/functions/deploy?slug=backend', {
  method: 'POST', headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` }, body: form, signal: AbortSignal.timeout(180000),
});
if (!response.ok) {
  const failure = await response.json().catch(() => null);
  throw new Error(`Function deployment failed (HTTP ${response.status}): ${String(failure?.message ?? 'No detail').slice(0, 800)}`);
}
const deployed = await management('/functions');
const finalAuth = await management('/config/auth');
if (!deployed.some(item => item.slug === 'backend' && item.status === 'ACTIVE'))
  throw new Error('Deployment has not reached the expected function/auth state.');
console.log(JSON.stringify({ backendActive: true, signupDisabled: finalAuth.disable_signup, signupNeedsDashboard }));
