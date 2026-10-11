export type Cell = 0 | 1 | 2 | 3; // empty, crossed out, pet, maybe
export interface Puzzle {
  size: number;
  regions: number[];
  solution: number[];
  difficulty:
    | "gentle"
    | "cozy"
    | "tricky"
    | "clever"
    | "bright"
    | "bold"
    | "expert"
    | "master";
}

export function touches(a: number, b: number, size: number): boolean {
  return (
    Math.abs(Math.floor(a / size) - Math.floor(b / size)) <= 1 &&
    Math.abs((a % size) - (b % size)) <= 1
  );
}

export function conflict(puzzle: Puzzle, a: number, b: number): boolean {
  return (
    Math.floor(a / puzzle.size) === Math.floor(b / puzzle.size) ||
    a % puzzle.size === b % puzzle.size ||
    puzzle.regions[a] === puzzle.regions[b] ||
    touches(a, b, puzzle.size)
  );
}

// Start with the tightest row or region. Larger boards otherwise spend most
// of a hint searching loose top rows before discovering a forced lower square.
export function solutions(
  puzzle: Pick<Puzzle, "size" | "regions">,
  cells?: Cell[],
  limit = 2,
): number[][] {
  const result: number[][] = [],
    placed: number[] = Array(puzzle.size).fill(-1),
    columns = new Set<number>(),
    regions = new Set<number>();
  const allowed = Array.from({ length: puzzle.size }, (_, r) => {
    const pets = Array.from(
      { length: puzzle.size },
      (_, c) => r * puzzle.size + c,
    ).filter((at) => cells?.[at] === 2);
    if (pets.length > 1) return [];
    return Array.from(
      { length: puzzle.size },
      (_, c) => r * puzzle.size + c,
    ).filter((at) => cells?.[at] !== 1 && (!pets.length || at === pets[0]));
  });
  function search(count: number) {
    if (result.length >= limit) return;
    if (count === puzzle.size) {
      result.push([...placed]);
      return;
    }
    const byRegion: number[][] = Array.from({ length: puzzle.size }, () => []);
    let choices: number[] | undefined;
    const possibleColumns = new Set<number>();
    for (let r = 0; r < puzzle.size; r++) {
      if (placed[r] >= 0) continue;
      const available = allowed[r].filter((at) => {
        const c = at % puzzle.size;
        return (
          !columns.has(c) &&
          !regions.has(puzzle.regions[at]) &&
          (r === 0 ||
            placed[r - 1] < 0 ||
            Math.abs(c - (placed[r - 1] % puzzle.size)) > 1) &&
          (r === puzzle.size - 1 ||
            placed[r + 1] < 0 ||
            Math.abs(c - (placed[r + 1] % puzzle.size)) > 1)
        );
      });
      if (!available.length) return;
      if (!choices || available.length < choices.length) choices = available;
      for (const at of available) {
        byRegion[puzzle.regions[at]].push(at);
        possibleColumns.add(at % puzzle.size);
      }
    }
    if (possibleColumns.size < puzzle.size - count) return;
    for (let region = 0; region < puzzle.size; region++) {
      if (regions.has(region)) continue;
      if (!byRegion[region].length) return;
      if (byRegion[region].length < choices!.length) choices = byRegion[region];
    }
    for (const at of choices!) {
      const r = Math.floor(at / puzzle.size),
        c = at % puzzle.size,
        region = puzzle.regions[at];
      columns.add(c);
      regions.add(region);
      placed[r] = at;
      search(count + 1);
      placed[r] = -1;
      columns.delete(c);
      regions.delete(region);
      if (result.length >= limit) return;
    }
  }
  search(0);
  return result;
}

export function won(puzzle: Puzzle, cells: Cell[]): boolean {
  const pets = cells.flatMap((v, i) => (v === 2 ? [i] : []));
  return (
    pets.length === puzzle.size &&
    pets.every((a, i) =>
      pets.slice(i + 1).every((b) => !conflict(puzzle, a, b)),
    )
  );
}

export function blocked(puzzle: Puzzle, cells: Cell[]): Set<number> {
  const pets = cells.flatMap((v, i) => (v === 2 ? [i] : []));
  return new Set(
    cells.flatMap((v, i) =>
      v !== 2 && pets.some((p) => conflict(puzzle, p, i)) ? [i] : [],
    ),
  );
}

export interface Hint {
  index: number;
  text: string;
  action: "place" | "clear";
}
export function hint(puzzle: Puzzle, cells: Cell[]): Hint | null {
  if (won(puzzle, cells)) return null;
  // A marked-out solution square or misplaced pet can make a consistent puzzle impossible.
  if (!solutions(puzzle, cells, 1).length) {
    const badPet = cells.findIndex(
      (v, i) => v === 2 && !puzzle.solution.includes(i),
    );
    if (badPet >= 0)
      return {
        index: badPet,
        action: "clear",
        text: "This pet leaves no way to finish. Try clearing it.",
      };
    const badMark = puzzle.solution.find((i) => cells[i] === 1)!;
    return {
      index: badMark,
      action: "clear",
      text: "We still need this square. Try clearing its cross.",
    };
  }
  const excluded = blocked(puzzle, cells);
  const groups: { indices: number[]; label: string }[] = [];
  for (let k = 0; k < puzzle.size; k++) {
    groups.push({
      indices: cells
        .map((_, i) => i)
        .filter((i) => Math.floor(i / puzzle.size) === k),
      label: "row",
    });
    groups.push({
      indices: cells.map((_, i) => i).filter((i) => i % puzzle.size === k),
      label: "column",
    });
    groups.push({
      indices: cells.map((_, i) => i).filter((i) => puzzle.regions[i] === k),
      label: "region",
    });
  }
  for (const group of groups) {
    if (group.indices.some((i) => cells[i] === 2)) continue;
    const available = group.indices.filter(
      (i) => cells[i] !== 1 && !excluded.has(i),
    );
    if (available.length === 1)
      return {
        index: available[0],
        action: "place",
        text: `Only one square is left in this ${group.label}. A pet belongs here.`,
      };
  }
  const index = puzzle.solution.find((i) => cells[i] !== 2)!;
  return {
    index,
    action: "place",
    text: "Checking the remaining possibilities, every complete arrangement needs this square.",
  };
}

export function dailyIndex(date: string, count: number): number {
  let hash = 2166136261;
  for (const letter of date)
    hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619);
  return (hash >>> 0) % count;
}
