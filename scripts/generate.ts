import { readFileSync, writeFileSync } from "node:fs";
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
function connected(regions: number[], region: number, size: number): boolean {
  const members = regions.flatMap((value, at) =>
      value === region ? [at] : [],
    ),
    reached = new Set([members[0]]),
    queue = [members[0]];
  for (const at of queue) {
    for (const to of [
      at - size,
      at + size,
      ...(at % size ? [at - 1] : []),
      ...(at % size < size - 1 ? [at + 1] : []),
    ]) {
      if (regions[to] === region && !reached.has(to)) {
        reached.add(to);
        queue.push(to);
      }
    }
  }
  return reached.size === members.length;
}
function uniqueRegions(puzzle: Puzzle): boolean {
  const anchors = new Set(puzzle.solution);
  // Cut a competing placement at a region boundary, without changing the intended solution.
  // Random growth alone almost never yields a unique large board.
  for (let step = 0; step < 500; step++) {
    const found = solutions(puzzle),
      alternative = found.find((result) =>
        result.some((at, r) => at !== puzzle.solution[r]),
      );
    if (!alternative) return found.length === 1;
    let changed = false;
    for (const at of shuffled(alternative.filter((at) => !anchors.has(at)))) {
      const size = puzzle.size,
        old = puzzle.regions[at];
      if (puzzle.regions.filter((region) => region === old).length <= 3)
        continue;
      for (const to of shuffled([
        at - size,
        at + size,
        ...(at % size ? [at - 1] : []),
        ...(at % size < size - 1 ? [at + 1] : []),
      ])) {
        const region = puzzle.regions[to];
        if (region === undefined || region === old) continue;
        puzzle.regions[at] = region;
        if (connected(puzzle.regions, old, size)) {
          changed = true;
          break;
        }
        puzzle.regions[at] = old;
      }
      if (changed) break;
    }
    if (!changed) return false;
  }
  return false;
}
// Published indices are saved progress and shared links. Only append new sizes.
const file = new URL("../src/lib/boards.json", import.meta.url);
const puzzles: Puzzle[] = JSON.parse(readFileSync(file, "utf8")),
  seen = new Set(puzzles.map((p) => p.regions.join(",")));
for (const [size, difficulty] of [
  [9, "bright"],
  [10, "bold"],
  [11, "expert"],
  [12, "master"],
] as const) {
  if (puzzles.some((p) => p.size === size)) continue;
  seed = 0xd0c02026 ^ size;
  let accepted = 0;
  for (let attempts = 0; accepted < 16 && attempts < 100000; attempts++) {
    const solution = arrangement(size),
      regions = grow(size, solution),
      key = regions.join(",");
    const puzzle: Puzzle = { size, regions, solution, difficulty };
    if (seen.has(key) || !uniqueRegions(puzzle)) continue;
    const finalKey = puzzle.regions.join(",");
    if (seen.has(finalKey)) continue;
    seen.add(finalKey);
    puzzles.push(puzzle);
    accepted++;
    console.log(`${size}x${size}: ${accepted}/16 (attempt ${attempts + 1})`);
  }
  if (accepted !== 16) throw new Error(`Could not build ${difficulty} pool`);
}
writeFileSync(file, JSON.stringify(puzzles));
console.log(`Generated ${puzzles.length} connected, uniquely solvable boards.`);
