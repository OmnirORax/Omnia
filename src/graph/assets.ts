/** Portable presentation resources, never concept identities or relationship semantics. */
export const DEFAULT_SPHERE_DIAMETER = 0.2;
export type VisualAsset = {
  id: string;
  name: string;
  kind: "image" | "glb";
  dataUrl: string;
  source?: string;
};
export type Visual = { assetId?: string; character?: string; showText?: boolean; size?: number };
export const MAX_ASSET_BYTES = 900_000;
export function validateAsset(asset: VisualAsset) {
  if (
    !asset ||
    typeof asset.id !== "string" ||
    !asset.id ||
    asset.id.length > 200 ||
    typeof asset.name !== "string" ||
    asset.name.length > 500 ||
    typeof asset.dataUrl !== "string" ||
    asset.dataUrl.length > MAX_ASSET_BYTES * 1.4 ||
    (asset.source !== undefined && (typeof asset.source !== "string" || asset.source.length > 500))
  )
    throw new Error("Invalid or oversized visual asset (maximum 900 KB per file).");
  const pattern =
    asset.kind === "image"
      ? /^data:image\/(png|svg\+xml|jpeg|webp);base64,[A-Za-z0-9+/=]+$/
      : asset.kind === "glb"
        ? /^data:model\/gltf-binary;base64,[A-Za-z0-9+/=]+$/
        : null;
  if (!pattern?.test(asset.dataUrl))
    throw new Error("Expected an embedded SVG/PNG/JPEG/WebP image or GLB model.");
  if (asset.source !== undefined && !/^https:\/\//.test(asset.source))
    throw new Error("Asset source links must use HTTPS.");
  if (asset.dataUrl.startsWith("data:image/svg+xml")) {
    const svg = atob(asset.dataUrl.split(",")[1]);
    if (
      !/<svg[\s>]/i.test(svg) ||
      /<\s*(script|foreignObject|iframe|image)\b|\bon[a-z]+\s*=|(?:href\s*=\s*["']\s*(?!#|data:))|url\(\s*["']?\s*(?!#)[a-z]/i.test(
        svg,
      )
    )
      throw new Error(
        "Use a self-contained SVG without scripts, external images or active content.",
      );
  }
  if (asset.kind === "glb")
    validateGLB(Uint8Array.from(atob(asset.dataUrl.split(",")[1]), (c) => c.charCodeAt(0)).buffer);
}
export function validateVisual(visual: Visual | undefined, assets: VisualAsset[]) {
  if (visual === undefined) return;
  if (
    !visual ||
    typeof visual !== "object" ||
    (visual.character !== undefined &&
      (typeof visual.character !== "string" || visual.character.length > 64)) ||
    (visual.showText !== undefined && typeof visual.showText !== "boolean") ||
    (visual.size !== undefined &&
      (!Number.isFinite(visual.size) || visual.size < 0.1 || visual.size > 5)) ||
    (visual.assetId !== undefined && !assets.some((a) => a.id === visual.assetId))
  )
    throw new Error("Invalid visual or missing asset reference.");
  if (visual.assetId && visual.character)
    throw new Error("Choose an asset or a character for a visual.");
}
export function validateGLB(buffer: ArrayBuffer) {
  const v = new DataView(buffer);
  if (
    buffer.byteLength < 20 ||
    v.getUint32(0, true) !== 0x46546c67 ||
    v.getUint32(4, true) !== 2 ||
    v.getUint32(8, true) !== buffer.byteLength ||
    v.getUint32(16, true) !== 0x4e4f534a ||
    20 + v.getUint32(12, true) > buffer.byteLength
  )
    throw new Error("Invalid GLB 2 model.");
  const json = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, 20, v.getUint32(12, true))),
  );
  const unsupported = (json.extensionsRequired ?? []).some(
    (extension: string) =>
      ![
        "KHR_lights_punctual",
        "KHR_materials_unlit",
        "KHR_materials_clearcoat",
        "KHR_materials_ior",
        "KHR_materials_iridescence",
        "KHR_materials_sheen",
        "KHR_materials_specular",
        "KHR_materials_transmission",
        "KHR_materials_volume",
        "KHR_materials_emissive_strength",
        "KHR_materials_anisotropy",
        "KHR_texture_transform",
        "EXT_mesh_gpu_instancing",
        "EXT_texture_webp",
        "EXT_texture_avif",
      ].includes(extension),
  );
  if (
    [...(json.buffers ?? []), ...(json.images ?? [])].some(
      (item) => item.uri && !/^data:/.test(item.uri),
    ) ||
    unsupported
  )
    throw new Error(
      "Use a self-contained GLB without unsupported decoder extensions or external files.",
    );
}
export function visualFootprint(label: { width: number; height: number }, visual?: Visual, sphereDiameter = DEFAULT_SPHERE_DIAMETER) {
  const hasObject = !!(visual?.assetId || visual?.character),
    size = visual?.size ?? (hasObject ? 1.4 : sphereDiameter);
  const showText = label.width > 0 && label.height > 0 && visual?.showText !== false;
  const sphere = !hasObject && !showText;
  return {
    sphere,
    depth: sphere || hasObject ? size : 0.05,
    width: Math.max(hasObject || sphere ? size : 0, showText ? label.width : 0),
    height:
      (hasObject || sphere ? size : 0) + (showText ? label.height : 0) + (hasObject && showText ? 0.3 : 0),
  };
}
