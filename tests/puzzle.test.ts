import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  conflict,
  won,
  solutions,
  hint,
  dailyIndex,
} from "../src/lib/puzzle.ts";
import type { Puzzle, Cell } from "../src/lib/puzzle.ts";
const boards: Puzzle[] = JSON.parse(
  readFileSync(new URL("../src/lib/boards.json", import.meta.url), "utf8"),
);
test("the entire shipped pool has one solution, one pet per region and connected regions", () => {
  assert.equal(boards.length, 128);
  for (const board of boards) {
    assert.deepEqual(solutions(board, undefined, 2), [board.solution]);
    assert.equal(new Set(board.regions).size, board.size);
    for (let region = 0; region < board.size; region++) {
      const members = board.regions.flatMap((v, i) =>
          v === region ? [i] : [],
        ),
        visited = new Set([members[0]]),
        queue = [members[0]];
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
