import { test, expect } from "@playwright/test";
import boards from "../../src/lib/boards.json" with { type: "json" };

test("home pets have different habits and keep their own space through motion", async ({
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
    const motion = await page.locator(".pet-pair .pet").evaluateAll((els) =>
      els.map((el) => {
        const face = getComputedStyle(el.querySelector(".pet-face")!);
        const eyes = getComputedStyle(el.querySelector("img")!);
        return [
          face.animationName,
          face.animationDuration,
          face.animationDelay,
          eyes.animationDuration,
          eyes.animationDelay,
        ].join("|");
      }),
    );
    expect(new Set(motion).size).toBe(2);
    const gaps = await page.locator(".pet-pair").evaluate((pair) => {
      const faces = [...pair.querySelectorAll(".pet-face")];
      const animations = [...pair.querySelectorAll(".pet-face,img")].flatMap(
        (el) => el.getAnimations(),
      );
      const gaps = [];
      for (let t = 0; t <= 30000; t += 250) {
        for (const a of animations) {
          a.pause();
          a.currentTime = t;
        }
        const [a, b] = faces.map((el) => el.getBoundingClientRect());
        gaps.push({ gap: b.left - a.right, left: a.left, right: b.right });
      }
      return gaps;
    });
    for (const r of gaps) {
      expect(r.gap).toBeGreaterThanOrEqual(8);
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.right).toBeLessThanOrEqual(width);
    }
  }
});

test("a large board has varied, mostly-resting pet habits and stable identities", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const i = boards.findIndex((b) => b.size === 16);
  await page.goto(`/?puzzle=${i + 1}`);
  for (const at of boards[i].solution.slice(0, 15))
    await page.locator(`#cell-${at}`).tap();
  const profiles = await page.locator(".pet-cell .pet").evaluateAll((els) =>
    els.map((el) => {
      const face = el.querySelector(".pet-face")!;
      const style = getComputedStyle(face);
      const frames = (
        face.getAnimations()[0].effect as KeyframeEffect
      ).getKeyframes();
      return {
        habit: el.getAttribute("data-habit"),
        duration: style.animationDuration,
        pause: style.animationPlayState,
        firstGesture: frames.find((f) => f.transform !== "none")
          ?.computedOffset,
      };
    }),
  );
  expect(new Set(profiles.map((p) => p.habit)).size).toBe(4);
  expect(new Set(profiles.map((p) => p.duration)).size).toBeGreaterThanOrEqual(
    8,
  );
  for (const p of profiles) {
    expect(p.pause).toBe("running");
    expect(p.firstGesture).toBeGreaterThan(0.5);
  }
  const before = await page.locator(".pet-cell .pet").evaluateAll((els) =>
    els.map((el) => ({
      face: el.getAttribute("data-face"),
      habit: el.getAttribute("data-habit"),
      style: el.getAttribute("style"),
    })),
  );
  await page.reload();
  expect(
    await page.locator(".pet-cell .pet").evaluateAll((els) =>
      els.map((el) => ({
        face: el.getAttribute("data-face"),
        habit: el.getAttribute("data-habit"),
        style: el.getAttribute("style"),
      })),
    ),
  ).toEqual(before);
});
