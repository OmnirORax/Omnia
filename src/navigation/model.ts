import * as THREE from "three";
export * from "./options.ts";
import type { NavigationOptions } from "./options.ts";
export type CameraPose = { position: THREE.Vector3; target: THREE.Vector3; up: THREE.Vector3 };
export function navigationRotation(pose: CameraPose, options: NavigationOptions, dx: number, dy: number, pivot: THREE.Vector3) {
  const yaw = -dx * .005 * options.speed, pitch = -dy * .005 * options.speed;
  if (options.axis !== "free") return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Number(options.axis === "x"), Number(options.axis === "y"), Number(options.axis === "z")), yaw - pitch);
  const direction = (options.mode === "orbit" ? pose.position.clone().sub(pivot) : pose.target.clone().sub(pose.position));
  if (options.upright && (options.mode === "orbit" || options.mode === "look") && direction.lengthSq() > 1e-10) {
    const sphere = new THREE.Spherical().setFromVector3(direction);
    sphere.theta += yaw; sphere.phi = Math.max(.01, Math.min(Math.PI - .01, sphere.phi + (options.mode === "look" ? -pitch : pitch)));
    return new THREE.Quaternion().setFromUnitVectors(direction.normalize(), new THREE.Vector3().setFromSpherical(sphere).normalize());
  }
  const forward = pose.target.clone().sub(pose.position).normalize();
  const right = forward.clone().cross(pose.up).normalize();
  return new THREE.Quaternion().setFromAxisAngle(pose.up.clone().normalize(), yaw)
    .multiply(new THREE.Quaternion().setFromAxisAngle(right, pitch));
}
export function navigateCamera(pose: CameraPose, options: NavigationOptions, dx: number, dy: number, pivot: THREE.Vector3): CameraPose {
  const next = { position: pose.position.clone(), target: pose.target.clone(), up: pose.up.clone() };
  if (options.mode === "walk" || options.mode === "pan") {
    const forward = pose.target.clone().sub(pose.position).normalize();
    const right = forward.clone().cross(options.upright && options.mode === "walk" ? new THREE.Vector3(0,1,0) : pose.up).normalize();
    if (options.upright && options.mode === "walk") next.up.set(0,1,0);
    if (options.upright && options.mode === "walk") { forward.y = right.y = 0; forward.normalize(); right.normalize(); }
    const vertical = options.mode === "pan" ? pose.up.clone().normalize() : forward;
    const step = right.multiplyScalar((options.mode === "pan" ? -dx : dx) * .02 * options.speed).addScaledVector(vertical, (options.mode === "pan" ? dy : -dy) * .02 * options.speed);
    if (options.axis !== "free") {
      const amount = (dx - dy) * .02 * options.speed * (options.mode === "pan" ? -1 : 1);
      step.set(Number(options.axis === "x") * amount, Number(options.axis === "y") * amount, Number(options.axis === "z") * amount);
    }
    next.position.add(step); next.target.add(step); return next;
  }
  const rotation = navigationRotation(pose, options, dx, dy, pivot);
  if (options.mode === "orbit") { next.position.sub(pivot).applyQuaternion(rotation).add(pivot); next.target.copy(pivot); }
  else { next.target.sub(pose.position).applyQuaternion(rotation).add(pose.position); }
  if (options.upright && options.axis === "free") next.up.set(0, 1, 0); else next.up.applyQuaternion(rotation).normalize();
  return next;
}
