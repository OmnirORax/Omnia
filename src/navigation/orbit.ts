import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
/** OrbitControls updates toward its default origin in the constructor. Preserve
 * the actual view across replacement before applying the retained target. */
export function rebindOrbitControls(camera: THREE.PerspectiveCamera, canvas: HTMLElement, previous: OrbitControls) {
  const position = camera.position.clone(), up = camera.up.clone(), target = previous.target.clone();
  previous.dispose();
  const controls = new OrbitControls(camera, canvas);
  camera.position.copy(position); camera.up.copy(up); controls.target.copy(target);
  controls.enableDamping = false;
  controls.minDistance = previous.minDistance; controls.maxDistance = previous.maxDistance;
  controls.mouseButtons = { ...previous.mouseButtons }; controls.enabled = previous.enabled;
  controls.update(); return controls;
}
