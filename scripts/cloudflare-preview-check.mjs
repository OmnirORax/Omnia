// Adapted from V1's private preview verifier. Read-only; never changes Access.
import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';

const branch = process.argv[2];
const uploaded = process.argv[3] === '--uploaded';
if (!/^pr-[1-9][0-9]*$/.test(branch ?? '') ||
    process.argv.length !== (uploaded ? 4 : 3)) {
  throw new Error('Usage: node scripts/cloudflare-preview-check.mjs pr-<number> [--uploaded]');
}
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!/^[a-f0-9]{32}$/i.test(account ?? '') || !token) throw new Error('Missing Cloudflare configuration.');

async function api(path) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/omnia-web${path}`, {
    headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Cloudflare inventory failed (${response.status}).`);
  const data = await response.json();
  if (!data.success) throw new Error('Cloudflare inventory unsuccessful.');
  return data.result;
}

const project = await api('');
if (project.name !== 'omnia-web' || project.production_branch !== 'master' ||
    project.subdomain !== 'omnia-web-bae.pages.dev' ||
    (project.source && project.source.config?.deployments_enabled !== false)) {
  throw new Error('Unexpected Pages project, production branch or Git deployment configuration.');
}
const hosts = new Set([
  `${branch}.${project.subdomain}`,
  `access-probe-${Date.now()}.${project.subdomain}`,
]);
if (uploaded) {
  const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const deployments = await api('/deployments?per_page=25');
  const matches = deployments.filter(d => d.environment === 'preview' &&
    d.deployment_trigger?.metadata?.branch === branch &&
    d.deployment_trigger?.metadata?.commit_hash === source);
  if (!matches.length) throw new Error('Uploaded preview not found for this branch and source commit.');
  for (const deployment of matches) {
    const url = new URL(deployment.url);
    if (url.protocol !== 'https:' || !url.hostname.endsWith(`.${project.subdomain}`) ||
        url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Unexpected preview deployment URL.');
    }
    hosts.add(url.hostname);
  }
}
const asset = (await readdir('dist/assets')).find(file => file.endsWith('.js'));
if (!asset) throw new Error('Build before checking preview protection.');
const paths = ['/api/draft', '/api/draft?asset=sha256:0000000000000000000000000000000000000000000000000000000000000000', '/', '/index.html', '/source.json', '/favicon.svg', `/assets/${encodeURIComponent(asset)}`];
for (const host of hosts) {
  for (const path of paths) {
    const response = await fetch(`https://${host}${path}`, {
      redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { 'Cache-Control': 'no-cache' },
    });
    const target = new URL(response.headers.get('location') ?? '', `https://${host}`);
    await response.body?.cancel();
    if (![302, 303, 307, 308].includes(response.status) || target.protocol !== 'https:' ||
        !target.hostname.endsWith('.cloudflareaccess.com') ||
        !target.pathname.startsWith('/cdn-cgi/access/login')) {
      throw new Error(`Access check failed: ${host}${path} (${response.status}).`);
    }
  }
}
console.log(`Access required on ${hosts.size} preview hosts, including HTML, source provenance and assets.`);
