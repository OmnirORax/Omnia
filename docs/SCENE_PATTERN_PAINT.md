# Shared scene pattern paint

The pattern owns its colour connection. Text, frame contours and UI surfaces
reference that shared paint; they do not receive copied colour values. This is
the first small scene-theme module, following the user's scene composition vision:
reusable assets and inherited sub-textures, rather than a separate theme preset
per object. It does not introduce a second scene runtime or change graph identity.

## Try it

1. Open **Master controller → Visuals → Pattern paint**. If selection inspection
   hides general controls, use **Show all controls** first.
2. Choose **Pattern colours → Follow scene image**. With an active scene, the
   preview inherits a dominant/accent pair. Without a ready image it uses the
   labelled manual fallback pair. **Manual pair** disconnects the scene source.
3. Turn on **Apply pattern globally** to paint supported UI sockets at once.
   This is off initially, preserving the existing theme.
4. Try **Ring + dot**, **Alternating dots**, **Checker** and **Stripes**. Spacing,
   fill and text keyline edit the shared pattern. The colour fields edit its
   manual/fallback pair, not the inherited scene colours.
5. For selective use, target the desired visual hierarchy socket and choose
   **Color → Pattern paint**: **Use shared pattern**, **Solid/manual**, or
   **Inherit global**. An explicit use also works with global application off.
   An explicit mode inherits down the hierarchy until overridden.
6. Switch scenes: connected consumers follow the new pair. Switch pattern use off
   to recover their stored ordinary colours. Existing controller Apply/Discard,
   settings history and UI settings export retain their normal ownership.

Colour or pattern locks/bypasses opt that socket out of live pattern paint,
leaving ordinary paint; they do not freeze a multicolour snapshot. Existing
brightness, opacity and translucency still modulate each supported consumer.
Increase a frame's existing contour width to make its dots more visible.

## Owners and future adapters

`scene image → normalization + resting tint → scene.image.palette → paint.pattern
→ registered renderer roles`

- `scene/normalizationCache.ts` supplies a guarded, bounded original-image sample.
- `paint/useScenePalette.ts` applies correction coefficients and the resting low
  scene tint (including Omni mode and optional image tint), then publishes a
  palette signal. Transient audio peaks and spatial effects are excluded to keep
  UI colours stable. Palette analysis settles for 180 ms after source changes.
- `paint/pattern.ts` owns source resolution, colour extraction, four procedural
  recipes and cached SVG tile production. It has no React or DOM dependency.
  A generic palette signal is separate from the current scene adapter.
- `paint/pattern.function.ts` declares configuration once through the shared
  function registry and existing settings/property/preview writers.
- `paint/routing.ts` resolves use/inherit/off against existing hierarchy,
  connection and lock policies. Consumers save the use mode, not the palette.
- `appearance/registry.ts` declares supported text, background and contour roles;
  `appearance/Styles.tsx` is their CSS adapter. Text and surface paint use separate
  clipped layers. Native icon ink and fine character edits retain ordinary paint.

Future renderers must declare a real adapter before exposing applicability.
Future Omnic recipes can supply pattern geometry at this boundary; they are not
implemented by the four built-in presets. Named custom preset libraries and
arbitrary uploaded texture assets are also deferred.

## Limits and budgets

This pass supports registered DOM UI text, borders and surfaces. It does not
texture 3D carriers, icons/emoji, raster artwork, native placeholder/scrollbar
pseudo-elements, or individual character paint. CSS border-image can square
rounded corners and replace dashed border geometry. Very thin borders/small text
may not resolve every motif; adjust spacing, keyline and contour width in preview.
There is no guarantee of local contrast against every region of an image.

Palette work reads at most 4,096 sampled pixels, with separate bounded source and
palette caches (eight each). Tiles cache at most 128 entries. No new dependency,
animation loop, per-node image analysis, pointer-time scan or layout measurement
is introduced. GPU/browser appearance and performance remain user-owned acceptance;
model/type/build checks do not prove visual quality.

## Saved data and privacy

The shared configuration uses existing `WorkspaceSettings.functionValues` under
`paint.pattern`. Per-socket `patternUse` uses existing version-1 controller values.
Absent global application is false; explicit false/zero and ordinary colour
overrides survive. Original images, graph coordinates/IDs, scene assignments,
backend contracts and existing normalization constraints are unchanged.

Palette signals and generated SVGs are disposable memory, never persisted private
cloud derivatives. Existing scene/account guards clear source links. A missing
source uses the fallback pair. No image or graph migration is required. Older
clients ignore these controls and can drop unrecognized settings on rewrite;
existing export/recovery limitations still apply. The uploaded vision document is
not included in public artifacts.
