import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import sharp from "sharp";

test("each skin ships four faces with sixteen different alpha-padded frames each", async () => {
  for (const skin of ["cats", "poodles"]) {
    const input = `public/${skin}-motion.webp`;
    const metadata = await sharp(input).metadata();
    assert.equal(metadata.width, 1536);
    assert.equal(metadata.height, 1536);
    assert.equal(metadata.hasAlpha, true);
    const centers = new Set<string>();
    for (let row = 0; row < 4; row++) {
      const poses = new Set<string>();
      for (let frame = 0; frame < 16; frame++) {
        const { data, info } = await sharp(input)
          .extract({
            left: (frame % 8) * 192,
            top: (row * 2 + Math.floor(frame / 8)) * 192,
            width: 192,
            height: 192,
          })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const hash = createHash("sha256").update(data).digest("hex");
        poses.add(hash);
        if (frame === 0) centers.add(hash);
        for (let at = 0; at < 192; at++) {
          for (const pixel of [at, 191 * 192 + at, at * 192, at * 192 + 191])
            assert.equal(
              data[pixel * info.channels + 3],
              0,
              "frame must not touch its neighbors",
            );
        }
      }
      assert.equal(poses.size, 16);
    }
    assert.equal(centers.size, 4);
  }
});

test("legacy four-pose atlas URLs keep their layout for already-open clients", async () => {
  for (const skin of ["cats", "poodles"]) {
    const metadata = await sharp(`public/${skin}-faces.webp`).metadata();
    assert.equal(metadata.width, 1152);
    assert.equal(metadata.height, 1152);
  }
});
