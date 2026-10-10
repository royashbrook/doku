export type Cell = 0 | 1 | 2; // empty, crossed out, pet
export interface Puzzle {
  size: number;
  regions: number[];
  solution: number[];
  difficulty: "gentle" | "cozy" | "tricky" | "clever";
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

// At most eight rows. Stop at the second witness when checking uniqueness.
export function solutions(
  puzzle: Pick<Puzzle, "size" | "regions">,
  cells?: Cell[],
  limit = 2,
): number[][] {
  const result: number[][] = [],
    placed: number[] = [],
    columns = new Set<number>(),
    regions = new Set<number>();
  function row(r: number) {
    if (result.length >= limit) return;
    if (r === puzzle.size) {
      result.push([...placed]);
      return;
    }
    const forced =
      cells?.findIndex(
        (v, i) => v === 2 && Math.floor(i / puzzle.size) === r,
      ) ?? -1;
    if (
      cells &&
      cells.filter((v, i) => v === 2 && Math.floor(i / puzzle.size) === r)
        .length > 1
    )
      return;
    for (let c = 0; c < puzzle.size; c++) {
      const at = r * puzzle.size + c,
        region = puzzle.regions[at];
      if (
        (forced >= 0 && at !== forced) ||
        cells?.[at] === 1 ||
        columns.has(c) ||
        regions.has(region)
      )
        continue;
      if (r > 0 && Math.abs(c - (placed[r - 1] % puzzle.size)) <= 1) continue;
      columns.add(c);
      regions.add(region);
      placed.push(at);
      row(r + 1);
      placed.pop();
      columns.delete(c);
      regions.delete(region);
    }
  }
  row(0);
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
