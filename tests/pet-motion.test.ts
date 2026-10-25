import test from "node:test";
import assert from "node:assert/strict";
import { gestures, nextGesture, type Gesture } from "../src/lib/pet-motion.ts";

test("gesture paths use all sixteen frames and return to neutral", () => {
  const used = new Set<number>();
  for (const frames of Object.values(gestures)) {
    assert.equal(frames[0], 0);
    assert.equal(frames.at(-1), 0);
    for (const frame of frames) {
      assert.ok(frame >= 0 && frame < 16);
      used.add(frame);
    }
  }
  assert.equal(used.size, 16);
});

test("fresh randomness changes gestures, speed, rest and tilt without immediate repeats", () => {
  let seed = 713;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  let previous: Gesture | undefined;
  const seen = new Set<Gesture>(),
    waits = new Set<number>(),
    tilts = new Set<number>();
  for (let at = 0; at < 100; at++) {
    const plan = nextGesture(random, previous);
    assert.notEqual(plan.name, previous);
    assert.ok(plan.frameMs >= 65 && plan.frameMs <= 150);
    assert.ok(plan.restMs >= 2200 && plan.restMs <= 8700);
    assert.ok(Math.abs(plan.tilt) <= 3.5);
    assert.deepEqual(plan.frames, gestures[plan.name]);
    previous = plan.name;
    seen.add(plan.name);
    waits.add(plan.restMs);
    tilts.add(plan.tilt);
  }
  assert.equal(seen.size, 5);
  assert.equal(waits.size, 100);
  assert.equal(tilts.size, 100);
});
