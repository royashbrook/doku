import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

test("native A-to-B update needs consent, retains a held client, and rejects a broken C", async ({
  context,
}) => {
  const root = join(process.cwd(), "dist");
  const identity = JSON.parse(
    await readFile(join(root, "version.json"), "utf8"),
  );
  const content = new Map<string, Buffer>();
  async function load(directory: string) {
    for (const file of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, file.name);
      if (file.isDirectory()) await load(path);
      else content.set("/" + relative(root, path), await readFile(path));
    }
  }
  await load(root);
  let candidate = identity.build;
  let broken = false;
  const mime: Record<string, string> = {
    js: "application/javascript",
    html: "text/html",
    css: "text/css",
    json: "application/json",
    webmanifest: "application/manifest+json",
    webp: "image/webp",
    png: "image/png",
    md: "text/plain",
    txt: "text/plain",
  };
  const server = createServer((request, response) => {
    const pathname = new URL(request.url!, "http://localhost").pathname;
    const file = pathname === "/" ? "/index.html" : pathname;
    const data = content.get(file);
    response.setHeader("cache-control", "no-store");
    if (!data || (broken && file === "/poodle.webp")) {
      response.writeHead(404).end();
      return;
    }
    const extension = file.split(".").at(-1)!;
    response.setHeader(
      "content-type",
      mime[extension] ?? "application/octet-stream",
    );
    // This is an identity-only candidate, not a fixture that changes the puzzle.
    response.end(
      ["js", "json"].includes(extension)
        ? data.toString().replaceAll(identity.build, candidate)
        : data,
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const page = await context.newPage();
    await page.goto(origin + "/?puzzle=1");
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await page.locator("#cell-0").dblclick();
    const held = await context.newPage();
    await held.goto(origin + "/?puzzle=1");
    await held.waitForFunction(() => !!navigator.serviceWorker.controller);
    const legacyFrameSize = () =>
      held.evaluate(async () => {
        const image = new Image();
        image.src = "/cats-faces.webp";
        await image.decode();
        return [image.naturalWidth, image.naturalHeight];
      });
    expect(await legacyFrameSize()).toEqual([1152, 1152]);
    const before = await page.evaluate(() => performance.timeOrigin);
    candidate = "b".repeat(12);
    await page
      .getByRole("button", { name: "How to play", exact: true })
      .click();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    // A real registration update exercises download, install and MessageChannel identity.
    await page.evaluate(async () =>
      (await navigator.serviceWorker.getRegistration())!.update(),
    );
    await expect(page.getByText("A fresh doku is ready.")).toBeVisible();
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(before);
    await expect(page.locator("#cell-0 img")).toBeVisible();
    await page.getByRole("button", { name: "Update", exact: true }).click();
    await expect(page.getByText("A fresh doku is ready.")).not.toBeVisible();
    await expect
      .poll(() => page.evaluate(() => performance.timeOrigin))
      .not.toBe(before);
    await expect(page.locator("#cell-0 img")).toBeVisible();
    const keys = await page.evaluate(() => caches.keys());
    expect(keys).toContain("doku-" + identity.build);
    expect(keys).toContain("doku-" + candidate);
    await expect(held.locator("#cell-0 img")).toBeVisible();
    expect(await legacyFrameSize()).toEqual([1152, 1152]);
    candidate = "c".repeat(12);
    broken = true;
    await page.evaluate(async () =>
      (await navigator.serviceWorker.getRegistration())!.update(),
    );
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const reg = (await navigator.serviceWorker.getRegistration())!;
          return !reg.installing && !reg.waiting;
        }),
      )
      .toBe(true);
    expect(await page.evaluate(() => caches.keys())).not.toContain(
      "doku-" + candidate,
    );
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#cell-0 img")).toBeVisible();
    await context.setOffline(false);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
