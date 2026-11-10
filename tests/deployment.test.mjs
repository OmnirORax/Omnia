import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Execute the real preflights against synthetic network responses. No live data,
// credentials, uploads or external requests are used by these tests.
async function preflight(script, scenario, args = []) {
  const directory = await mkdtemp(join(tmpdir(), 'omnium-access-test-'));
  try {
    await mkdir(join(directory, 'dist/assets'), { recursive: true });
    await writeFile(join(directory, 'dist/assets/app.js'), '');
    const source = `
      import childProcess from 'node:child_process';
      import { syncBuiltinESMExports } from 'node:module';
      childProcess.execFileSync = (command, args) => {
        if (command !== 'git' || args.join(' ') !== 'rev-parse HEAD') throw Error('Unexpected subprocess');
        return 'b'.repeat(40);
      };
      syncBuiltinESMExports();
      const scenario = ${JSON.stringify(scenario)};
      const project = { name: 'omnia-web', production_branch: 'master', subdomain: 'omnia-web-bae.pages.dev', domains: ['omnium.nexus'] };
      if (scenario === 'wrong-branch') project.production_branch = 'other';
      if (scenario === 'git-builds') project.source = { config: { deployments_enabled: true } };
      globalThis.fetch = async (value, options) => {
        const url = new URL(value);
        if (url.hostname === 'api.github.com') return new Response('', { status: scenario === 'legacy-api' ? 200 : 404 });
        if (url.hostname === 'omnirorax.github.io') return new Response('', { status: scenario === 'legacy-site' ? 200 : 404 });
        if (url.hostname === 'api.cloudflare.com') {
          if (scenario === 'api-error') return new Response('', { status: 403 });
          let deployments = [];
          if (${JSON.stringify(args)}.includes('--uploaded') && scenario !== 'missing-upload') {
            deployments = [{
              environment: scenario === 'production-upload' ? 'production' : 'preview',
              url: scenario === 'external-upload' ? 'https://evil.example/' : 'https://build.omnia-web-bae.pages.dev/',
              deployment_trigger: { metadata: {
                branch: scenario === 'other-branch-upload' ? 'pr-65' : 'pr-64',
                commit_hash: scenario === 'old-upload' ? 'c'.repeat(40) : 'b'.repeat(40),
              } },
            }];
          }
          const result = url.pathname.endsWith('/deployments') ? deployments : project;
          return Response.json({ success: true, result });
        }
        if (options.redirect !== 'manual') throw Error('Probe must never follow login redirects.');
        if (scenario === 'network-error') throw Error('Synthetic network failure');
        let location = 'https://team.cloudflareaccess.com/cdn-cgi/access/login';
        if (scenario === 'wrong-login') location = 'https://unrelated.example/login';
        if (scenario === 'lookalike') location = 'https://team.cloudflareaccess.com.evil.example/cdn-cgi/access/login';
        if (scenario === 'wrong-path') location = 'https://team.cloudflareaccess.com/other';
        if (scenario === 'http-login') location = 'http://team.cloudflareaccess.com/cdn-cgi/access/login';
        return new Response('', { status: scenario === 'public' ? 200 : 302, headers: { location } });
      };
      process.argv = ['node', ${JSON.stringify(script)}, ...${JSON.stringify(args)}];
      await import(${JSON.stringify(new URL(`../scripts/${script}`, import.meta.url).href)});
    `;
    return spawnSync(process.execPath, ['--input-type=module', '-e', source], {
      cwd: directory, encoding: 'utf8', timeout: 10000,
      env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_API_TOKEN: 'synthetic', GH_TOKEN: 'synthetic' },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('production preflight accepts a protected inventory with retired legacy hosting', async () => {
  const result = await preflight('cloudflare-access-check.mjs', 'protected');
  assert.equal(result.status, 0, result.stderr);
});

for (const scenario of ['public', 'wrong-login', 'lookalike', 'wrong-path', 'http-login', 'network-error', 'api-error', 'wrong-branch', 'git-builds', 'legacy-api', 'legacy-site']) {
  test(`production preflight blocks ${scenario}`, async () => {
    const result = await preflight('cloudflare-access-check.mjs', scenario);
    assert.equal(result.status, 1, result.stderr);
  });
}

test('preview verifies alias, wildcard and actual asset paths', async () => {
  const result = await preflight('cloudflare-preview-check.mjs', 'protected', ['pr-64']);
  assert.equal(result.status, 0, result.stderr);
});
for (const scenario of ['public', 'lookalike', 'network-error', 'api-error', 'wrong-branch', 'git-builds']) {
  test(`preview preflight blocks ${scenario}`, async () => {
    const result = await preflight('cloudflare-preview-check.mjs', scenario, ['pr-64']);
    assert.equal(result.status, 1, result.stderr);
  });
}
test('preview verifier rejects production branch input', async () => {
  const result = await preflight('cloudflare-preview-check.mjs', 'protected', ['master']);
  assert.equal(result.status, 1, result.stderr);
});

test('uploaded preview is verified against the exact branch, commit and deployment URL', async () => {
  const result = await preflight('cloudflare-preview-check.mjs', 'protected', ['pr-64', '--uploaded']);
  assert.equal(result.status, 0, result.stderr);
});
for (const scenario of ['missing-upload', 'production-upload', 'external-upload', 'other-branch-upload', 'old-upload']) {
  test(`uploaded preview verification rejects ${scenario}`, async () => {
    const result = await preflight('cloudflare-preview-check.mjs', scenario, ['pr-64', '--uploaded']);
    assert.equal(result.status, 1, result.stderr);
  });
}
