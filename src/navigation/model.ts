import * as THREE from "three";
export * from "./options.ts";
import type { NavigationOptions } from "./options.ts";
export type CameraPose = { position: THREE.Vector3; target: THREE.Vector3; up: THREE.Vector3 };
export function navigationRotation(pose: CameraPose, options: NavigationOptions, dx: number, dy: number, pivot: THREE.Vector3) {
  const yaw = -dx * .005 * options.speed, pitch = -dy * .005 * options.speed;
  if (options.axis !== "free") return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Number(options.axis === "x"), Number(options.axis === "y"), Number(options.axis === "z")), yaw - pitch);
  // Transport the complete camera frame through the poles. One axis-angle
  // delta also makes a reversed diagonal drag exactly undo its rotation.
  const forward = (options.mode === "orbit" ? pivot.clone().sub(pose.position) : pose.target.clone().sub(pose.position)).normalize();
  const right = forward.clone().cross(pose.up).normalize();
  const up = right.clone().cross(forward).normalize();
  const angular = up.multiplyScalar(yaw).addScaledVector(right, pitch);
  const angle = angular.length();
  return angle > 0 ? new THREE.Quaternion().setFromAxisAngle(angular.divideScalar(angle), angle) : new THREE.Quaternion();
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
  next.up.applyQuaternion(rotation).normalize();
  return next;
}
