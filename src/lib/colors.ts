import type { Puzzle } from "./puzzle.ts";

// Region colours, one set for both themes. Each board picks its own order (paint).
// Numbers and boundaries are still needed: colour separation is not a
// colour-blindness guarantee.
export const palette = [
  "#4ccf6b",
  "#cbb7eb",
  "#e7aab3",
  "#d5b490",
  "#ce7464",
  "#b39529",
  "#3695c4",
  "#9fc6db",
  "#db6992",
  "#7ed3c4",
  "#cccd7b",
  "#6e983b",
  "#2d9e7c",
  "#c77930",
  "#808cdd",
  "#b773cb",
];

const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const linear = (v: number) =>
  v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;

function lab(hex: string) {
  const [r, g, b] = rgb(hex).map(linear);
  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : (t * 841) / 108 + 4 / 29;
  const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
  const y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
  const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

// CIEDE2000: how different two colours look. Around 10 reads as "similar" on a phone.
export const difference = (one: string, two: string) =>
  labDifference(lab(one), lab(two));

export function labDifference(
  [L1, a1, b1]: number[],
  [L2, a2, b2]: number[],
): number {
  const rad = Math.PI / 180,
    pow7 = (v: number) => Math.sqrt(v ** 7 / (v ** 7 + 25 ** 7));
  const G = 0.5 * (1 - pow7((Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2));
  const C1 = Math.hypot(a1 * (1 + G), b1),
    C2 = Math.hypot(a2 * (1 + G), b2);
  const hue = (b: number, a: number) =>
    (Math.atan2(b, a) / rad + 360) % 360;
  const h1 = hue(b1, a1 * (1 + G)),
    h2 = hue(b2, a2 * (1 + G));
  let dh = C1 * C2 === 0 ? 0 : h2 - h1;
  if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh / 2) * rad);
  const L = (L1 + L2) / 2,
    C = (C1 + C2) / 2;
  let H = h1 + h2;
  if (C1 * C2 !== 0) H = (Math.abs(h1 - h2) > 180 ? H + (H < 360 ? 360 : -360) : H) / 2;
  const T =
    1 -
    0.17 * Math.cos((H - 30) * rad) +
    0.24 * Math.cos(2 * H * rad) +
    0.32 * Math.cos((3 * H + 6) * rad) -
    0.2 * Math.cos((4 * H - 63) * rad);
  const SL = 1 + (0.015 * (L - 50) ** 2) / Math.sqrt(20 + (L - 50) ** 2),
    SC = 1 + 0.045 * C,
    SH = 1 + 0.015 * C * T;
  const RT =
    -2 * pow7(C) * Math.sin(60 * Math.exp(-(((H - 275) / 25) ** 2)) * rad);
  const dL = (L2 - L1) / SL,
    dC = (C2 - C1) / SC,
    dHs = dH / SH;
  return Math.sqrt(dL ** 2 + dC ** 2 + dHs ** 2 + RT * dC * dHs);
}

// Region pairs that share a side or a corner.
export function neighbours(puzzle: Pick<Puzzle, "size" | "regions">) {
  const { size, regions } = puzzle,
    pairs = new Map<number, [number, number]>();
  for (let at = 0; at < size * size; at++)
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const row = Math.floor(at / size) + dr,
        col = (at % size) + dc;
      if (row >= size || col < 0 || col >= size) continue;
      const a = regions[at],
        b = regions[row * size + col];
      if (a !== b) pairs.set(Math.min(a, b) * 64 + Math.max(a, b), [a, b]);
    }
  return [...pairs.values()];
}

// Pick a palette colour for every region so touching regions differ the most.
// Swap colours while the closest touching pair (then the next closest) improves,
// from a few fixed starting orders. Deterministic, a few ms per board.
export function paint(
  puzzle: Pick<Puzzle, "size" | "regions">,
  palette: string[],
): number[] {
  const n = palette.length,
    pairs = neighbours(puzzle);
  const gap = palette.map((one) => palette.map((two) => difference(one, two)));
  const score = (pick: number[]) =>
    pairs.map(([a, b]) => gap[pick[a]][pick[b]]).sort((x, y) => x - y);
  const beats = (one: number[], two: number[]) => {
    for (let i = 0; i < one.length; i++)
      if (one[i] !== two[i]) return one[i] > two[i];
    return false;
  };
  let best: number[] = [],
    bestScore: number[] | null = null;
  for (let k = 0; k < n; k++) {
    const pick = Array.from({ length: n }, (_, i) => (i * (2 * k + 1) + k) % n);
    let current = score(pick),
      improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < puzzle.size; i++)
        for (let j = i + 1; j < n; j++) {
          [pick[i], pick[j]] = [pick[j], pick[i]];
          const next = score(pick);
          if (beats(next, current)) {
            current = next;
            improved = true;
          } else [pick[i], pick[j]] = [pick[j], pick[i]];
        }
    }
    if (!bestScore || beats(current, bestScore)) {
      bestScore = current;
      best = pick;
    }
  }
  return best.slice(0, puzzle.size);
}
