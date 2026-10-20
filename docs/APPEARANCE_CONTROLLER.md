# Shared appearance controller

Open **Theme / aesthetics**. Choose a property above the tree; branches that support it light up. All color inputs are round swatches.

**Animation is an adjuster, like Color.** There is no VFX target branch. Choose **Animation**, target Text, Icons, window surfaces, nodes, binders or the workspace background, then choose an effect. **Lightning text / icons** fills glyphs with moving electric ink; **Lightning outlines** traces their contours. Glyph-only effects exclude incompatible surface targets. Animation speed, density, intensity and color use the same hierarchy, selections and locks.

Animation color/brightness/opacity/glow can be adjusted separately on the same branches. The general Color/Brightness/Opacity/Glow adjusters also update their unlocked animation channels. Selecting an effect never rewrites a branch's ordinary color, font or opacity.

- **● → ○ → ◎ → ●** targets a branch, excludes it, isolates it, then restores other target selections. These controls select what the next adjustment affects; they never erase formatting.
- **⏻** bypasses the branch's stored appearance without deleting its values. Reconnect to restore them. Bypassed properties use their neutral/default presentation, not invisible knowledge.
- **🔒** protects a branch and its descendants from adjustments originating above it. Click for all properties; hover for individual property locks. Deliberate edits at a locked row remain possible. Lower locks still protect descendants.
- Named **appearance sets** remember targeting, exclusions, isolation and last adjuster values. Switching sets does not replay their values. Theme templates save the complete controller and its current presentation.

The shared adjuster applies to included, applicable descendants, respecting lower locks. Leaf swatches/sliders directly edit that target. A category can be isolated to adjust its subtree. Changing color leaves brightness, glow, animation, and other properties alone.

Right-click a frame handle or button and open its existing appearance editor for local refinements. Choose the part and property there. A stable reference to the resident appears under the corresponding category → **Individually customized**, marked **◆** for each locally refined property. An eligible categorical edit replaces that refinement; lock it to protect it. Hover its master entry to reveal and pulse the actual resident, restoring transient expansion and scrolling afterward. Search uses the same reveal mechanism.

## Data and ownership

`appearance.controller.version = 1` is optional in older saved settings. Normalization adds an empty controller while retaining legacy colors, fonts, animation choices and values as the baseline. Existing detached controls keep their IDs and edit the shared registry. Default controls use the tree instead of the former color/animation category dropdowns.

The former `vfx.*` controller entries migrate into animation properties on their corresponding real targets, including local resident references, refinement markers, locks and plugs. VFX-only target selections map to the corresponding branches; saved formatting is retained. The migration is idempotent and preserves existing target colors.

Targets and UI instances reference stable IDs; appearance never changes canonical entities, relationships, placements, frames or coordinates. Instances store their shared target and UI owner; live ownership and titles determine navigation after rearrangement. UI undo/redo covers committed appearance changes; picker/slider previews avoid persistence and history writes until acceptance.

**Omnium settings are defaults.** Authored node/binder appearance wins over default colors. Graph SVG/PNG/GLB assets keep their source palette rather than receiving the node's tint. Brightness, opacity and effects remain independent. This supersedes the earlier SVG tint behavior. UI icons can still receive an explicit UI icon tint.

Theme/UI templates retain target sets, values, local references, locks and plugs. Referenced custom fonts are embedded within the existing template size limits. Instance-specific entries require the corresponding UI resident in the destination layout.

## Extension points

- `src/appearance/registry.ts`: declare a property once (type, validation, limits, neutral value), and list it on applicable targets. Editors, search entries, target highlighting and per-property lock controls derive from this metadata.
- `model.ts`: pure targeting, propagation, rules and validated state normalization. Values are materialized on registered leaves so changing selection does not change presentation.
- `resolve.ts`: resolve saved values, baseline fallbacks, bypass and computed renderer defaults. Computed defaults are never persisted.
- `Styles.tsx`: declarative CSS target bindings and UI icon styling.
- `textScene.ts`, `visualScene.ts`, `structuralSparkles.ts`, `localEffects.ts`: Three.js and animation adapters. A new property still needs an adapter for its rendering behavior; do not advertise unsupported properties on a target.
- `appearance/graphEffects.ts` and `appearance/uiEffects.ts` route actual visual parts to their target properties. Text masks exclude surrounding controls and unrelated text categories. Animation changes keep graph data intact and reuse the existing bounded particle, contour and electric-ink renderers.
- `ContextualEditor.tsx` and `MasterController.tsx` reuse `Controls.tsx` and `LockControl.tsx`.
- `ui/transientReveal.ts`: temporary location reveal shared by search and local master entries.

No backend, new UI framework, graph-schema migration, automatic ontology, or changes to authored knowledge are involved.
