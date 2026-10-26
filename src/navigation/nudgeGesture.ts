import * as THREE from "three";
import type { NudgeActionId } from "../workspaceActions.ts";
export type NudgeSnapshot = {
  step: number; frame: THREE.Quaternion;
  preview: (delta: THREE.Vector3) => void;
  restore: () => void;
  commit: (delta: THREE.Vector3) => void;
};
/** One held gesture, no event-count queue or elapsed-time debt after a slow frame. */
export function createNudgeGesture(env: {
  snapshot: () => NudgeSnapshot | null;
  schedule: (tick: (time: number) => void) => number; cancel: (id: number) => void;
  now: () => number;
}) {
  let active: { snapshot: NudgeSnapshot; delta: THREE.Vector3; actions: readonly NudgeActionId[]; last: number; started: number } | null = null;
  let pending: number | undefined, generation = 0;
  const direction = (actions: readonly NudgeActionId[]) => new THREE.Vector3(
    Number(actions.includes("nudgeRight")) - Number(actions.includes("nudgeLeft")),
    Number(actions.includes("nudgeUp")) - Number(actions.includes("nudgeDown")), 0).clampLength(0,1);
  const advance = (amount: number) => {
    if (!active) return;
    const step = direction(active.actions).applyQuaternion(active.snapshot.frame).multiplyScalar(amount * active.snapshot.step);
    if (!step.lengthSq()) return;
    active.delta.add(step); active.snapshot.preview(active.delta);
  };
  const queue = () => {
    if (pending !== undefined || !active) return;
    const token = generation;
    pending = env.schedule(time => {
      if (token !== generation || !active) return;
      pending = undefined;
      // Short press = one normal nudge. Hold begins after a brief repeat delay.
      const elapsed = Math.max(0, Math.min(32, time - Math.max(active.last, active.started + 180)));
      active.last = time;
      advance(elapsed * .012); // 12 steps/sec; capped, never replay missed frames.
      queue();
    });
  };
  const finish = (cancelled = false) => {
    generation++;
    if (pending !== undefined) env.cancel(pending);
    pending = undefined;
    const current = active; active = null;
    if (!current) return;
    current.snapshot.restore();
    if (!cancelled && current.delta.lengthSq() > 1e-12) current.snapshot.commit(current.delta);
  };
  return {
    get active() { return !!active; },
    update(actions: readonly NudgeActionId[]) {
      if (!actions.length) { finish(); return; }
      if (!active) {
        const snapshot = env.snapshot(); if (!snapshot) return;
        const now = env.now(); active = {snapshot, delta:new THREE.Vector3(),actions,last:now,started:now};
        advance(1);
      } else { active.actions = actions; active.last = env.now(); }
      queue();
    },
    finish,
  };
}
