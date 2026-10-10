import { writeFileSync } from "node:fs";
import { solutions } from "../src/lib/puzzle.ts";
import type { Puzzle } from "../src/lib/puzzle.ts";

let seed = 0xd0c02026;
function random() {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffled<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
function arrangement(size: number): number[] {
  const cols: number[] = [];
  function next(): boolean {
    if (cols.length === size) return true;
    for (const c of shuffled(Array.from({ length: size }, (_, i) => i))) {
      if (cols.includes(c) || (cols.length && Math.abs(c - cols.at(-1)!) <= 1))
        continue;
      cols.push(c);
      if (next()) return true;
      cols.pop();
    }
    return false;
  }
  if (!next()) throw new Error("No non-touching arrangement");
  return cols.map((c, r) => r * size + c);
}
function grow(size: number, solution: number[]): number[] {
  const regions = Array<number>(size * size).fill(-1);
  solution.forEach((at, i) => (regions[at] = i));
  let left = size * size - size;
  while (left) {
    const options: [number, number][] = [];
    regions.forEach((region, at) => {
      if (region < 0) return;
      const r = Math.floor(at / size),
        c = at % size;
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const rr = r + dr,
          cc = c + dc,
          to = rr * size + cc;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size && regions[to] < 0)
          options.push([to, region]);
      }
    });
    const [at, region] = options[Math.floor(random() * options.length)];
    regions[at] = region;
    left--;
  }
  return regions;
}
const puzzles: Puzzle[] = [],
  seen = new Set<string>();
for (const [size, difficulty] of [
  [5, "gentle"],
  [6, "cozy"],
  [7, "tricky"],
  [8, "clever"],
] as const) {
  let accepted = 0;
  for (let attempts = 0; accepted < 32 && attempts < 100000; attempts++) {
    const solution = arrangement(size),
      regions = grow(size, solution),
      key = regions.join(",");
    const puzzle: Puzzle = { size, regions, solution, difficulty };
    if (seen.has(key) || solutions(puzzle).length !== 1) continue;
    seen.add(key);
    puzzles.push(puzzle);
    accepted++;
  }
  if (accepted !== 32) throw new Error(`Could not build ${difficulty} pool`);
}
writeFileSync(
  new URL("../src/lib/boards.json", import.meta.url),
  JSON.stringify(puzzles),
);
console.log(`Generated ${puzzles.length} connected, uniquely solvable boards.`);
