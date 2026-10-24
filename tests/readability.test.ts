import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("src/app.css", "utf8");
const palette = Array.from({ length: 16 }, (_, i) => {
  const match = css.match(new RegExp(`--region-${i}: (#[a-f0-9]{6});`));
  assert.ok(match, `region ${i} has a colour`);
  return match[1];
});
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

test("cross ink and region borders remain high contrast on all sixteen colours", () => {
  for (const token of ["cross-ink", "grid-line"]) {
    const ink = css.match(new RegExp(`--${token}: (#[a-f0-9]{6});`))![1];
    for (const fill of palette) {
      const values = [luminance(ink), luminance(fill)].sort((a, b) => a - b);
      assert.ok(
        (values[1] + 0.05) / (values[0] + 0.05) >= 4.5,
        `${token} on ${fill}`,
      );
    }
  }
});
