# Omnium V2

Omnium is being rebuilt in this repository. V2 replaces the website at
https://omnium.nexus and is developed on `master`. V1 is obsolete; its complete
merged source and history remain at [`archive/v1`](https://github.com/OmnirORax/Omnia/tree/archive/v1)
and the `v1-final` tag, both anchored at
`2fab9db610f2e12da766efc34d2d8104e6af51f4` (including PR #63).

## Current scope

This first release is a minimal responsive shell with source/archive links,
TypeScript, Vite and the existing private Cloudflare deployment connection.
It has no editor, graph, selection, DOF controls, persistence or backend client.
The circle on the opening screen is decorative, not an interactive object.
Open the site to see the V2 starting screen; Source opens this repository and
V1 archive opens the preserved implementation. Visual acceptance remains user-owned.

Supabase and Cloudflare resources, secrets, variables, domains and Access policies
are retained. V1 application files, dependencies, instructions and unrelated
workflows are absent from V2. No V1 saved-content migration is required by the user.
The shell does not read, write or clear browser storage or call Supabase.

## Run

Node 24 and npm:

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

`src/main.ts` is the browser entry, `src/style.css` owns the initial shell styles,
and `index.html` supplies accessible page structure. Production output is `dist/`.
Builds include `source.json` with the exact Git commit and dirty-tree status.
No runtime framework or backend SDK is installed yet; add one only for an actual
need. The initial UI does not decide how the eventual world renderer will work.

## Agreed architectural direction

- **Reusable capabilities/DOFs:** establish canonical behavior once, with target
  applicability, composition and on-demand coupling. Avoid independently rebuilding
  selection, transformation and property editing for each system.
- **Editable executable structure:** expose real implementation through Omnic
  inside Omnium from the first reused capability. Start with source-backed editing;
  do not maintain a disconnected architectural diagram as a substitute.
- **Incremental reuse:** inspect a chosen V1 implementation and dependencies,
  bring in the useful part, fix encountered tangles and evaluate the result before
  broadening it. No blanket V1 compatibility or UI recreation requirement.
- **Clean tree, retained ancestry:** the V2 transition is an ordinary descendant
  commit. Old files/instructions are not active just because history is retained.
- **Active publication:** V2 becomes the website immediately; development is not
  held behind a V1 production branch.

Next: choose one small reusable implementation and compare concrete source-backed
editing mechanisms. AST-aware source changes, stable structural identity,
validation, persistence back to the repository and execution/rebuild behavior
remain design questions. Local source writes and hosted editing have different
execution environments; a static Pages build cannot write its own repository.
Keep ordinary source tooling and recovery available throughout the experiment.

## Reuse and infrastructure

Retrieve one file with `git show v1-final:path/to/file`. Inspect its imports,
state/history owners and tests before reuse. Documentation in V1 is historical
evidence and may describe unfinished or superseded behavior.

Retained implementations: V1's favicon and read-only Cloudflare Access preflight.
The deployment workflow is simplified for V2; backend, legacy Pages and native
audio jobs are archived with V1 rather than applied to an empty application.
This does not delete deployed services or alter database schemas.

See [deployment operations](docs/DEPLOYMENT.md) for release behavior, retained
resources, verification limits and recovery.
