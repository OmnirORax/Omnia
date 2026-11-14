import * as THREE from "three";

export const DEFAULT_CAMERA_POSITION = new THREE.Vector3(7, 5, 9);
export const DEFAULT_CAMERA_FOV = 55;
const axes = ["x", "y", "z"] as const;
const coordinates = (point: THREE.Vector3) => axes.map(axis => `${axis.toUpperCase()} ${point[axis].toFixed(2)}`).join(" · ");

const rendered = new WeakMap<HTMLElement, string>();
export function updateCameraGuide(element: HTMLElement, camera: THREE.PerspectiveCamera, target: THREE.Vector3, selected?: THREE.Vector3) {
  // Effect-only scene frames must not replace unchanged HUD text. Such writes
  // trigger UI discovery/mask observers and turn every animation tick into a
  // page-wide text rebuild, even with a stationary camera and pointer.
  const signature = [camera.position.x, camera.position.y, camera.position.z,
    camera.quaternion.x, camera.quaternion.y, camera.quaternion.z, camera.quaternion.w,
    camera.near, camera.getEffectiveFOV(), target.x, target.y, target.z,
    selected?.x, selected?.y, selected?.z].join(":");
  if (rendered.get(element) === signature) return;
  rendered.set(element, signature);
  const distance = Math.max(camera.near, camera.position.distanceTo(target));
  const zoom = 100 * DEFAULT_CAMERA_POSITION.length() / distance * Math.tan(THREE.MathUtils.degToRad(DEFAULT_CAMERA_FOV / 2)) / Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV() / 2));
  const set = (name: string, text: string) => { const node = element.querySelector(`[data-camera="${name}"]`); if (node && node.textContent !== text) node.textContent = text; };
  set("zoom", `Zoom ${zoom < 10 ? zoom.toFixed(2) : zoom.toFixed(0)}%`);
  set("direction", coordinates(camera.getWorldDirection(new THREE.Vector3())));
  set("position", coordinates(camera.position));
  set("target", coordinates(target));
  set("node", selected ? coordinates(selected) : "Select a node");
  const attribute = (element: Element, name: string, value: number) => {
    const text = String(value); if (element.getAttribute(name) !== text) element.setAttribute(name, text);
  };
  const inverse = camera.quaternion.clone().invert();
  for (const axis of axes) for (const sign of [-1, 1]) {
    const direction = new THREE.Vector3(); direction[axis] = sign; direction.applyQuaternion(inverse);
    const g = element.querySelector<SVGGElement>(`[data-compass="${axis}:${sign}"]`); if (!g) continue;
    const line = g.querySelector("line")!, label = g.querySelector("text")!;
    attribute(line, "x2", 48 + direction.x * 30); attribute(line, "y2", 48 - direction.y * 30);
    attribute(label, "x", 48 + direction.x * 40);
    attribute(label, "y", Math.hypot(direction.x, direction.y) < 0.15 ? 48 + (direction.z > 0 ? -10 : 10) : 48 - direction.y * 40);
    const opacity = String(direction.z > 0 ? 1 : 0.5);
    if (g.style.opacity !== opacity) g.style.opacity = opacity;
  }
}

