import * as THREE from "three";

/** Frozen screen-space sphere. Outside its rim, motion produces view-axis spin. */
export type Trackball = { center: { x: number; y: number }; radius: number; frame: THREE.Quaternion; previous: THREE.Vector3; rotation: THREE.Quaternion };
export function trackballPoint(center: { x: number; y: number }, radius: number, point: { x: number; y: number }) {
  const x = (point.x - center.x) / radius, y = (center.y - point.y) / radius;
  const length = x * x + y * y;
  return length <= 1 ? new THREE.Vector3(x, y, Math.sqrt(1 - length)) : new THREE.Vector3(x, y, 0).normalize();
}
export function moveTrackball(ball: Trackball, point: { x: number; y: number }, speed: number) {
  const next = trackballPoint(ball.center, ball.radius, point);
  const delta = new THREE.Quaternion().setFromUnitVectors(ball.previous, next);
  // Scale the shortest incremental turn, then transport from view to world space.
  const sine = Math.hypot(delta.x, delta.y, delta.z);
  if (sine > 1e-10) {
    const axis = new THREE.Vector3(delta.x, delta.y, delta.z).divideScalar(sine).applyQuaternion(ball.frame);
    delta.setFromAxisAngle(axis, 2 * Math.atan2(sine, delta.w) * speed);
    ball.rotation.premultiply(delta).normalize();
  }
  ball.previous.copy(next);
  return ball.rotation;
}
