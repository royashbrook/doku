import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

test("art packing preserves full silhouettes when generated rows miss the nominal grid", async () => {
  const work = await mkdtemp(join(tmpdir(), "doku-art-"));
  try {
    await mkdir(join(work, "public"));
    const heads = Array.from(
      { length: 64 },
      (_, i) =>
        `<rect x="${50 + (i % 8) * 110}" y="${70 + Math.floor(i / 8) * 110}" width="80" height="70" rx="20" fill="#936b45"/>`,
    ).join("");
    const source = join(work, "source.png");
    await writeFile(
      source,
      await sharp(
        Buffer.from(
          `<svg width="1000" height="1000" xmlns="http://www.w3.org/2000/svg">${heads}</svg>`,
        ),
      )
        .png()
        .toBuffer(),
    );
    execFileSync(
      process.execPath,
      [resolve("scripts/pack-pet-motion.mjs"), source, source],
      { cwd: work, stdio: "pipe" },
    );
    const areas = [];
    for (let i = 0; i < 64; i++) {
      const data = await sharp(join(work, "public/cats-motion.webp"))
        .extract({
          left: (i % 8) * 192,
          top: Math.floor(i / 8) * 192,
          width: 192,
          height: 192,
        })
        .ensureAlpha()
        .raw()
        .toBuffer();
      let area = 0;
      let sumX = 0,
        sumY = 0;
      for (let pixel = 3; pixel < data.length; pixel += 4)
        if (data[pixel] > 127) {
          area++;
          const at = (pixel - 3) / 4;
          sumX += at % 192;
          sumY += Math.floor(at / 192);
        }
      assert.ok(
        Math.abs(sumX / area - 95.5) < 1,
        "head must stay horizontally centered after resize",
      );
      assert.ok(
        Math.abs(sumY / area - 95.5) < 1,
        "head must stay vertically centered after resize",
      );
      areas.push(area);
    }
    assert.ok(
      Math.min(...areas) / Math.max(...areas) > 0.995,
      "all64 equal silhouettes must retain equal area, not cropped fragments",
    );
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});
