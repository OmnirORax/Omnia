# Omnium atlas workbench

A local workbench for manually constructing Omnia's hierarchical coupling atlas. It has a 2D editor and an interactive 3D workspace over the same graph. React + TypeScript + React Flow + Three.js, using the existing Vite Plus setup. Opens with an empty graph; no ontology or architecture is pre-populated. See [PROJECT_DIRECTION.md](PROJECT_DIRECTION.md) for long-term constraints.

## Run

Use Node 24 and the pinned Yarn 4.18.1 (`packageManager` in `package.json`).

```sh
yarn install --immutable
yarn dev
```

In the prepared Codex cloud environment, use `/workspace/.tools/yarn/node_modules/.bin/yarn` instead of `yarn`. For dependency installation, pass the existing platform proxy bindings as `YARN_HTTP_PROXY="$HTTP_PROXY" YARN_HTTPS_PROXY="$HTTPS_PROXY"` and use `YARN_GLOBAL_FOLDER=/workspace/.cache/yarn`. Never disable TLS or checksum validation.

## Use

Use the **2D / 3D** buttons in the toolbar to switch views. The 2D editor remains available while the 3D workspace develops. In 3D, drag empty space to rotate, right-drag to pan, scroll to zoom, and use **Fit 3D view** to recenter. Click a node to select it; drag it to change its XYZ position. The selected node's inspector also exposes numeric local X, Y and Z fields. Children appear within translucent 3D containment volumes, and relationships render as directed links. Collapsing a branch keeps its connections attached to the visible ancestor.

- **+ Node** adds a root. Select it to edit its name and notes.
- **+ Child node** adds a nested node. **Parent** changes containment or promotes a node to the root. Moving nodes on the canvas changes layout, not containment.
- Drag nodes to arrange them. Parent containers resize around their children. Use canvas controls to zoom or fit the graph.
- Nodes can be freely moved on the canvas. **Snap** is enabled by default; choose an 8–64 px grid or turn it off for unconstrained placement. Canvas pan and zoom are also retained locally.
- Use a branch arrow to collapse/expand it. External connections attach to the visible collapsed ancestor with a dashed line and ↗ label; original endpoints remain intact. Internal connections are hidden on the canvas while collapsed. The relationship list always retains every relationship.
- Draw a directed relationship from a node's right handle to another's left handle, or use **Connect nodes**. Select a line or relationship-list entry to edit its label/endpoints or delete it. Labels are free text. Parallel relationships, reciprocal connections and self-relationships are allowed.
- Deleting a node asks for confirmation and removes its descendants and all affected relationships. **Undo/Redo** retains up to 50 recent edit snapshots in memory, including imports and deletions. History does not survive reload.
- Edits autosave to this browser's local storage under `omnium.atlas.v1`. **Export JSON** creates a portable backup. **Import JSON** validates before replacing the atlas and asks before replacing a nonempty document. Import replacement can be undone.
- **Save UI template** exports the atlas together with node layout, collapsed state, snap settings, grid size, and canvas viewport. **Load UI template** restores that complete working arrangement after validation. It is a portable starting configuration, not a separate server-side workspace.

Local storage is specific to the browser and origin; it is not cloud storage or collaboration. Export regularly and before changing origins. Storage failures are reported. Unreadable local data is preserved with autosave paused until explicitly replaced.

## Data boundary

`src/graph/model.ts` defines the renderer-independent version-1 `omnium-atlas` JSON contract:

- `nodes`: stable `id`, editable `label`/`notes`, nullable `parentId`, parent-relative 2D `position: {x,y}`, optional parent-relative `spatialPosition: {x,y,z}`, and `collapsed` view state.
- `relationships`: stable `id`, original `source`/`target` node IDs, and editable `label`.
- Containment is a single-parent forest. Relationships are independently directed and can cross any branches or form cycles.

`src/graph/projection.ts` derives the 2D view. `src/graph/spatial.ts` derives world XYZ coordinates and visible 3D relationships. `src/App.tsx` adapts the former into React Flow; `src/SpatialWorkspace.tsx` renders the latter with Three.js. Neither renderer determines node identity or relationship meaning. Three.js loads only when 3D is opened. Renderer internals are not serialized.

Old version-1 files have no XYZ fields and load unchanged. Their initial 3D layout is derived from 2D X/Y plus hierarchy depth; this is a visual fallback, not semantic data. Editing a 3D position persists an optional XYZ field without changing 2D coordinates. XYZ is local to the parent, so moving a parent carries its descendants. Reparenting an authored XYZ node preserves its world location. This parent-local coordinate convention is the main decision that would require a migration if changed later. The axes and fallback spacing can evolve without changing graph identities. Layout fields are explicit and could be extracted into separate view documents later.

Imports reject unsupported versions, cycles, duplicate IDs, missing references and invalid fields. Prototype safety limits: 5 MB JSON, 2,000 nodes, 10,000 relationships and nesting depth 50. These are validation ceilings, not measured performance guarantees. Child coordinates reserve the parent header (`x >= 24`, `y >= 96`).

This document represents a manually authored private atlas. It does not declare globally accepted concepts or implement canonical entity resolution, AI, quests, governance, shared persistence or a final Omnic grammar. A renderer replacement can reuse the document. Future format changes should introduce an explicit version migration.

## Verify

```sh
yarn test          # Native Node tests for model invariants and collapse projection
yarn typecheck
yarn build
yarn test:browser  # With yarn dev running; uses system Chromium
yarn test:3d      # With yarn dev running; uses Chromium with WebGL
```

Browser tests use Playwright Core with Chromium at `/usr/bin/chromium`. Set `CHROMIUM_PATH` to another installed Chromium executable and `ATLAS_URL` to a different server address if needed. Tests use a fresh isolated browser context and do not touch an existing user's atlas. They exercise editing, nested containment, collapse, handle connections, reparenting, dragging, reload, JSON export/import, bad imports, undo/redo, deletion and corrupt-save recovery.
The 3D check exercises rendering, rotation, panning, zooming, XYZ persistence, and switching back to 2D. Browsers need WebGL for the 3D workspace; the 2D editor remains usable if WebGL is unavailable.

The existing Vite Plus alias produces a Yarn peer-version warning; typecheck, build and browser checks verify the actual integration.

## Hosted entry point

The production output is a static website in `dist/`. Asset URLs are relative, so the same build can run at a domain root or under a repository path. No server-side application or API key is needed.

`.github/workflows/deploy-pages.yml` builds and deploys `master` to GitHub Pages after tests pass. The repository's Pages source is already configured to use GitHub Actions.

The current entry point is `https://omnirorax.github.io/Omnia/`. The published app shell is accessible to whoever can access the site; atlas contents remain in each visitor's own browser and are not published with the app.

A move to a different origin does not carry browser-local data across. Export JSON before changing hosts and import it at the new origin. The hosted workbench currently has no account login or cross-device sync.
