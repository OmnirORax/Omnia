// Read-only preflight. Never uploads files, changes policies or follows redirects.
import { readdir } from 'node:fs/promises';

const projectName = 'omnia-web';
const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const timeout = () => AbortSignal.timeout(15000);
function fail(message) { throw new Error(message); }
async function api(path) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${projectName}${path}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: timeout(), redirect: 'error',
  });
  if (!response.ok) fail(`Cloudflare inventory request failed (${response.status}); check token scope/account.`);
  const data = await response.json();
  if (!data.success) fail('Cloudflare inventory request was unsuccessful.');
  return data;
}
function hostname(value) {
  const url = new URL(value.startsWith('https://') ? value : `https://${value}`);
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.pathname !== '/' || url.search || url.hash) fail('Host inventory must contain HTTPS hostnames only.');
  return url.hostname;
}
async function main() {
  if (!token || !/^[a-f\d]{32}$/i.test(account ?? '')) fail('Cloudflare token/account configuration is missing or invalid.');
  if (!process.env.GH_TOKEN) fail('GitHub read token is required to verify legacy hosting is disabled.');
  const legacy = await fetch('https://api.github.com/repos/OmnirORax/Omnia/pages', {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' },
    signal: timeout(), redirect: 'error',
  });
  if (legacy.status !== 404) fail('Legacy GitHub Pages must be unpublished and readable as absent (HTTP 404) before deployment.');
  await legacy.body?.cancel();
  const oldSite = await fetch('https://omnirorax.github.io/Omnia/', { redirect: 'manual', signal: timeout() });
  if (![404, 410].includes(oldSite.status)) fail('Old GitHub Pages URL is still reachable or cannot be confirmed retired.');
  await oldSite.body?.cancel();
  const project = (await api('')).result;
  if (project.name !== projectName || project.production_branch !== 'master') fail('Existing Pages project must use production branch master.');
  // Git integration could publish independently of this workflow's gates.
  if (project.source?.config?.deployments_enabled !== false && project.source) {
    fail('Disable Cloudflare Git integration automatic deployments before enabling Actions deployment.');
  }
  const hosts = new Set(['omnium.nexus', 'omnia-web-bae.pages.dev', hostname(project.subdomain)]);
  for (const domain of project.domains ?? []) hosts.add(hostname(domain));
  for (const host of (process.env.CLOUDFLARE_ACCESS_EXTRA_HOSTS ?? '').split(/[\s,]+/).filter(Boolean)) hosts.add(hostname(host));
  let complete = false;
  for (let page = 1; page <= 100; page++) {
    const data = await api(`/deployments?page=${page}&per_page=25`);
    for (const deployment of data.result) {
      if (deployment.url) hosts.add(hostname(deployment.url));
      for (const alias of deployment.aliases ?? []) hosts.add(hostname(alias));
    }
    if (data.result.length < 25) { complete = true; break; }
  }
  if (!complete) fail('Deployment inventory exceeded safety limit; audit all remaining deployments before proceeding.');
  const assets = await readdir('dist/assets');
  const asset = assets.find(file => file.endsWith('.js'));
  if (!asset) fail('Build dist before running Access checks.');
  const paths = ['/', '/index.html', `/assets/${encodeURIComponent(asset)}`, '/favicon.svg'];
  let failures = 0;
  for (const host of [...hosts].sort()) {
    for (const path of paths) {
      try {
        const response = await fetch(`https://${host}${path}`, {
          redirect: 'manual', signal: timeout(), headers: { 'Cache-Control': 'no-cache' },
        });
        const target = new URL(response.headers.get('location') ?? '', `https://${host}`);
        const protectedHost = [302, 303, 307, 308].includes(response.status) &&
          target.protocol === 'https:' && target.hostname.endsWith('.cloudflareaccess.com') &&
          target.pathname.startsWith('/cdn-cgi/access/login');
        await response.body?.cancel();
        if (!protectedHost) { failures++; console.error(`FAIL ${host}${path}: expected Cloudflare Access login redirect (${response.status}).`); }
        else console.log(`PASS ${host}${path}: Access login required.`);
      } catch {
        failures++; console.error(`FAIL ${host}${path}: could not verify access protection.`);
      }
    }
  }
  if (failures) fail(`${failures} access checks failed; publication blocked.`);
  console.log(`Unauthenticated requests blocked on ${hosts.size} inventoried hosts. Complete the documented browser/policy audit before activation.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
