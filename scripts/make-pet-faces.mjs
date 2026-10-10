// Normalize generated frames into equal cells so blinking cannot change head size.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const [cats, poodles] = process.argv.slice(2);
await mkdir("public", { recursive: true });
for (const [skin, input] of [
  ["cats", cats],
  ["poodles", poodles],
]) {
  const { width, height } = await sharp(input).metadata();
  const overlays = [];
  for (let row = 0; row < 4; row++)
    for (let column = 0; column < 4; column++) {
      const left = Math.floor((column * width) / 4);
      const top = Math.floor((row * height) / 4);
      const frame = await sharp(input)
        .extract({
          left,
          top,
          width: Math.floor(((column + 1) * width) / 4) - left,
          height: Math.floor(((row + 1) * height) / 4) - top,
        })
        .png()
        .toBuffer();
      const normalized = await sharp(frame)
        .trim({ threshold: 20 })
        .resize(256, 256, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
      overlays.push({
        input: normalized,
        left: column * 288 + 16,
        top: row * 288 + 16,
      });
    }
  await sharp({
    create: {
      width: 1152,
      height: 1152,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(overlays)
    .webp({ quality: 90 })
    .toFile(`public/${skin}-faces.webp`);
  console.log(`Wrote ${skin}: four identities, four expressions each.`);
}
