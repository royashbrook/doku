import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import sharp from "sharp";

test("each skin ships four different faces and four different alpha-padded poses", async () => {
  for (const skin of ["cats", "poodles"]) {
    const input = `public/${skin}-faces.webp`;
    const metadata = await sharp(input).metadata();
    assert.equal(metadata.width, 1152);
    assert.equal(metadata.height, 1152);
    assert.equal(metadata.hasAlpha, true);
    const centers = new Set<string>();
    for (let row = 0; row < 4; row++) {
      const poses = new Set<string>();
      for (let column = 0; column < 4; column++) {
        const { data, info } = await sharp(input)
          .extract({
            left: column * 288,
            top: row * 288,
            width: 288,
            height: 288,
          })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const hash = createHash("sha256").update(data).digest("hex");
        poses.add(hash);
        if (column === 0) centers.add(hash);
        for (let at = 0; at < 288; at++) {
          for (const pixel of [at, 287 * 288 + at, at * 288, at * 288 + 287])
            assert.equal(
              data[pixel * info.channels + 3],
              0,
              "frame must not touch its neighbors",
            );
        }
      }
      assert.equal(poses.size, 4);
    }
    assert.equal(centers.size, 4);
  }
});
