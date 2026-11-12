import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutomaticPulse } from '../src/scene/pulse.ts';
import { createBassDynamics } from '../src/scene/vfx.ts';

test('faint repeated sounds stay below pulse and bounce admission even after adaptation', () => {
  const pulse = createAutomaticPulse(), bass = createBassDynamics();
  for (let frame = 0; frame < 3600; frame++) {
    const level = frame % 6 < 3 ? .008 : 0;
    assert.equal(pulse.sample(level, 1/60, 8, 1.7, level, level), 0);
    assert.equal(bass.sample(level, 1/60), 0);
  }
});

test('audible transients still react and near-floor sounds have a soft response', () => {
  const faint = createAutomaticPulse().sample(.012, 1/60, 8, 1.7);
  const strong = createAutomaticPulse().sample(.1, 1/60, 8, 1.7);
  assert.ok(faint >= 0 && faint < .05);
  assert.ok(strong > 1 && strong <= 1.7);
  const bass = createBassDynamics();
  assert.ok(bass.sample(.012, 1/60) < .05);
  assert.ok(bass.sample(.1, 1/60) > .9);
});

test('sustained tones stop flashing and silence releases bounce immediately', () => {
  const pulse = createAutomaticPulse(), bass = createBassDynamics();
  assert.ok(pulse.sample(.1, 1/60, 8, 1.7) > 0);
  assert.equal(pulse.sample(.1, 1/60, 8, 1.7, 0, .1), 0);
  bass.sample(.5, 1/60);
  assert.equal(bass.sample(0, 1/60), 0);
  pulse.reset(); bass.reset();
  assert.equal(pulse.sample(.008, 1/60, 8, 1.7), 0);
  assert.equal(bass.sample(.008, 1/60), 0);
});
