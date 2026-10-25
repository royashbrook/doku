import sharp from "sharp";

// Generated sheets do not guarantee exact cell alignment. Isolate the opaque head
// silhouettes first; a fixed grid crop can pass padding checks while cutting a chin.
async function heads(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const seen = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const found = [];
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || data[start * channels + 3] < 128) continue;
    let read = 0,
      write = 1,
      minX = width,
      minY = height,
      maxX = 0,
      maxY = 0;
    queue[0] = start;
    seen[start] = 1;
    while (read < write) {
      const at = queue[read++],
        x = at % width,
        y = Math.floor(at / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (const next of [
        x > 0 ? at - 1 : -1,
        x + 1 < width ? at + 1 : -1,
        y > 0 ? at - width : -1,
        y + 1 < height ? at + width : -1,
      ]) {
        if (next >= 0 && !seen[next] && data[next * channels + 3] >= 128) {
          seen[next] = 1;
          queue[write++] = next;
        }
      }
    }
    if (write > 1000)
      found.push({
        left: minX,
        top: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      });
  }
  if (found.length !== 64)
    throw new Error(
      `Expected64 head silhouettes, found${found.length} in ${input}`,
    );
  found.sort((a, b) => a.top + a.height / 2 - (b.top + b.height / 2));
  const ordered = [];
  for (let row = 0; row < 8; row++)
    ordered.push(
      ...found
        .slice(row * 8, row * 8 + 8)
        .sort((a, b) => a.left + a.width / 2 - (b.left + b.width / 2)),
    );
  return ordered;
}

for (const [at, name] of ["cats", "poodles"].entries()) {
  const input = process.argv[at + 2];
  const crops = await heads(input);
  const composite = [];
  for (let frame = 0; frame < 64; frame++) {
    const crop = crops[frame],
      identity = Math.floor(frame / 16);
    const size =
      Math.max(
        ...crops
          .slice(identity * 16, identity * 16 + 16)
          .flatMap((c) => [c.width, c.height]),
      ) + 4;
    const raw = await sharp(input).extract(crop).png().toBuffer();
    const centered = await sharp({
      create: { width: size, height: size, channels: 4, background: "#0000" },
    })
      .composite([
        {
          input: raw,
          left: Math.floor((size - crop.width) / 2),
          top: Math.floor((size - crop.height) / 2),
        },
      ])
      .png()
      .toBuffer();
    // Materialize first: resizing and compositing in one sharp pipeline resizes
    // the canvas before compositing, leaving the head at the old coordinates.
    const tile = await sharp(centered)
      .resize(176, 176)
      .extend({ top: 8, bottom: 8, left: 8, right: 8, background: "#0000" })
      .png()
      .toBuffer();
    composite.push({
      input: tile,
      left: (frame % 8) * 192,
      top: Math.floor(frame / 8) * 192,
    });
  }
  await sharp({
    create: { width: 1536, height: 1536, channels: 4, background: "#0000" },
  })
    .composite(composite)
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(`public/${name}-motion.webp`);
  console.log(
    `${name}:64 full head silhouettes, constant scale per identity, alpha-padded1536px atlas`,
  );
}
