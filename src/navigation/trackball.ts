import * as THREE from "three";

/** Frozen screen-space sphere, continued over its back hemisphere for full turns. */
export type Trackball = { center: { x: number; y: number }; radius: number; frame: THREE.Quaternion; previous: THREE.Vector3; rotation: THREE.Quaternion; lockedAxis?: THREE.Vector3 };
export function trackballPoint(center: { x: number; y: number }, radius: number, point: { x: number; y: number }) {
  const x = (point.x - center.x) / radius, y = (center.y - point.y) / radius;
  const distance = Math.hypot(x,y), angle = distance * Math.PI / 2;
  const scale = distance > 1e-10 ? Math.sin(angle) / distance : Math.PI / 2;
  return new THREE.Vector3(x * scale, y * scale, Math.cos(angle));
}
export function moveTrackball(ball: Trackball, point: { x: number; y: number }, speed: number, locked = false) {
  if (!locked) ball.lockedAxis = undefined;
  const next = trackballPoint(ball.center, ball.radius, point);
  const delta = new THREE.Quaternion().setFromUnitVectors(ball.previous, next);
  // Scale the shortest incremental turn, then transport from view to world space.
  const sine = Math.hypot(delta.x, delta.y, delta.z);
  if (sine > 1e-10) {
    const axis = new THREE.Vector3(delta.x, delta.y, delta.z).divideScalar(sine).applyQuaternion(ball.frame);
    if (locked && !ball.lockedAxis) ball.lockedAxis = axis.clone();
    const alignment = ball.lockedAxis ? axis.dot(ball.lockedAxis) : 1;
    delta.setFromAxisAngle(ball.lockedAxis ?? axis, 2 * Math.atan2(sine, delta.w) * speed * alignment);
    ball.rotation.premultiply(delta).normalize();
  }
  ball.previous.copy(next);
  return ball.rotation;
}

/** Incremental virtual pointer preserves continuity when Ctrl is pressed/released. */
export type DragConstraint = { raw: {x:number;y:number}; point: {x:number;y:number}; direction?: "x" | "y"; pending?: {x:number;y:number} };
export function constrainDrag(state: DragConstraint, point: {x:number;y:number}, locked: boolean) {
  let dx=point.x-state.raw.x, dy=point.y-state.raw.y;
  state.raw={...point};
  if (!locked) { state.direction=undefined; state.pending=undefined; }
  else {
    if (!state.direction) {
      const pending=state.pending ?? {x:0,y:0};pending.x+=dx;pending.y+=dy;state.pending=pending;
      if (Math.hypot(pending.x,pending.y)<3) return state.point;
      state.direction=Math.abs(pending.x)>=Math.abs(pending.y)?"x":"y";
      dx=pending.x;dy=pending.y;state.pending=undefined;
    }
    if (state.direction==="x") dy=0;else dx=0;
  }
  state.point={x:state.point.x+dx,y:state.point.y+dy};return state.point;
}
