# Private Cloudflare Pages deployment

Target: existing Pages project `omnia-web`, canonical branch `master`, custom
domain `https://omnium.nexus`. The reported production Pages hostname is
`omnia-web-bae.pages.dev`; the preflight also discovers the actual project subdomain,
attached domains, deployment URLs and preview aliases through Cloudflare's API.
No project, domain, Access policy or branch is created by the workflow.

## Live status and handoff (2026-10-24)

Production is live at **https://omnium.nexus**. The user completed the Access
policy/browser checks, authorized activation, and set repository variable
`CLOUDFLARE_DEPLOY_ENABLED=true`. Automatic production deployment from **`master`**
is enabled; do not rename the branch to `main` or repeat initial provisioning.
GitHub Pages' custom-domain binding was removed and hosting disabled; its API
returned HTTP 404. The existing Cloudflare project was retained.

Evidence for deployed commit `3c4945de09f92a38654fac70f0b41b2ca30b507d`:

- Configuration merged through [PR #27](https://github.com/OmnirORax/Omnia/pull/27).
- [Pre-activation verification](https://github.com/OmnirORax/Omnia/actions/runs/40112405965)
  passed after the account ID formatting was corrected and GitHub Pages retired.
- [Production push workflow, attempt 2](https://github.com/OmnirORax/Omnia/actions/runs/40112335371)
  passed and deployed with Wrangler. This reran the reviewed commit's original
  push event after the user enabled the activation variable; no empty commit or
  backend deployment was needed.
- [Post-deployment verification](https://github.com/OmnirORax/Omnia/actions/runs/40115743541)
  passed, covering the newly inventoried deployment hostname as well as production
  hosts. This was manual dispatch and did not publish a second deployment.

Automated evidence proves the inventoried hosts required Access authentication on
the checked paths. Unauthorized signed-in identity denial and future preview
policy coverage were **reported checked by the user**; the agent did not inspect
those policies or perform authenticated browser tests. This is a dated baseline,
not a permanent guarantee after policy/domain changes. Reverify when changing
Access, domains, aliases, previews, routes or deployment configuration.

## Release behavior

Automatic deployment is **off unless** repository variable
`CLOUDFLARE_DEPLOY_ENABLED` is exactly `true` (currently enabled). For a new setup
or unresolved privacy incident, leave it unset/false until verification passes.
Pull requests and pushes to `master` run model tests, the production build, backend
type checks and isolated local backend permission/lifecycle tests. Only a push
to `master` with passing checks and the activation variable can publish. Manual
dispatch on `master` runs checks and a read-only release preflight, **never deploys**.
There are no automatic preview deployments in this workflow.

Rerunning an old **push** event can also publish when the flag is enabled. Verify
its SHA matches the intended reviewed `master` revision before rerunning; do not
use an old push run as a harmless test. For verification without publication use
`gh workflow run cloudflare-pages.yml --ref master --repo OmnirORax/Omnia`.
The built-in Access preflight runs **before** publication. A new deployment URL
is inventoried on the next verification run; post-deployment verification is a
separate manual dispatch, not an automatic second job in the push workflow.

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
| Variable | `CLOUDFLARE_ACCOUNT_ID` | Exactly the existing project's 32 hexadecimal characters, one line, no whitespace |
| Variable | `VITE_SUPABASE_URL` | Existing Supabase HTTPS project URL |
| Variable | `VITE_SUPABASE_PUBLISHABLE_KEY` | Existing public publishable key, never a privileged key |
| Variable, optional | `CLOUDFLARE_ACCESS_EXTRA_HOSTS` | Whitespace/comma-separated additional HTTPS hostnames discovered during the DNS/routing audit |
| Variable, activation | `CLOUDFLARE_DEPLOY_ENABLED` | Currently `true`; remove/set false to pause future publication |

Create environment **`cloudflare-production`** in Settings → Environments. Restrict
deployment branches to `master`. Configure required reviewers and prevent
self-review if available on the repository's GitHub plan. Environment approval
is an additional control, not a substitute for the activation flag or Access.
If required reviewers are unavailable, retain the disabled flag until the
independent verification is completed. Review branch protection/rulesets to require
the new `checks` job; preserve existing required checks and protections.

The user configured credentials/variables and reported the environment setup
completed. Successful live release/verification proves the required credentials
were usable. Direct variable/secret inspection and updates through this coding
integration returned HTTP 403, as did deleting GitHub Pages hosting; the user made
those administrative changes in the dashboard. Do not request broader credentials
or claim to have independently audited branch protections/reviewer settings.

## Retire GitHub Pages before enabling Cloudflare

The old `deploy-pages.yml` retains its model/build checks but has no configure,
upload or deploy steps. Existing backend workflow and its permissions are unchanged.
Removing publication steps **does not unpublish an existing site**.

Retirement is complete. For future recovery/reference: the Pages settings page
had no Unpublish button. The user clicked **Remove** beside the custom domain,
then changed **Source → Deploy from a branch → Branch: None → Save**. Removing
only the domain binding left the Pages configuration present; selecting None
disabled hosting and made the API return 404. An API 200 with an empty status
does not by itself prove that content is still being served.
Remove any obsolete DNS records pointing at GitHub Pages; retain
the records Cloudflare Pages requires. Do not delete the repository or change
other Actions permissions. Confirm the Pages API now returns HTTP 404 and
`https://omnirorax.github.io/Omnia/` returns HTTP 404/410 without a redirect.
The release preflight independently requires both conditions.

## Cloudflare configuration and privacy verification

This checklist was completed for activation; reuse it when changing infrastructure.

1. Keep the existing Pages project's production branch at **`master`**. Disable any
   native Cloudflare Git integration automatic production/preview builds so they
   cannot bypass the Actions checks or disabled flag. Preserve the existing project
   and its custom domain.
   A Direct Upload project may have no native Git automatic-build settings; do
   not create a second project or connect Git just to obtain those settings.
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
This was not an Access denial and was not treated as proof of protection.
Independent unauthenticated checks subsequently passed **from GitHub Actions**,
including the post-deployment run linked above. Use Actions or an allowed network
when the coding workspace cannot reach those hosts; do not bypass its proxy.

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
Those were the initial implementation checks. Subsequently, GitHub CI passed the
full local backend lifecycle suite and the live deployment/verification runs
above. No browser suite was run by the agent, and no additional hosted backend
migrations or function deployment were performed for the frontend rollout.

## Troubleshooting and future changes

- `Cloudflare token/account configuration is missing or invalid`: check secret
  presence and the account variable's exact single-line format. Trailing blank
  lines caused the observed failure; the user corrected the variable. Do not paste
  tokens into chat or print environment values while diagnosing.
- The Node 20 action-runtime deprecation and Ubuntu runner migration annotations
  were warnings, not the failed preflight's cause. Expand the red failed step to
  see the actual message. A local-backend startup failure passed on retry; do not
  remove the permission suite to get a green deployment.
- This coding environment could read Actions status but log downloads were blocked
  at the results-storage domain; jobs API requests also intermittently returned
  HTTP 502. A dashboard error message may be needed if those limits recur. Do not
  interpret a failed status request as a failed deployment.
- No public signup/website entry flow or AI provider integration was added by
  this hosting work. Keep the existing Supabase authorization boundary. New auth
  redirects, provider callbacks or external integrations need their own explicit
  design compatible with Access; never weaken Access/CORS to make them work.
- Merges to `master`, including documentation-only merges, can publish. Preserve
  existing workflows, required checks, environments and permissions. For follow-up
  changes use a new branch/PR from current `master`; PR #27 is already merged.

## Automatic private PR previews

Same-repository PRs authored by OWNER/MEMBER/COLLABORATOR run the existing checks
against the exact PR head SHA, then build that SHA again in a separate `preview`
job/environment (`cloudflare-preview`). Forks and other author associations skip
this credential-bearing job; `pull_request_target` is not used. Maintain restricted
repository write access and configure required reviewers on the preview environment
when accepting code from anyone not trusted with deployment credentials.

Wrangler deploys to the existing `omnia-web` project with branch `pr-<number>`;
production branch remains `master`. PR #29's alias is
`https://pr-29.omnia-web-bae.pages.dev`. Before uploading content, the Access checker
requires login redirects on that alias and a fresh wildcard probe hostname, plus
all existing inventoried hosts. Unavailable/unprotected aliases fail closed. After
upload it enumerates/checks the new deployment hosts again. No deployment occurs
if the preflight fails. Production conditions and activation variable are separate.
No Supabase origins or backend settings change: cloud operations remain restricted
to the production/development origins documented above. PR UI/prompt preview works;
API generation still needs its own backend rollout/credentials.
