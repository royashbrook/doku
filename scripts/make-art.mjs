import sharp from "sharp";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const input = process.argv[2];
if (!input) throw new Error("Pass the original transparent two-pet atlas.");
await mkdir("public", { recursive: true });
const meta = await sharp(input).metadata();
const half = Math.floor(meta.width / 2);
for (const [i, name] of ["cat", "poodle"].entries()) {
  const crop = await sharp(input)
    .extract({ left: i * half, top: 0, width: half, height: meta.height })
    .png()
    .toBuffer();
  await sharp(crop)
    .trim({ threshold: 20 })
    .resize(384, 384, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90 })
    .toFile(`public/${name}.webp`);
}
const palette = ["#f4b9b8", "#b6d9f1", "#b8debe", "#f1d895"];
const grid = Buffer.from(
  `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" rx="112" fill="#eef5f2"/>${palette.map((c, i) => `<rect x="${64 + (i % 2) * 196}" y="${64 + Math.floor(i / 2) * 196}" width="188" height="188" rx="34" fill="${c}"/>`).join("")}</svg>`,
);
const pet = await sharp("public/cat.webp").resize(204, 204).png().toBuffer();
const base = await sharp(grid)
  .composite([{ input: pet, left: 57, top: 48 }])
  .png()
  .toBuffer();
for (const size of [180, 192, 512])
  await sharp(base).resize(size).png().toFile(`public/icon-${size}.png`);
const maskPet = await sharp("public/cat.webp").resize(280).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#b8debe" },
})
  .composite([{ input: maskPet, left: 116, top: 116 }])
  .png()
  .toFile("public/icon-maskable-512.png");
await writeFile(
  "public/art-notice.txt",
  "Original cat and poodle illustrations generated for doku with OpenAI image generation, October 2026. No Meowdoku assets are included.\n",
);
console.log("Pet sprites and four launcher icons written.");
