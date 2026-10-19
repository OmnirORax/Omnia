import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Visual, VisualAsset } from "./graph/assets";

/** The owner disposes this group, including late asynchronous asset loads. */
export function visualObject(
  visual: Visual,
  assets: VisualAsset[],
  makeText: (text: string) => THREE.Sprite,
  requestRender: () => void,
) {
  const group = new THREE.Group();
  const asset = assets.find((a) => a.id === visual.assetId);
  const fallback = () => {
    if (!group.userData.disposed) {
      const label = makeText("?");
      label.scale.set(1, 1, 1);
      group.add(label);
      group.userData.assetError = true;
      requestRender();
    }
  };
  if (visual.character) {
    const label = makeText(visual.character);
    label.scale.set(Math.min(3, label.userData.aspect), 1, 1);
    group.add(label);
  } else if (asset?.kind === "image") {
    new THREE.TextureLoader().load(
      asset.dataUrl,
      (texture) => {
        if (group.userData.disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            depthTest: false,
          }),
        );
        const aspect = texture.image.width / texture.image.height;
        sprite.scale.set(Math.min(1, aspect), Math.min(1, 1 / aspect), 1);
        group.add(sprite);
        requestRender();
      },
      undefined,
      fallback,
    );
  } else if (asset?.kind === "glb") {
    const buffer = Uint8Array.from(atob(asset.dataUrl.split(",")[1]), (c) =>
      c.charCodeAt(0),
    ).buffer;
    new GLTFLoader().parse(
      buffer,
      "",
      (gltf) => {
        const model = gltf.scene;
        if (group.userData.disposed) {
          disposeVisual(model);
          return;
        }
        const bounds = new THREE.Box3().setFromObject(model),
          size = bounds.getSize(new THREE.Vector3());
        const extent = Math.max(size.x, size.y, size.z);
        if (!Number.isFinite(extent) || extent < 1e-8) {
          disposeVisual(model);
          fallback();
          return;
        }
        const center = bounds.getCenter(new THREE.Vector3());
        model.position.sub(center);
        const normalized = new THREE.Group();
        normalized.add(model);
        normalized.scale.setScalar(1 / extent);
        group.add(normalized);
        requestRender();
      },
      fallback,
    );
  }
  return group;
}
export function disposeVisual(root: THREE.Object3D) {
  root.traverse((object) => {
    object.userData.disposed = true;
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Line ||
      object instanceof THREE.Sprite
    ) {
      object.geometry?.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) value.dispose();
        material.dispose();
      }
    }
  });
}
