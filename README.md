# Omnium atlas workbench

A local workbench for manually constructing Omnia's hierarchical coupling atlas. React + TypeScript + React Flow, using the existing Vite Plus setup. Opens with an empty graph; no ontology or architecture is pre-populated.

## Run

Use Node 24 and the pinned Yarn 4.18.1 (`packageManager` in `package.json`).

```sh
yarn install --immutable
yarn dev
```

In the prepared Codex cloud environment, use `/workspace/.tools/yarn/node_modules/.bin/yarn` instead of `yarn`. For dependency installation, pass the existing platform proxy bindings as `YARN_HTTP_PROXY="$HTTP_PROXY" YARN_HTTPS_PROXY="$HTTPS_PROXY"` and use `YARN_GLOBAL_FOLDER=/workspace/.cache/yarn`. Never disable TLS or checksum validation.

## Use

- **+ Node** adds a root. Select it to edit its name and notes.
- **+ Child node** adds a nested node. **Parent** changes containment or promotes a node to the root. Moving nodes on the canvas changes layout, not containment.
- Drag nodes to arrange them. Parent containers resize around their children. Use canvas controls to zoom or fit the graph.
- Use a branch arrow to collapse/expand it. External connections attach to the visible collapsed ancestor with a dashed line and ↗ label; original endpoints remain intact. Internal connections are hidden on the canvas while collapsed. The relationship list always retains every relationship.
- Draw a directed relationship from a node's right handle to another's left handle, or use **Connect nodes**. Select a line or relationship-list entry to edit its label/endpoints or delete it. Labels are free text. Parallel relationships, reciprocal connections and self-relationships are allowed.
- Deleting a node asks for confirmation and removes its descendants and all affected relationships. **Undo/Redo** retains up to 50 recent edit snapshots in memory, including imports and deletions. History does not survive reload.
- Edits autosave to this browser's local storage under `omnium.atlas.v1`. **Export JSON** creates a portable backup. **Import JSON** validates before replacing the atlas and asks before replacing a nonempty document. Import replacement can be undone.

Local storage is specific to the browser and origin; it is not cloud storage or collaboration. Export regularly and before changing origins. Storage failures are reported. Unreadable local data is preserved with autosave paused until explicitly replaced.

## Data boundary

`src/graph/model.ts` defines the renderer-independent version-1 `omnium-atlas` JSON contract:

- `nodes`: stable `id`, editable `label`/`notes`, nullable `parentId`, parent-relative `position: {x,y}`, and `collapsed` view state.
- `relationships`: stable `id`, original `source`/`target` node IDs, and editable `label`.
- Containment is a single-parent forest. Relationships are independently directed and can cross any branches or form cycles.

`src/graph/projection.ts` derives visible nodes, container dimensions and collapsed relationship endpoints without changing the document. `src/App.tsx` adapts that projection into React Flow types; React Flow internals, dimensions, selection and drag state are not serialized. Layout/view fields are explicit and can later move to a separate view document without changing node identity or relationship references.

Imports reject unsupported versions, cycles, duplicate IDs, missing references and invalid fields. Prototype safety limits: 5 MB JSON, 2,000 nodes, 10,000 relationships and nesting depth 50. These are validation ceilings, not measured performance guarantees. Child coordinates reserve the parent header (`x >= 24`, `y >= 96`).

This document represents a manually authored private atlas. It does not declare globally accepted concepts or implement canonical entity resolution, AI, quests, governance, shared persistence or a final Omnic grammar. A renderer replacement can reuse the document. Future format changes should introduce an explicit version migration.

## Verify

```sh
yarn test          # Native Node tests for model invariants and collapse projection
yarn typecheck
yarn build
yarn test:browser  # With yarn dev running; uses system Chromium
```

Browser tests use Playwright Core with Chromium at `/usr/bin/chromium`. Set `CHROMIUM_PATH` to another installed Chromium executable and `ATLAS_URL` to a different server address if needed. Tests use a fresh isolated browser context and do not touch an existing user's atlas. They exercise editing, nested containment, collapse, handle connections, reparenting, dragging, reload, JSON export/import, bad imports, undo/redo, deletion and corrupt-save recovery.

The existing Vite Plus alias produces a Yarn peer-version warning; typecheck, build and browser checks verify the actual integration.

## Hosted entry point

The production output is a static website in `dist/`. Asset URLs are relative, so the same build can run at a domain root or under a repository path. No server-side application or API key is needed.

`.github/workflows/deploy-pages.yml` builds and deploys `master` to GitHub Pages after tests pass. In the GitHub repository, select **Settings → Pages → Build and deployment → Source: GitHub Actions**. GitHub Pages must be available for the repository's visibility and account plan; this workflow does not change repository visibility. Merge the workbench/deployment changes into `master` or manually run the workflow there, then use the URL reported by its deployment job. Until that succeeds, there is no verified public entry point.

A Pages deployment normally uses `https://omnirorax.github.io/Omnia/` unless a custom domain or account configuration changes it. Treat that as an expected address, not proof that deployment has completed. The published app shell is accessible to whoever can access the site; atlas contents remain in each visitor's own browser and are not published with the app.

A move to a different origin does not carry browser-local data across. Export JSON before changing hosts and import it at the new origin. The hosted workbench currently has no account login or cross-device sync.
