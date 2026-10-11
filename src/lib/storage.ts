import type { Cell } from "./puzzle.ts";
export const SAVE_KEY = "doku.save.v1";
export interface Save {
  schema: 1;
  skin: "cats" | "poodles";
  theme: "day" | "night";
  labels: boolean;
  autoCross: boolean;
  completed: number[];
  current: number;
  boards: Record<string, Cell[]>;
}
export const fresh = (): Save => ({
  schema: 1,
  skin: "cats",
  theme: "day",
  labels: false,
  autoCross: true,
  completed: [],
  current: 0,
  boards: {},
});
export function parseSave(raw: string, sizes: number[]): Save {
  // Plain JSON has no inflation step. Bound the input before parsing imported text.
  if (raw.length > 100000) throw new Error("Save code is too long.");
  const s: unknown = JSON.parse(raw);
  if (!s || typeof s !== "object") throw new Error("Not a doku save.");
  const data = s as Partial<Save>;
  if (
    data.schema !== 1 ||
    !["cats", "poodles"].includes(data.skin ?? "") ||
    !["day", "night"].includes(data.theme ?? "") ||
    typeof data.labels !== "boolean" ||
    typeof data.autoCross !== "boolean" ||
    !Number.isInteger(data.current) ||
    data.current! < 0 ||
    data.current! >= sizes.length ||
    !Array.isArray(data.completed) ||
    !data.completed.every(
      (i) => Number.isInteger(i) && i >= 0 && i < sizes.length,
    ) ||
    !data.boards ||
    typeof data.boards !== "object" ||
    Array.isArray(data.boards)
  )
    throw new Error("This save has invalid settings or progress.");
  const boards: Record<string, Cell[]> = {};
  for (const [key, cells] of Object.entries(data.boards)) {
    const index = Number(key);
    if (
      String(index) !== key ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= sizes.length ||
      !Array.isArray(cells) ||
      cells.length !== sizes[index] ** 2 ||
      !cells.every((v) => v === 0 || v === 1 || v === 2 || v === 3)
    )
      throw new Error("This save contains an invalid board.");
    boards[key] = [...cells];
  }
  return {
    schema: 1,
    skin: data.skin!,
    theme: data.theme!,
    labels: data.labels,
    autoCross: data.autoCross,
    current: data.current!,
    completed: [...new Set(data.completed)],
    boards,
  };
}
export function load(sizes: number[]): {
  save: Save;
  warning: string;
  blocked: boolean;
} {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return {
      save: raw ? parseSave(raw, sizes) : fresh(),
      warning: "",
      blocked: false,
    };
  } catch {
    return {
      save: fresh(),
      warning:
        "Your saved data could not be read. It has not been replaced. You can still play.",
      blocked: true,
    };
  }
}
export function store(save: Save): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
