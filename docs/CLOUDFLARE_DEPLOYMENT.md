# Private Cloudflare Pages deployment

Target: existing Pages project `omnia-web`, canonical branch `master`, custom
domain `https://omnium.nexus`. The reported production Pages hostname is
`omnia-web-bae.pages.dev`; the preflight also discovers the actual project subdomain,
attached domains, deployment URLs and preview aliases through Cloudflare's API.
No project, domain, Access policy or branch is created by the workflow.

## Current safety state

Automatic deployment is **off unless** repository variable
`CLOUDFLARE_DEPLOY_ENABLED` is exactly `true`. Leave it unset during setup.
Pull requests and pushes to `master` run model tests, the production build, backend
type checks and isolated local backend permission/lifecycle tests. Only a push
to `master` with passing checks and the activation variable can publish. Manual
dispatch on `master` runs checks and a read-only release preflight, **never deploys**.
There are no automatic preview deployments in this workflow.

Release uses Node 24, immutable Yarn 4.18.1 dependencies, the existing `build`
command, and pinned Wrangler 4.152.0:

```sh
wrangler pages deploy dist --project-name omnia-web --branch master
```

The release job rebuilds the tested revision instead of publishing a downloadable
Actions artifact containing the site. Build paths remain relative (`base: './'`);
no Vite base change or SPA rewrite is required for the current application.
No Supabase deployment credentials are available to this workflow.

## Required GitHub configuration

Repository Settings → Secrets and variables → Actions:

| Kind | Name | Value/purpose |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | Account-scoped Cloudflare Pages Edit token for the account containing `omnia-web`; no DNS/Access administrative permission needed |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | The existing project's 32-character Cloudflare account ID |
| Variable | `VITE_SUPABASE_URL` | Existing Supabase HTTPS project URL |
| Variable | `VITE_SUPABASE_PUBLISHABLE_KEY` | Existing public publishable key, never a privileged key |
| Variable, optional | `CLOUDFLARE_ACCESS_EXTRA_HOSTS` | Whitespace/comma-separated additional HTTPS hostnames discovered during the DNS/routing audit |
| Variable, activation only | `CLOUDFLARE_DEPLOY_ENABLED` | Leave unset until the entire checklist below passes; then set `true` |

Create environment **`cloudflare-production`** in Settings → Environments. Restrict
deployment branches to `master`. Configure required reviewers and prevent
self-review if available on the repository's GitHub plan. Environment approval
is an additional control, not a substitute for the activation flag or Access.
If required reviewers are unavailable, retain the disabled flag until the
independent verification is completed. Review branch protection/rulesets to require
the new `checks` job; preserve existing required checks and protections.

Repository variables/secrets could not be inspected with the current integration
(HTTP 403). Their existence and values have not been verified. Environment settings
and branch protections are not silently created or changed by this patch.

## Retire GitHub Pages before enabling Cloudflare

The old `deploy-pages.yml` retains its model/build checks but has no configure,
upload or deploy steps. Existing backend workflow and its permissions are unchanged.
Removing publication steps **does not unpublish an existing site**.

The GitHub Pages API still reported `cname: omnium.nexus` during inspection.
Unpublishing via this integration returned HTTP 403. A repository administrator
must open **Settings → Pages → Unpublish site** (confirm removal of the old custom
domain binding). Remove any obsolete DNS records pointing at GitHub Pages; retain
the records Cloudflare Pages requires. Do not delete the repository or change
other Actions permissions. Confirm the Pages API now returns HTTP 404 and
`https://omnirorax.github.io/Omnia/` returns HTTP 404/410 without a redirect.
The release preflight independently requires both conditions.

## Cloudflare configuration and privacy verification

1. Set the existing Pages project's production branch to **`master`**. Disable any
   native Cloudflare Git integration automatic production/preview builds so they
   cannot bypass the Actions checks or disabled flag. Preserve the existing project
   and its custom domain.
2. Review DNS, Pages domains/aliases, redirects and any Workers/routes for other
   paths to this site. Add any host not returned by the Pages API to
   `CLOUDFLARE_ACCESS_EXTRA_HOSTS`. Review old deployment URLs as well as the two
   production hostnames. Cached/downloaded copies from an earlier public site
   cannot be revoked by retiring hosting.
