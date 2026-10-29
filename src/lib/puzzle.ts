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

// One step of a hint explanation. focus lights up the squares the step is
// about; out are the squares this step rules out.
export interface Step {
  text: string;
  focus: number[];
  out: number[];
}
export interface Explanation {
  index: number;
  steps: Step[];
}

type Kind = "row" | "column" | "color";
interface Group {
  kind: Kind;
  cells: number[];
}

// Reason the way a player would: rule squares out until a row, column or color
// has one open square left, then explain only the steps that led there.
export function explain(puzzle: Puzzle, cells: Cell[]): Explanation | null {
  const n = puzzle.size,
    all = cells.map((_, i) => i);
  const groups: Group[] = [];
  for (let k = 0; k < n; k++) {
    groups.push({
      kind: "row",
      cells: all.filter((i) => Math.floor(i / n) === k),
    });
    groups.push({ kind: "column", cells: all.filter((i) => i % n === k) });
    groups.push({
      kind: "color",
      cells: all.filter((i) => puzzle.regions[i] === k),
    });
  }
  const pets = all.filter((i) => cells[i] === 2);
  const live = groups.filter((g) => !g.cells.some((i) => cells[i] === 2));
  const out = new Set<number>([
    ...all.filter((i) => cells[i] === 1),
    ...blocked(puzzle, cells),
  ]);
  for (const i of pets) out.add(i);
  const open = (g: Group) => g.cells.filter((i) => !out.has(i));
  const key: Record<Kind, (i: number) => number> = {
    row: (i) => Math.floor(i / n),
    column: (i) => i % n,
    color: (i) => puzzle.regions[i],
  };
  const peers = all.map((a) =>
    all.filter((b) => a === b || conflict(puzzle, a, b)),
  );
  const steps: (Step & { uses: number[] })[] = [];
  const record = (
    text: string,
    focus: number[],
    ruled: number[],
    uses: number[],
  ) => {
    for (const i of ruled) out.add(i);
    steps.push({ text, focus, out: ruled, uses });
  };

  // k groups of one kind whose open squares fit inside k groups of another kind.
  const confine = (k: number, inner: Kind, outer: Kind): boolean => {
    const inners = live.filter((g) => g.kind === inner),
      outers = live.filter((g) => g.kind === outer);
    const pick = (
      from: number,
      chosen: Group[],
      keys: Set<number>,
    ): boolean => {
      // Hosts only grow as groups are added, so stop once there are too many.
      if (keys.size > k) return false;
      if (chosen.length === k) {
        const squares = chosen.flatMap(open);
        const hosts = outers.filter((o) => keys.has(key[outer](o.cells[0])));
        if (hosts.length !== k) return false;
        const ruled = hosts.flatMap(open).filter((i) => !squares.includes(i));
        if (!ruled.length) return false;
        record(
          k === 1
            ? `This ${inner} only has open squares in one ${outer}. Its pet goes there, so the rest of that ${outer} is out.`
            : `These ${k} ${inner}s only have open squares in ${k} ${outer}s. Their pets fill those, so the rest is out.`,
          [...squares, ...hosts.flatMap((o) => o.cells)],
          ruled,
          chosen.flatMap((g) => g.cells),
        );
        return true;
      }
      for (let i = from; i < inners.length; i++) {
        const squares = open(inners[i]);
        if (
          squares.length &&
          pick(
            i + 1,
            [...chosen, inners[i]],
            new Set([...keys, ...squares.map(key[outer])]),
          )
        )
          return true;
      }
      return false;
    };
    return pick(0, [], new Set());
  };

  // A pet on this square, plus any pets it would force, would leave some row,
  // column or color with nowhere to go. depth = how many forced pets to follow.
  const contradiction = (depth: number): boolean => {
    for (const at of all) {
      if (out.has(at)) continue;
      const gone = new Set(out),
        placed = [at],
        used: number[] = [];
      const take = (pet: number) => {
        for (const i of peers[pet]) gone.add(i);
      };
      take(at);
      for (let forced = 0; forced <= depth; forced++) {
        const free = live.filter(
          (g) => !g.cells.some((i) => placed.includes(i)),
        );
        const empty = free.find((g) => g.cells.every((i) => gone.has(i)));
        if (empty) {
          record(
            forced === 0
              ? `A pet here would block every open square in this ${empty.kind}. So it is out.`
              : `A pet here would force ${forced === 1 ? "a pet" : "pets"} on the other lit ${forced === 1 ? "square" : "squares"}, leaving this ${empty.kind} nowhere to go. So it is out.`,
            [...placed, ...empty.cells],
            [at],
            [...used, ...empty.cells],
          );
          return true;
        }
        const next = free.find(
          (g) => g.cells.filter((i) => !gone.has(i)).length === 1,
        );
        if (!next) break;
        const pet = next.cells.find((i) => !gone.has(i))!;
        placed.push(pet);
        used.push(...next.cells);
        take(pet);
      }
    }
    return false;
  };

  const kinds: [Kind, Kind][] = [
    ["color", "row"],
    ["color", "column"],
    ["row", "color"],
    ["column", "color"],
  ];
  for (;;) {
    const single = live.find((g) => open(g).length === 1);
    if (single) {
      const index = open(single)[0];
      // Keep only the steps the final row, column or color depends on.
      let needed = new Set(single.cells);
      const kept: Step[] = [];
      for (const step of [...steps].reverse())
        if (step.out.some((i) => needed.has(i))) {
          kept.unshift({ text: step.text, focus: step.focus, out: step.out });
          needed = new Set([...needed, ...step.uses]);
        }
      kept.push({
        text: `${kept.length ? "Now only" : "Only"} one square is left in this ${single.kind}. A pet goes here.`,
        focus: single.cells,
        out: [],
      });
      return { index, steps: kept };
    }
    if (live.some((g) => !open(g).length)) return null;
    const progressed =
      kinds.some(([a, b]) => confine(1, a, b)) ||
      contradiction(0) ||
      [2, 3, 4, 5].some((k) => kinds.some(([a, b]) => confine(k, a, b))) ||
      contradiction(3);
    if (!progressed) return null;
  }
}

export interface Hint {
  index: number;
  text: string;
  action: "place" | "clear";
  steps?: Step[];
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
  const why = explain(puzzle, cells);
  if (why)
    return {
      index: why.index,
      action: "place",
      // The last step's sentence is only true on the board after the earlier
      // steps, so a longer explanation waits behind why?.
      text:
        why.steps.length === 1
          ? why.steps[0].text
          : "A pet goes here. Tap why? to see how we know.",
      steps: why.steps,
    };
  // Two shipped boards reach states these rules cannot explain. Fall back to the solver there.
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
