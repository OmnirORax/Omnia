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

/** Fit once in the object's local front plane; node orientation/pivot never change. */
export function frontOnPose(camera: Pick<THREE.PerspectiveCamera, "aspect" | "near"> & { getEffectiveFOV: () => number }, center: THREE.Vector3, orientation: THREE.Quaternion, bounds: THREE.Box3, limits: { min: number; max: number }): CameraPose {
  const inverse = orientation.clone().invert(), tanY = Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV()) / 2), tanX = tanY * camera.aspect;
  let distance = Math.max(limits.min, camera.near * 2);
  if (!bounds.isEmpty()) for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) {
    const p = new THREE.Vector3(x,y,z).sub(center).applyQuaternion(inverse);
    distance = Math.max(distance, p.z + Math.abs(p.x) / tanX * 1.12, p.z + Math.abs(p.y) / tanY * 1.12, p.z + camera.near * 2);
  }
  if (!Number.isFinite(distance) || distance > limits.max) throw new Error("Selection exceeds the camera distance range.");
  return { position: new THREE.Vector3(0,0,distance).applyQuaternion(orientation).add(center), target: center.clone(), up: new THREE.Vector3(0,1,0).applyQuaternion(orientation) };
}
