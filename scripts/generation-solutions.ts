import type { Puzzle } from "../src/lib/puzzle.ts";

// Generation repeatedly solves unfinished 15–16 square candidates. Bit masks avoid
// allocating row/region arrays and Sets at every branch of those offline searches.
export function generationSolutions(
  puzzle: Pick<Puzzle, "size" | "regions">,
): number[][] {
  const { size, regions } = puzzle;
  const full = (1 << size) - 1;
  const placed = new Int16Array(size).fill(-1);
  const found: number[][] = [];
  function search(
    rows: number,
    columns: number,
    usedRegions: number,
    count: number,
  ) {
    if (count === size) {
      found.push(Array.from(placed));
      return;
    }
    const rowOptions = new Int32Array(size);
    const regionCounts = new Int16Array(size);
    let bestCount = size * size,
      bestRow = -1,
      bestRegion = -1,
      possibleColumns = 0;
    for (let row = 0; row < size; row++) {
      if (rows & (1 << row)) continue;
      let mask = full & ~columns;
      for (const neighbour of [row - 1, row + 1]) {
        if (neighbour < 0 || neighbour >= size || placed[neighbour] < 0)
          continue;
        const bit = 1 << (placed[neighbour] % size);
        mask &= ~(bit | (bit << 1) | (bit >>> 1));
      }
      let available = 0,
        rowCount = 0;
      for (let column = 0; column < size; column++) {
        const bit = 1 << column,
          region = regions[row * size + column];
        if (!(mask & bit) || usedRegions & (1 << region)) continue;
        available |= bit;
        regionCounts[region]++;
        rowCount++;
      }
      if (!rowCount) return;
      rowOptions[row] = available;
      possibleColumns |= available;
      if (rowCount < bestCount) {
        bestCount = rowCount;
        bestRow = row;
      }
    }
    let columnCount = 0;
    for (let bits = possibleColumns; bits; bits &= bits - 1) columnCount++;
    if (columnCount < size - count) return;
    for (let region = 0; region < size; region++) {
      if (usedRegions & (1 << region)) continue;
      if (!regionCounts[region]) return;
      if (regionCounts[region] < bestCount) {
        bestCount = regionCounts[region];
        bestRegion = region;
      }
    }
    for (let row = 0; row < size; row++) {
      if (bestRegion < 0 && row !== bestRow) continue;
      for (let column = 0; column < size; column++) {
        if (!(rowOptions[row] & (1 << column))) continue;
        const at = row * size + column,
          region = regions[at];
        if (bestRegion >= 0 && region !== bestRegion) continue;
        placed[row] = at;
        search(
          rows | (1 << row),
          columns | (1 << column),
          usedRegions | (1 << region),
          count + 1,
        );
        placed[row] = -1;
        if (found.length >= 2) return;
      }
    }
  }
  search(0, 0, 0, 0);
  return found;
}
