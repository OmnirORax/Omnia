import * as THREE from 'three';

/** Signed screen-axis orbit without a fixed world-up pole or pitch clamp. */
export function orbitCamera(camera: THREE.PerspectiveCamera, target: THREE.Vector3, dx: number, dy: number, height: number) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || height <= 0 || (!dx && !dy)) return;
  const scale = 2 * Math.PI / height;
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const rotation = new THREE.Quaternion().setFromAxisAngle(up, -dx * scale)
    .multiply(new THREE.Quaternion().setFromAxisAngle(right, -dy * scale));
  camera.position.sub(target).applyQuaternion(rotation).add(target);
  // Carry screen-up through the same rotation so crossing a pole cannot flip it.
  camera.up.copy(up).applyQuaternion(rotation).normalize();
  camera.lookAt(target);
  camera.updateMatrixWorld();
}
