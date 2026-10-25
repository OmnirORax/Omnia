// Reproducible CPU microbenchmark, not a browser/frame-rate measurement.
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { emptyController, ancestry, included, connected, applyValue, createHierarchyIndex } from '../src/appearance/model.ts';
import { controllerTargets, instanceId } from '../src/appearance/registry.ts';

const fixture = count => {
  let state = emptyController();
  for (let i = 0; i < count; i++) {
    const id = instanceId('text.ui.buttons', `function:perf-${i}`);
    state.instances[id] = { base: 'text.ui.buttons', owner: `function:perf-${i}`, label: `Text ${i}`, path: ['window:theme'] };
  }
  const targets = controllerTargets(state);
  state = applyValue(state, targets, 'brightness', 1.5, 'text');
  return { state, targets };
};
const time = fn => { const start = performance.now(); const result = fn(); return { ms: Number((performance.now() - start).toFixed(3)), result }; };
const legacy = process.argv.includes("--legacy");
const rows = [];
for (const count of [0, 100, 500, 1000]) {
  const { state, targets } = fixture(count), set = state.sets[0];
  const hierarchy = time(() => {
    if (!legacy) return createHierarchyIndex(targets);
    const paths = new Map(targets.map(target => [target.id, ancestry(targets, target.id)]));
    return new Map(targets.map(target => [target.id, targets.filter(child => paths.get(child.id).includes(target.id))]));
  });
  const policy = time(() => {
    const index = legacy ? undefined : hierarchy.result.index;
    let allowed = 0;
    for (const target of targets) {
      included(set, targets, target.id, index);
      for (const property of target.properties ?? []) if (connected(state, targets, target.id, property, index)) allowed++;
    }
    return allowed;
  });
  const repeat = time(() => applyValue(state, targets, 'brightness', 1.5, 'text'));
  rows.push({ localTargets: count, targets: targets.length, hierarchy_ms: hierarchy.ms, policies_ms: policy.ms, noop_apply_ms: repeat.ms, noop_reuses_state: repeat.result === state });
}
console.log(JSON.stringify({ node: process.version, kind: 'CPU microbenchmark; cold fixture snapshots', implementation: legacy ? 'legacy indexing pattern' : 'shared index', rows }, null, 2));
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
if (output) writeFileSync(output, JSON.stringify(rows, null, 2));
