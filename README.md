# Omnium structural workbench

A local, interactive 3D atlas for charting systems. React, TypeScript, Three.js and Vite Plus power the current workbench. Its version-2 JSON document is independent of the renderer and provisional English labels. [PROJECT_DIRECTION.md](PROJECT_DIRECTION.md) records the long-term constraints.

## Run and verify

Use Node 24 and Yarn 4.18.1, then run `yarn install --immutable` and `yarn dev`. In the prepared Codex cloud environment, Yarn is at `/workspace/.tools/yarn/node_modules/.bin/yarn`; existing dependencies are installed. Verify with `yarn test`, `yarn typecheck`, `yarn build`, `yarn test:browser`, and `yarn test:3d`. Browser checks require the dev server and Chromium (default `/usr/bin/chromium`; override with `CHROMIUM_PATH`).

The app opens directly in 3D. Drag empty space to rotate, right-drag to pan, scroll to zoom, and drag a node to move it. Use **Fit 3D view** to recenter. The inspector edits XYZ directly. All edits autosave in this browser under `omnium.atlas.v2`; export JSON for a portable backup. Version-1 local saves and imports migrate into version 2 without overwriting the original `omnium.atlas.v1` key. Existing 2D positions survive as legacy layout fields and as an XYZ fallback, although the 2D editor is retired. Version-1 UI templates still import; new templates store the version-2 atlas and placement layout.

## Authoring

- **+ Node** creates a structural identity and its first placement. **+ Child node** additionally charts structural containment. A placement's **Parent** only changes visual nesting; **Structural container** edits the authored composition fact separately.
- **Reuse identity** finds an existing identity by ID, label or alias and adds another placement. Its original knowledge and internals are not copied. The inspector shows identity and placement IDs, charted contents and relations, and can navigate to another placement or a subsystem component. Hiding or removing one placement leaves the identity and other references intact. **Delete identity and all references** is a separate, undoable operation.
- **Connect nodes** charts a relationship between identities, independent of the connector. Define provisional relationship types with stable IDs, role IDs, names, symbols and definitions. Select a relationship from the list to change its type, roles, endpoints or annotation. Parallel, reciprocal, cyclic and cross-boundary relationships are valid.
- **Investigative frames** select existing identities and relationships around a question or objective. Select a node before starting to anchor the frame; use lookup to include more identities, choose relationships, adjust depth, exclude, lock, reopen, restore earlier scope, promote or discard. Frames reference knowledge without copying it. Locking affects the frame scope, not the atlas. Reopening reports missing entity references. An unpromoted frame persists until explicitly discarded.
- **External AI proposal** accepts a JSON change set, validates it, shows the operation preview, and requires explicit approval before atomic application. Undo is available. Structural validation does not establish that a claim is true.

Local storage is browser- and origin-specific, with no account or backend. Export before changing origins. If a local save is unreadable, autosave pauses and preserves the unreadable value until the user explicitly replaces it. Undo/redo retains up to 50 snapshots in memory; it does not survive reload.

## Data and AI contract

`src/graph/structural.ts` defines version-2 `omnium-atlas` documents. `entities` hold canonical identity, label, aliases and notes. `compositions` chart structural containment by entity ID. `placements` separately hold placement IDs, identity references, visual parent, 2D/3D coordinates, collapsed and hidden state. `relationshipTypes` hold stable types and participant roles. `relationships` hold typed instances with entity participants and optional qualifier IDs. `frames` hold references, exclusions, depth, lock/promotion state, saved revision and scope history. `revision` changes on each committed edit. No meaning is inferred from position, visual parent, label or symbol.

`src/graph/model.ts` retains the version-1 parser and editor adapter for migration. `src/graph/spatial.ts` derives the 3D projection from placements; `src/SpatialWorkspace.tsx` renders it. If one identity has multiple visible placements, connectors deterministically use the visible placement with the lowest lexical placement ID. When a nested endpoint is collapsed, the connector uses its visible ancestor; the relationship instance never changes. Replacing the 3D renderer requires no migration of identities or relationships.

An external AI can export/read the atlas and submit an `omnium-changeset` with `version: 1`, a stable proposal `id`, `baseRevision` matching the atlas, and an `operations` array. Supported operations: `createEntity`, `addPlacement` (including reuse of an existing entity), `addComposition`, `createRelationshipType`, `createRelationship`, `updateRelationship`, `updatePlacement`, `createFrame`, and `refineFrame`. Updates include an exact `expected` object or `expectedScope` precondition. See [changeset.ts](src/graph/changeset.ts) and [round-trip test](tests/structural.test.mjs) for the executable contract. Operations validate in order, so referenced entities/types must already exist or be created earlier in the same change set. Stale or invalid proposals leave the atlas unchanged. A proposal can be pasted into the UI, reviewed, approved and exported as a new atlas.

The v1 migration records each old `parentId` as both visual nesting and structural composition, preserving authored containment. Old untyped relationship labels remain instance annotations under the stable `legacy-untyped` type; migration does not guess whether “requires” meant causal dependency. The current 3D XYZ positions are parent-local; changing that convention later would require a placement-layout migration. Types, participants, identities and frames are renderer independent and do not fix Omnic grammar.

The app enforces a 5 MB JSON import limit, 2,000 identities, 4,000 placements, 10,000 relationships, and maximum visual nesting depth 50. It provides structural/reference validation, deterministic lookup, and human approval, but no automatic entity matching, epistemic verification, simulation, online collaboration or final Omnic notation.

## Hosted entry point

`.github/workflows/deploy-pages.yml` builds and deploys `master` to GitHub Pages. The current static entry point is `https://omnirorax.github.io/Omnia/`. Each visitor's atlas remains in that visitor's browser and is not published with the app.
