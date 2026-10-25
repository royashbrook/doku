import { test, expect } from "@playwright/test";
import boards from "../../src/lib/boards.json" with { type: "json" };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 8911;
    Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  });
  await page.clock.install();
});

test("home pets keep their own space through every gesture envelope", async ({
  page,
}) => {
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [430, 932],
    [768, 1024],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const bounds = await page.locator(".pet-pair").evaluate((pair) => {
      const faces = [...pair.querySelectorAll<HTMLElement>(".pet-face")];
      const samples = [];
      for (const left of [-3.5, 0, 3.5])
        for (const right of [-3.5, 0, 3.5]) {
          faces[0].style.transform = `rotate(${left}deg) translateY(-1%)`;
          faces[1].style.transform = `rotate(${right}deg) translateY(-1%)`;
          const [a, b] = faces.map((face) => face.getBoundingClientRect());
          samples.push({ gap: b.left - a.right, left: a.left, right: b.right });
        }
      faces.forEach((face) => face.style.removeProperty("transform"));
      return samples;
    });
    for (const r of bounds) {
      expect(r.gap).toBeGreaterThanOrEqual(8);
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.right).toBeLessThanOrEqual(width);
    }
  }
});

test("pets choose independent multi-frame gestures and stop for hidden or reduced motion", async ({
  page,
}) => {
  const i = boards.findIndex((b) => b.size === 16);
  await page.goto(`/?puzzle=${i + 1}`);
  for (const at of boards[i].solution.slice(0, 15))
    await page.locator(`#cell-${at}`).tap();
  const faces = await page
    .locator(".pet-cell .pet")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-face")));
  await page.locator(".board").evaluate((board) => {
    const pets = [...board.querySelectorAll(".pet")];
    const traces = pets.map(() => [] as string[]);
    (window as unknown as { maxPetAnimations: number }).maxPetAnimations = 0;
    (window as unknown as { petTraces: string[][] }).petTraces = traces;
    const observer = new MutationObserver((changes) => {
      for (const change of changes) {
        const el = change.target as Element;
        const at = pets.indexOf(el);
        const active =
          el.querySelector(".pet-face")?.getAnimations().length ?? 0;
        const probe = window as unknown as { maxPetAnimations: number };
        probe.maxPetAnimations = Math.max(probe.maxPetAnimations, active);
        if (at >= 0)
          traces[at].push(
            el.getAttribute("data-gesture") +
              ":" +
              el.getAttribute("data-frame"),
          );
      }
    });
    observer.observe(board, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-frame", "data-gesture"],
    });
  });
  await page.clock.runFor(45000);
  const traces = await page.evaluate(
    () => (window as unknown as { petTraces: string[][] }).petTraces,
  );
  expect(traces).toHaveLength(15);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { maxPetAnimations: number }).maxPetAnimations,
    ),
  ).toBeLessThanOrEqual(1);
  expect(new Set(traces.map((t) => t.join("|"))).size).toBeGreaterThanOrEqual(
    12,
  );
  const used = new Set(traces.flat().map((t) => t.split(":")[1]));
  expect(used.size).toBe(16);
  for (const trace of traces) expect(trace.length).toBeGreaterThan(10);

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator('.pet-cell .pet[data-paused="true"]')).toHaveCount(
    15,
  );
  const frozen = await page
    .locator(".pet-cell .pet")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-frame")));
  await page.clock.runFor(20000);
  expect(
    await page
      .locator(".pet-cell .pet")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-frame"))),
  ).toEqual(frozen);
  expect(frozen.every((frame) => frame === "0")).toBe(true);

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator('.pet-cell .pet[data-paused="false"]')).toHaveCount(
    15,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator('.pet-cell .pet[data-paused="true"]')).toHaveCount(
    15,
  );
  await page.clock.runFor(20000);
  expect(
    await page
      .locator(".pet-cell .pet")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-frame"))),
  ).toEqual(frozen);
  expect(
    await page
      .locator(".pet-cell .pet-face")
      .evaluateAll((els) => els.flatMap((el) => el.getAnimations()).length),
  ).toBe(0);
  await page.reload();
  expect(
    await page
      .locator(".pet-cell .pet")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-face"))),
  ).toEqual(faces);
});

for (const theme of ["day", "night"])
  for (const size of [5, 8, 12, 16])
    test(`flat tile spacing uses the page canvas without outlines on ${size} in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 360, height: 640 });
      await page.addInitScript(
        (theme) =>
          localStorage.setItem(
            "doku.save.v1",
            JSON.stringify({
              schema: 1,
              skin: "cats",
              theme,
              labels: false,
              autoCross: true,
              completed: [],
              current: 0,
              boards: {},
            }),
          ),
        theme,
      );
      const i = boards.findIndex((b) => b.size === size);
      await page.goto(`/?puzzle=${i + 1}`);
      const canvas = await page.locator(".board").evaluate((el) => ({
        color: getComputedStyle(el).backgroundColor,
        page: getComputedStyle(document.body).backgroundColor,
        shadow: getComputedStyle(el).boxShadow,
        radius: getComputedStyle(el).borderRadius,
      }));
      expect(canvas.color).toBe(canvas.page);
      expect(canvas.shadow).toBe("none");
      expect(canvas.radius).toBe("0px");
      expect(
        await page
          .locator(".region-row li")
          .evaluateAll((els) =>
            els.every((el) => getComputedStyle(el).boxShadow === "none"),
          ),
      ).toBe(true);
      const tiles = await page.locator(".cell").evaluateAll((els) =>
        els.map((el) => {
          const style = getComputedStyle(el),
            pseudo = getComputedStyle(el, "::before"),
            r = el.getBoundingClientRect();
          return {
            before: pseudo.content,
            shadow: style.boxShadow,
            clip: style.backgroundClip,
            borders: [
              style.borderTopColor,
              style.borderRightColor,
              style.borderBottomColor,
              style.borderLeftColor,
            ],
            widths: [
              style.borderTopWidth,
              style.borderRightWidth,
              style.borderBottomWidth,
              style.borderLeftWidth,
            ].map(parseFloat),
            declaredWidths: [
              (el as HTMLElement).style.borderTopWidth,
              (el as HTMLElement).style.borderRightWidth,
              (el as HTMLElement).style.borderBottomWidth,
              (el as HTMLElement).style.borderLeftWidth,
            ].map(parseFloat),
            color: style.backgroundColor,
            width: r.width,
            owns:
              document
                .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
                ?.closest(".cell") === el,
          };
        }),
      );
      expect(tiles).toHaveLength(size * size);
      expect(tiles.some((t) => t.widths.some((w) => w >= 2))).toBe(true);
      expect(tiles.some((t) => t.widths.some((w) => w > 0 && w < 2))).toBe(
        true,
      );
      expect(tiles.some((t) => t.declaredWidths.some((w) => w === 0.5))).toBe(
        true,
      );
      for (const tile of tiles) {
        expect(tile.before).toBe("none");
        expect(tile.shadow).toBe("none");
        expect(tile.clip).toBe("padding-box");
        expect(
          tile.borders.every((color) => color === "rgba(0, 0, 0, 0)"),
        ).toBe(true);
        expect(tile.color).not.toBe("rgba(0, 0, 0, 0)");
        expect(tile.owns).toBe(true);
        expect(tile.width).toBeGreaterThan(15);
        if (size === 8) expect(tile.width).toBe(44);
      }
    });
