# Deployment and retained infrastructure

## Repository baseline

Repository: `OmnirORax/Omnia`; default/development branch: `master`.
`archive/v1` and annotated tag `v1-final` retain merged V1 at
`2fab9db610f2e12da766efc34d2d8104e6af51f4`. Do not advance these refs for V2 work.
The V2 transition retains ancestry and replaces the working tree without force-push.
Future Codex tasks should fetch current `master` and read V2's AGENTS.md;
an old prepared environment checkout is not the repository baseline.

## Cloudflare

Keep existing Pages project `omnia-web`, production branch `master`, domain
`omnium.nexus` and hostname `omnia-web-bae.pages.dev`. Do not create a replacement
project or change DNS/Access. Production and preview hosts remain behind Access.

`.github/workflows/cloudflare-pages.yml` runs tests and builds V2 with Node 24
and `npm ci`. Same-repository trusted PRs deploy to `pr-<number>` after checks and
Access verification. A push to `master` publishes to the existing production
project when `CLOUDFLARE_DEPLOY_ENABLED=true`; that existing setting is retained.
Manual dispatch verifies only. A rerun of an old push can publish its old code;
do not use it as a harmless verification action.

Repository/environment configuration retained:

- Secret `CLOUDFLARE_API_TOKEN` and variable `CLOUDFLARE_ACCOUNT_ID`.
- Optional `CLOUDFLARE_ACCESS_EXTRA_HOSTS` and `CLOUDFLARE_DEPLOY_ENABLED`.
- Environments `cloudflare-production` and `cloudflare-preview`; production is
  restricted to `master` by the existing deployment branch policy.
- Supabase secrets/public variables remain configured, but the V2 shell does not
  consume them and they are not passed to its static build.

Production reuses V1's read-only `scripts/cloudflare-access-check.mjs`: inventory
all existing hosts/deployments, require Access redirects on pages/assets, verify
the production branch and lack of independent Git deployment, and confirm retired
GitHub Pages hosting. Preview verification checks the proposed alias and a fresh
wildcard host before upload and the resulting deployment URL after upload.
Failure blocks publication. These probes establish unauthenticated protection,
not a complete policy audit or authenticated identity acceptance.

No Sites hosting, public GitHub Pages or GitHack publication is introduced. The
existing Access-protected preview is the V2 review route. Existing public V1
artifact history remains in the repository. The repository itself is public.

## Supabase

Retain project `tqjjcabekjjmmspttbli` (Omnia), deployed Auth, database, storage,
functions and authorization policies. No backend deployment, schema change,
reset or hosted data deletion is part of the V2 foundation.

V1-specific migration and backend test workflows are archived with their source,
not kept running against removed modules. When a capability requires backend
reuse, inspect the hosted schema/function versions and `v1-final:supabase/`
before designing its V2 contract. Preserve applied migration history; do not
replay migrations or deploy the entire old backend as a setup shortcut.

The historical allowed origins are `https://omnium.nexus`,
`http://127.0.0.1:5173` and `http://localhost:5173`. Access and Supabase authentication
are separate boundaries. Do not broaden origins for previews without a concrete
need and review. Secrets never enter browser bundles.

## Recovery and evidence

The V1 refs preserve code and documentation, not infrastructure or data snapshots.
The user confirmed V1 has no authored Omnium/Omnic work requiring migration.
V2 does not access old browser saves or backend records.

For code recovery, inspect/revert the V2 transition through a reviewed commit;
restoring V1 also restores its workflows and can activate its deployment behavior.
Cloudflare retains previous deployment artifacts for operational rollback. Verify
the intended artifact/commit and keep Access enabled. Do not reset Git history or
the Supabase database as rollback.

Before transition: PR #63 is merged, V1 CI/deployment passed, and archive branch/tag
were pushed. Earlier live inspection found Supabase ACTIVE_HEALTHY, a Pages Direct
Upload project, no repository rulesets and `master` reported unprotected. GitHub
Actions variable values could not be read; successful publication is the evidence
for usable release configuration. These are observations, not permanent guarantees.
