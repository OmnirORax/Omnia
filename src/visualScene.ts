import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Visual, VisualAsset } from "./graph/assets";

/** The owner disposes this group, including late asynchronous asset loads. */
export function visualObject(
  visual: Visual,
  assets: VisualAsset[],
  makeText: (text: string) => THREE.Object3D,
  requestRender: () => void,
  appearance: { color?: string; opacity?: number; brightness?: number; textColor?: string; textGlow?: number } = {},
) {
  const group = new THREE.Group();
  const restyle: (() => void)[] = [];
  group.userData.setAppearance = (next: typeof appearance) => {
    appearance = next;
    for (const update of restyle) update();
  };
  const styleText = (label: THREE.Object3D) => {
    const update = () => {
      label.userData.setTextStyle?.(appearance.color ?? appearance.textColor ?? "#ffffff", appearance.textColor ?? appearance.color ?? "#ffffff", appearance.textGlow ?? 0);
      if (label instanceof THREE.Mesh) label.material.opacity = appearance.opacity ?? 1;
    };
    restyle.push(update);
    if (appearance.textColor !== undefined) update();
  };
  const asset = assets.find((a) => a.id === visual.assetId);
  const fallback = () => {
    if (!group.userData.disposed) {
      const label = makeText("?");
      label.scale.set(1, 1, 1);
      group.add(label); styleText(label);
      group.userData.assetError = true;
      requestRender();
    }
  };
  if (visual.character) {
    const label = makeText(visual.character);
    if (label instanceof THREE.Mesh) label.material.opacity = appearance.opacity ?? 1;
    label.scale.set(Math.min(3, label.userData.aspect), 1, 1);
    group.add(label); styleText(label);
  } else if (asset?.kind === "image") {
    new THREE.TextureLoader().load(
      asset.dataUrl,
      (texture) => {
        if (group.userData.disposed) {
          texture.dispose();
          return;
        }
        // SVGs can decode correctly in HTML/canvas yet upload blank to WebGL.
        // Rasterize their portable source once before creating the sprite texture.
        let map: THREE.Texture = texture;
        let repaint: ((color?: string) => void) | undefined;
        if (asset.dataUrl.startsWith("data:image/svg+xml")) {
          const image = texture.image as HTMLImageElement;
          const canvas = document.createElement("canvas");
          const width = image.naturalWidth || image.width || 256,
            height = image.naturalHeight || image.height || 256;
          const scale = 512 / Math.max(width, height);
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const context = canvas.getContext("2d");
          if (!context) {
            texture.dispose();
            fallback();
            return;
          }
          let previousColor: string | undefined;
          repaint = (color) => {
            if (previousColor === color && map instanceof THREE.CanvasTexture) return;
            previousColor = color;
            context.globalCompositeOperation = "source-over"; context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            if (color) { context.globalCompositeOperation = "source-in"; context.fillStyle = color; context.fillRect(0, 0, canvas.width, canvas.height); }
            map.needsUpdate = true;
          };
          repaint(appearance.color);
          map = new THREE.CanvasTexture(canvas);
          texture.dispose();
        }
        map.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            map,
            color: asset.dataUrl.startsWith("data:image/svg+xml") ? 0xffffff : appearance.color ?? 0xffffff,
            opacity: appearance.opacity ?? 1,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            side: THREE.DoubleSide,
          }),
        );
        const dimensions = map.image as { width: number; height: number };
        const aspect = dimensions.width / dimensions.height;
        sprite.scale.set(Math.min(1, aspect), Math.min(1, 1 / aspect), 1);
        group.add(sprite);
        restyle.push(() => {
          repaint?.(appearance.color);
          sprite.material.color.set(repaint ? "#ffffff" : appearance.color ?? "#ffffff");
          sprite.material.color.multiplyScalar(appearance.brightness ?? 1);
          sprite.material.opacity = appearance.opacity ?? 1;
        });
        restyle.at(-1)!();
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
        model.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            const color = "color" in material ? (material.color as THREE.Color).clone() : undefined;
            const opacity = material.opacity;
            const update = () => {
              if (color) (material as THREE.MeshStandardMaterial).color.copy(appearance.color ? new THREE.Color(appearance.color) : color).multiplyScalar(appearance.brightness ?? 1);
              material.opacity = opacity * (appearance.opacity ?? 1); material.transparent ||= material.opacity < 1;
            };
            restyle.push(update); update();
          }
        });
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