3. Verify Access applications cover `omnium.nexus`, `omnia-web-bae.pages.dev`, the
   actual API-reported project subdomain, all preview/branch/deployment aliases,
   and future preview hostnames. A wildcard for subdomains does not necessarily
   cover the bare Pages hostname. Confirm all paths, including `/assets/*`, are
   covered and there are no Bypass/Everyone policies or alternate unprotected routes.
4. From an independent network with **no Access cookies**, request `/`,
   `/index.html`, a real JavaScript/CSS asset and `/favicon.svg` on every hostname.
   Requests must be stopped by Access; a WAF challenge, proxy error, unavailable
   host or ordinary app login screen does not prove privacy. Check an unauthorized
   signed-in identity is denied and an explicitly allowed identity succeeds.
   Verify the preview wildcard/policy also covers a representative preview alias.
5. After merging this configuration, run **Actions → Cloudflare Pages → Run
   workflow → master**, leaving the activation flag unset. This runs all checks,
   builds `dist`, and probes existing endpoints without publishing. The read-only
   preflight inventories all existing Pages deployments/aliases (fails closed if
   it cannot enumerate them), and requires a redirect directly to a
   `*.cloudflareaccess.com/cdn-cgi/access/login…` URL for the page and asset paths.
   It does not submit credentials, follow login redirects or print tokens/responses.
   Failure or uncertainty blocks publication. A passing unauthenticated probe does
   not prove that Access restricts authenticated identities correctly; complete
   the browser and policy checks above too.

Outbound requests to both production hosts and the legacy GitHub hostname were
blocked by this development environment's network proxy (CONNECT HTTP 403).
**Access protection has not been independently verified here.** Run the check
from GitHub Actions or an allowed independent network before activation.

## Backend origin compatibility

Only hosted secret `OMNIA_ALLOWED_ORIGINS` was changed for this migration:

```text
https://omnium.nexus,http://127.0.0.1:5173,http://localhost:5173
```

This exact value is also retained in `scripts/backend-hosted.mjs` so a future
backend deployment does not restore the old GitHub origin. Live OPTIONS checks
verified HTTP 204 and matching allowed origin for all three entries, and HTTP 403
without an allow-origin header for an unrelated origin and the retired GitHub
origin. No schema, Auth, storage, permissions or deployed function code changed.
To configure manually later: Supabase project → Edge Functions → Secrets →
`OMNIA_ALLOWED_ORIGINS`; preserve the exact comma-separated origins above.
Do not run the full backend deploy script just to change this secret.

The Pages/preview URLs are protected entrypoints, but cloud operations are enabled
only on the custom domain and legitimate development origins. Do not add a wildcard
preview origin to Supabase. Browser-local atlas/UI data is origin-specific and will
not automatically move from GitHub Pages to the custom domain; export/import any
needed local data using the existing tools. Access and Supabase user login remain
separate authentication boundaries.

## Activate only after verification

After all checks above pass, set `CLOUDFLARE_DEPLOY_ENABLED=true`, then push/merge
a reviewed change to `master`. Approve the `cloudflare-production` environment
if configured. The successful checks are followed by another host preflight and
Wrangler publication to the existing project. Manual dispatch remains verify-only.
To pause future releases, remove/set false the activation variable; this does not
unpublish the existing Cloudflare site. Keep Access enabled during incidents or
rollbacks. Never re-enable public GitHub Pages as a rollback.

## Implementation validation

Verified locally: 172 existing model/architecture tests, production and
self-contained preview builds, frozen backend type check, workflow YAML parsing
and branch/activation/dependency guards. Simulated preflight checks accepted a
protected host inventory and rejected active GitHub hosting, API failure, wrong
production branch, competing Git builds, exposed preview content and an unrelated
login redirect. Build configuration checks rejected missing/privileged keys and
accepted public keys. Live backend origin tests passed as described above.
The existing production build retains its large-chunk warning; this migration
does not change runtime code. Browser suites and local backend lifecycle tests
were not rerun for this configuration change; the existing lifecycle suite is
required by the new CI job. Cloudflare credentials are not present in this coding
environment, so its live account/project settings have not been inspected here.
No Cloudflare deployment was performed.
