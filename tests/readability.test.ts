import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  difference,
  labDifference,
  neighbours,
  paint,
  palette,
} from "../src/lib/colors.ts";
import type { Puzzle } from "../src/lib/puzzle.ts";

const css = readFileSync("src/app.css", "utf8");
const boards = JSON.parse(
  readFileSync("src/lib/boards.json", "utf8"),
) as Puzzle[];
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const linear = (v: number) =>
  v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const luminance = (hex: string) =>
  rgb(hex)
    .map(linear)
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
function lab(hex: string) {
  const [r, g, b] = rgb(hex).map(linear);
  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : (t * 841) / 108 + 4 / 29;
  const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
  const y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
  const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

test("regions use vivid, separated colours, not near-white pastel fills", () => {
  for (const hex of palette) {
    const channels = rgb(hex),
      high = Math.max(...channels),
      low = Math.min(...channels);
    const lightness = (high + low) / 2;
    const saturation = (high - low) / (1 - Math.abs(2 * lightness - 1));
    assert.ok(saturation >= 0.4, `${hex} is chromatic`);
    assert.ok(luminance(hex) < 0.6, `${hex} is not washed out`);
  }
  // CIE76 separation is a palette regression guard, not a colour-blindness guarantee.
  for (let i = 0; i < palette.length; i++)
    for (let j = i + 1; j < palette.length; j++) {
      const a = lab(palette[i]),
        b = lab(palette[j]);
      const distance = Math.hypot(...a.map((value, k) => value - b[k]));
      assert.ok(distance >= 24, `regions ${i}/${j} are too close: ${distance}`);
    }
});

test("the white cross face stands out from its dark edge", () => {
  const face = css.match(/--cross-face: (#[a-f0-9]{6});/)![1];
  const edge = css.match(/--cross-ink: (#[a-f0-9]{6});/)![1];
  const values = [luminance(edge), luminance(face)].sort((a, b) => a - b);
  assert.ok((values[1] + 0.05) / (values[0] + 0.05) >= 4.5);
});

test("region saturation stays colorful without the neon extremes", () => {
  for (const hex of palette) {
    const channels = rgb(hex),
      high = Math.max(...channels),
      low = Math.min(...channels);
    const saturation = (high - low) / (1 - Math.abs(high + low - 1));
    assert.ok(saturation <= 0.65, `${hex} is too intense`);
  }
});

test("the installed shell uses the refreshed day surface without changing identity", () => {
  const surface = css.match(/--surface: (#[a-f0-9]{6});/)![1];
  const manifest = JSON.parse(
    readFileSync("public/manifest.webmanifest", "utf8"),
  );
  assert.equal(manifest.theme_color, surface);
  assert.equal(manifest.background_color, surface);
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/");
  assert.ok(
    readFileSync("index.html", "utf8").includes(
      `name="theme-color" content="${surface}"`,
    ),
  );
});

test("cross ink remains high contrast on all sixteen colours", () => {
  const ink = css.match(/--cross-ink: (#[a-f0-9]{6});/)![1];
  for (const fill of palette) {
    const values = [luminance(ink), luminance(fill)].sort((a, b) => a - b);
    assert.ok(
      (values[1] + 0.05) / (values[0] + 0.05) >= 4.5,
      `cross ink on ${fill}`,
    );
  }
});

test("colour difference matches the CIEDE2000 reference pairs", () => {
  // Sharma, Wu and Dalal (2005), pairs 1, 7, 17 and 25.
  for (const [one, two, expected] of [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  ] as [number[], number[], number][])
    assert.ok(Math.abs(labDifference(one, two) - expected) < 1e-4);
});

test("no two of the sixteen colours look alike", () => {
  for (let i = 0; i < palette.length; i++)
    for (let j = i + 1; j < palette.length; j++)
      assert.ok(
        difference(palette[i], palette[j]) >= 15,
        `colours ${i}/${j} are too close`,
      );
});

test("regions that touch get clearly different colours on every board", () => {
  for (const [at, board] of boards.entries()) {
    const colors = paint(board, palette);
    assert.equal(new Set(colors).size, board.size, `board ${at} reuses a colour`);
    for (const [a, b] of neighbours(board)) {
      const gap = difference(palette[colors[a]], palette[colors[b]]);
      assert.ok(gap >= 25, `board ${at} regions ${a}/${b}: ${gap.toFixed(1)}`);
    }
  }
});
