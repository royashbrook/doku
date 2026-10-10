import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, parseSave } from "../src/lib/storage.ts";
const sizes = Array.from({ length: 128 }, (_, i) => 5 + Math.floor(i / 32));
test("progress and settings survive a validated round trip", () => {
  const save = fresh();
  save.skin = "poodles";
  save.completed = [0, 12];
  save.boards["0"] = Array(25).fill(0);
  save.boards["0"][3] = 2;
  assert.deepEqual(parseSave(JSON.stringify(save), sizes), save);
});
test("import rejects oversized input, unknown schemas, unsafe indices and wrong cell values", () => {
  assert.throws(() => parseSave(" ".repeat(100001), sizes));
  for (const patch of [
    { schema: 2 },
    { current: -1 },
    { current: 1.5 },
    { current: 999 },
    { boards: JSON.parse('{"__proto__":[2]}') },
    { boards: { 0: [9] } },
    { completed: [null] },
    { autoCross: "true" },
    { boards: { 0: Array(25).fill(3) } },
  ])
    assert.throws(() =>
      parseSave(JSON.stringify({ ...fresh(), ...patch }), sizes),
    );
});
