import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, parseSave } from "../src/lib/storage.ts";
import { readFileSync } from "node:fs";
const sizes = Array.from({ length: 128 }, (_, i) => 5 + Math.floor(i / 32));
test("the full expanded pool fits the save transfer bound and preserves old saves", () => {
  const pool: { size: number }[] = JSON.parse(
    readFileSync(new URL("../src/lib/boards.json", import.meta.url), "utf8"),
  );
  const expanded = pool.map((board) => board.size);
  assert.equal(expanded.length, 256);
  const save = fresh();
  save.current = 255;
  save.completed = expanded.map((_, at) => at);
  expanded.forEach((size, at) => {
    save.boards[at] = Array(size * size).fill(1);
  });
  assert.deepEqual(parseSave(JSON.stringify(save), expanded), save);
  const old = fresh();
  old.current = 127;
  old.boards[127] = Array(64).fill(0);
  assert.deepEqual(parseSave(JSON.stringify(old), expanded), old);
});
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
