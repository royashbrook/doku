import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  conflict,
  won,
  solutions,
  hint,
  dailyIndex,
} from "../src/lib/puzzle.ts";
import type { Puzzle, Cell } from "../src/lib/puzzle.ts";
import { generationSolutions } from "../scripts/generation-solutions.ts";
import { extendCore } from "../scripts/generate.ts";
const boards: Puzzle[] = JSON.parse(
  readFileSync(new URL("../src/lib/boards.json", import.meta.url), "utf8"),
);
test("16-square construction preserves a fresh core and every puzzle rule", () => {
  const core = boards.find(
    (board) => board.size === 15 && board.solution[14] % 15 < 14,
  )!;
  const original = structuredClone(core);
  for (let sample = 0; sample < 4; sample++) {
    const board = extendCore(core);
    assert.equal(board.size, 16);
    assert.equal(board.regions.length, 256);
    assert.deepEqual(solutions(board), [board.solution]);
    assert(
      won(
        board,
        board.regions.map((_, at) => (board.solution.includes(at) ? 2 : 0)),
      ),
    );
    for (let region = 0; region < 16; region++) {
      const members = board.regions.flatMap((value, at) =>
        value === region ? [at] : [],
      );
      assert(members.length >= 2);
      const reached = new Set([members[0]]),
        queue = [members[0]];
      for (const at of queue)
        for (const to of members)
          if (
            !reached.has(to) &&
            (Math.abs(at - to) === 16 ||
              (Math.floor(at / 16) === Math.floor(to / 16) &&
                Math.abs(at - to) === 1))
          ) {
            reached.add(to);
            queue.push(to);
          }
      assert.equal(reached.size, members.length);
    }
  }
  assert.deepEqual(core, original);
});
test("offline bit-mask search agrees with gameplay on shipped and ambiguous boards", () => {
  for (const board of boards)
    assert.deepEqual(generationSolutions(board), solutions(board));
  for (const size of [5, 8, 12, 16]) {
    const regions = Array.from({ length: size * size }, (_, at) =>
      Math.floor(at / size),
    );
    assert.deepEqual(
      generationSolutions({ size, regions }),
      solutions({ size, regions }),
    );
    const impossible = { size, regions: Array(size * size).fill(0) };
    assert.deepEqual(generationSolutions(impossible), []);
  }
  let seed = 0x131616;
  for (let sample = 0; sample < 100; sample++) {
    const size = 5 + (sample % 4);
    const regions = Array.from({ length: size * size }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % size;
    });
    assert.deepEqual(
      generationSolutions({ size, regions }),
      solutions({ size, regions }),
    );
  }
});
test("the entire shipped pool has one solution, one pet per region and connected regions", () => {
  assert.equal(boards.length, 256);
  for (const size of [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
    assert.equal(
      boards.filter((board) => board.size === size).length,
      size < 9 ? 32 : 16,
    );
  assert.equal(
    createHash("sha256")
      .update(JSON.stringify(boards.slice(0, 128)))
      .digest("hex"),
    "3a3bf378ce64efd154895ecdf46fd14279252edc960551877b44f3480e043d37",
  );
  assert.equal(
    createHash("sha256")
      .update(JSON.stringify(boards.slice(0, 192)))
      .digest("hex"),
    "c0e20b9dd5b977529bfe9dff2de670b66fd495ddeaf41d103a48adf212a7531f",
  );
  for (const board of boards) {
    assert.deepEqual(solutions(board, undefined, 2), [board.solution]);
    assert.equal(new Set(board.regions).size, board.size);
    for (let region = 0; region < board.size; region++) {
      const members = board.regions.flatMap((v, i) =>
          v === region ? [i] : [],
        ),
        visited = new Set([members[0]]),
        queue = [members[0]];
      if (board.size >= 13) assert(members.length >= 2);
      for (const at of queue)
        for (const next of members)
          if (
            !visited.has(next) &&
            ((Math.floor(at / board.size) === Math.floor(next / board.size) &&
              Math.abs(at - next) === 1) ||
              Math.abs(at - next) === board.size)
          ) {
            visited.add(next);
            queue.push(next);
          }
      assert.equal(visited.size, members.length);
    }
    const cells: Cell[] = board.regions.map((_, at) =>
      board.solution.includes(at) ? 2 : 0,
    );
    assert(won(board, cells));
    assert.equal(hint(board, cells), null);
  }
});
test("rules reject adjacent, diagonal, same region, same row and same column", () => {
  const b = boards[0];
  assert(conflict(b, 0, 1));
  assert(conflict(b, 0, b.size));
  assert(conflict(b, 0, b.size + 1));
  for (const a of b.solution)
    for (const c of b.solution) if (a !== c) assert(!conflict(b, a, c));
});
test("hints finish every board and recover from a wrong mark or a misplaced pet", () => {
  for (const board of boards) {
    const cells: Cell[] = board.regions.map(() => 0);
    for (let step = 0; step < board.size; step++) {
      const h = hint(board, cells)!;
      assert.equal(h.action, "place");
      assert(board.solution.includes(h.index));
      cells[h.index] = 2;
    }
    assert(won(board, cells));
    cells[board.solution[0]] = 1;
    assert.equal(hint(board, cells)?.action, "clear");
    cells.fill(0);
    const wrong = cells.findIndex((_, i) => !board.solution.includes(i));
    cells[wrong] = 2;
    assert.equal(hint(board, cells)?.index, wrong);
    assert.equal(hint(board, cells)?.action, "clear");
  }
});
test("daily selection is deterministic and stays inside the finite verified pool for three years", () => {
  for (let d = 0; d < 1095; d++) {
    const day = new Date(Date.UTC(2026, 9, 9 + d)).toISOString().slice(0, 10),
      at = dailyIndex(day, boards.length);
    assert(at >= 0 && at < boards.length);
    assert.equal(at, dailyIndex(day, boards.length));
  }
});
test("an independent permutation oracle confirms uniqueness across the pool", () => {
  // No calls to the shipped solver or conflict predicate in this oracle.
  for (const size of [5, 6, 7, 8]) {
    const permutations: number[][] = [];
    function permute(columns: number[]) {
      if (columns.length === size) {
        permutations.push(columns.map((column, row) => row * size + column));
        return;
      }
      for (let column = 0; column < size; column++)
        if (
          !columns.includes(column) &&
          (!columns.length || Math.abs(column - columns.at(-1)!) > 1)
        )
          permute([...columns, column]);
    }
    permute([]);
    for (const board of boards.filter((board) => board.size === size)) {
      const witnesses = permutations.filter(
        (candidate) =>
          new Set(candidate.map((at) => board.regions[at])).size === size,
      );
      assert.deepEqual(witnesses, [board.solution]);
    }
  }
});
test("the solver refuses impossible boards and detects ambiguous boards", () => {
  const regions = Array.from({ length: 25 }, (_, at) => Math.floor(at / 5));
  assert.equal(solutions({ size: 5, regions }, undefined, 2).length, 2);
  assert.deepEqual(solutions({ size: 5, regions: Array(25).fill(0) }), []);
});
test("an independent region-first oracle verifies every larger board", () => {
  // Region-first enumeration is independent of the runtime's row/region minimum-domain search.
  for (const board of boards.filter((board) => board.size >= 9)) {
    const regions = Array.from({ length: board.size }, (_, region) =>
      board.regions.flatMap((value, at) => (value === region ? [at] : [])),
    ).sort((a, b) => a.length - b.length);
    const placed: number[] = [],
      witnesses: number[][] = [];
    function visit(region: number) {
      if (region === board.size) {
        witnesses.push([...placed].sort((a, b) => a - b));
        return;
      }
      for (const at of regions[region]) {
        const row = Math.floor(at / board.size),
          column = at % board.size;
        if (
          placed.some((other) => {
            const otherRow = Math.floor(other / board.size),
              otherColumn = other % board.size;
            return (
              row === otherRow ||
              column === otherColumn ||
              (Math.abs(row - otherRow) <= 1 &&
                Math.abs(column - otherColumn) <= 1)
            );
          })
        )
          continue;
        placed.push(at);
        visit(region + 1);
        placed.pop();
      }
    }
    visit(0);
    assert.deepEqual(witnesses, [board.solution]);
    // Forced placements on both sides of unassigned rows exercise nonsequential search.
    const cells: Cell[] = board.regions.map(() => 0);
    cells[board.solution[1]] = 2;
    cells[board.solution[board.size - 2]] = 2;
    assert.deepEqual(solutions(board, cells), [board.solution]);
    cells[board.solution[0]] = 1;
    assert.deepEqual(solutions(board, cells), []);
  }
});

test("explained hints solve nearly every board by plain logic, and every step is sound", () => {
  let solved = 0;
  for (const board of boards as Puzzle[]) {
    const cells: Cell[] = board.regions.map(() => 0);
    while (!won(board, cells)) {
      const h = hint(board, cells)!;
      assert.ok(board.solution.includes(h.index));
      if (!h.steps) break;
      // Replay the explanation: no step rules out a pet square, and the last
      // step's row, column or color has only the hinted square left.
      const out = new Set<number>(
        cells.flatMap((v, i) =>
          v === 1 || cells.some((p, j) => p === 2 && conflict(board, j, i))
            ? [i]
            : [],
        ),
      );
      // Before why? the hint only claims one square is left when the board
      // already shows that.
      const open = h.steps.at(-1)!.focus.filter((i) => !out.has(i));
      assert.equal(
        h.text.includes("one square is left"),
        open.length === 1,
        h.text,
      );
      for (const step of h.steps) {
        for (const i of step.out) {
          assert.ok(
            !board.solution.includes(i),
            "a step ruled out a pet square",
          );
          out.add(i);
        }
      }
      const last = h.steps.at(-1)!;
      assert.deepEqual(
        last.focus.filter((i) => !out.has(i)),
        [h.index],
      );
      cells[h.index] = 2;
    }
    if (won(board, cells)) solved++;
  }
  assert.ok(solved >= 254, `${solved} boards solved by explained hints`);
});
