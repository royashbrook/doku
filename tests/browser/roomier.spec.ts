import { test, expect } from "@playwright/test";
import boards from "../../src/lib/boards.json" with { type: "json" };

for (const [width, height] of [
  [420, 760],
  [390, 664],
  [360, 640],
]) {
  test(`home links remain reachable above the dock ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    // Phone chrome reduces the usable viewport. Exercise the notch/home-indicator budget too.
    await page.addStyleTag({
      content: ".app {padding-top:62px} nav {padding-bottom:43px}",
    });
    if (height === 760) {
      const initial = await page
        .getByRole("button", { name: "all puzzles" })
        .evaluate((el) => ({
          bottom: el.getBoundingClientRect().bottom,
          dock: document.querySelector("nav")!.getBoundingClientRect().top,
        }));
      expect(initial.bottom).toBeLessThanOrEqual(initial.dock);
    }
    await page
      .locator("main")
      .evaluate((el) => (el.scrollTop = el.scrollHeight));
    const metrics = await page
      .getByRole("button", { name: "all puzzles" })
      .evaluate((el) => {
        const r = el.getBoundingClientRect(),
          dock = document.querySelector("nav")!.getBoundingClientRect();
        return {
          top: r.top,
          bottom: r.bottom,
          dock: dock.top,
          owns:
            document
              .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
              ?.closest("button") === el,
          overflow: document.documentElement.scrollHeight - innerHeight,
        };
      });
    expect(metrics.top).toBeGreaterThanOrEqual(62);
    expect(metrics.bottom).toBeLessThanOrEqual(metrics.dock);
    expect(metrics.owns).toBe(true);
    expect(metrics.overflow).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "all puzzles" }).tap();
    await expect(
      page.getByRole("heading", { name: "find your cozy." }),
    ).toBeVisible();
  });
}

test("completion has a viewport-centered dialog and inert page navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 420, height: 760 });
  await page.goto("/?puzzle=1");
  for (const at of boards[0].solution) await page.locator(`#cell-${at}`).tap();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("everyone’s home.");
  const r = await dialog.boundingBox();
  expect(r!.y).toBeGreaterThan(90);
  expect(Math.abs(r!.y + r!.height / 2 - 380)).toBeLessThan(35);
  await page.getByRole("button", { name: "next puzzle" }).tap();
  await expect(dialog).not.toBeVisible();
});

test("crosses use most of a square with rounded chunky strokes", async ({
  page,
}) => {
  await page.goto("/?puzzle=1");
  await page.getByRole("button", { name: "cross out", exact: true }).tap();
  await page.locator("#cell-0").tap();
  const mark = await page
    .locator("#cell-0 .cross")
    .evaluate((el) => ({
      ratio:
        el.getBoundingClientRect().width /
        el.parentElement!.getBoundingClientRect().width,
      stroke: Number(el.getAttribute("stroke-width")),
      cap: el.getAttribute("stroke-linecap"),
    }));
  expect(mark.ratio).toBeGreaterThan(0.5);
  expect(mark.stroke).toBeGreaterThanOrEqual(2.75);
  expect(mark.cap).toBe("round");
});

test("9 through 12 are directly selectable, playable and saved, with more coming", async ({
  page,
}) => {
  for (const size of [9, 10, 11, 12]) {
    await page.goto("/");
    await page.getByRole("button", { name: "all puzzles" }).tap();
    await page
      .getByRole("button", { name: `${size} × ${size}`, exact: true })
      .tap();
    const at = boards.findIndex((board) => board.size === size);
    expect(at).toBeGreaterThanOrEqual(128);
    await page
      .getByRole("button", { name: `Puzzle ${at + 1}`, exact: true })
      .tap();
    await expect(
      page.getByRole("group", { name: `${size} by ${size} board` }),
    ).toBeVisible();
    const paint = await page.locator(".cell").evaluateAll((els) =>
      els.map((el) => {
        const b = el.getBoundingClientRect();
        return {
          color: getComputedStyle(el).backgroundColor,
          owns:
            document
              .elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)
              ?.closest(".cell") === el,
        };
      }),
    );
    for (const cell of paint) {
      expect(cell.color).not.toBe("rgba(0, 0, 0, 0)");
      expect(cell.owns).toBe(true);
    }
    await page.locator(`#cell-${boards[at].solution[0]}`).tap();
    await page.reload();
    await page.getByRole("button", { name: "keep playing" }).tap();
    await expect(page.locator(".pet-cell")).toHaveCount(1);
  }
  await page.getByRole("button", { name: "Back to home" }).tap();
  await page.getByRole("button", { name: "all puzzles" }).tap();
  await expect(
    page.getByText("13 × 13 through 16 × 16. more coming."),
  ).toBeVisible();
});
