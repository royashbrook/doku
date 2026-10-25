import { test, expect } from "@playwright/test";
import boards from "../../src/lib/boards.json" with { type: "json" };

for (const size of [13, 14, 15, 16]) {
  test(`${size} square board has coloured regions, reachable cells and saved moves`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/");
    await page.getByRole("button", { name: "all puzzles" }).tap();
    await page
      .getByRole("button", { name: `${size} × ${size}`, exact: true })
      .tap();
    const index = boards.findIndex((board) => board.size === size);
    expect(index).toBeGreaterThanOrEqual(192);
    await page
      .getByRole("button", { name: `Puzzle ${index + 1}`, exact: true })
      .tap();
    await expect(
      page.getByRole("group", { name: `${size} by ${size} board` }),
    ).toBeVisible();
    await expect(page.locator(".cell")).toHaveCount(size * size);
    const paint = await page.locator(".cell").evaluateAll((cells) =>
      cells.map((cell) => {
        const rect = cell.getBoundingClientRect();
        return {
          color: getComputedStyle(cell).backgroundColor,
          owns:
            document
              .elementFromPoint(
                rect.x + rect.width / 2,
                rect.y + rect.height / 2,
              )
              ?.closest(".cell") === cell,
          inside:
            rect.x >= 0 &&
            rect.right <= innerWidth &&
            rect.y >= 0 &&
            rect.bottom <= innerHeight,
        };
      }),
    );
    expect(new Set(paint.map((cell) => cell.color)).size).toBe(size);
    for (const cell of paint) {
      expect(cell.color).not.toBe("rgba(0, 0, 0, 0)");
      expect(cell.owns).toBe(true);
      expect(cell.inside).toBe(true);
    }
    const first = boards[index].solution[0];
    await page.locator(`#cell-${first}`).tap();
    await page.locator(`#cell-${first}`).tap();
    await page.reload();
    await page.getByRole("button", { name: "keep playing" }).tap();
    await expect(page.locator(`#cell-${first}`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator(".pet-cell")).toHaveCount(1);
    await page.getByRole("button", { name: "hint", exact: true }).tap();
    const pointed = await page.locator(".hinted").getAttribute("data-cell");
    expect(boards[index].solution).toContain(Number(pointed));
    await page.locator(`#cell-${pointed}`).tap();
    await page.locator(`#cell-${pointed}`).tap();
    await expect(page.locator(".pet-cell")).toHaveCount(2);
  });
}

test("16 square board completes and returns to size selection", async ({
  page,
}) => {
  // The hosted WebKit trace spent 1.2–2.2s per action. This 16-pet
  // journey needs its own budget, without permitting an individual stalled action.
  test.setTimeout(60_000);
  page.setDefaultTimeout(5_000);
  page.setDefaultNavigationTimeout(10_000);
  const index = boards.findIndex((board) => board.size === 16);
  expect(index).toBeGreaterThanOrEqual(192);
  await page.addInitScript(() =>
    localStorage.setItem(
      "doku.save.v1",
      JSON.stringify({
        schema: 1,
        skin: "poodles",
        theme: "night",
        labels: true,
        autoCross: true,
        completed: [],
        current: 0,
        boards: {},
      }),
    ),
  );
  await page.goto(`/?puzzle=${index + 1}`);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await expect(page.locator(".region-label")).toHaveCount(256);
  const start = boards[index].regions.findIndex(
    (_, at) =>
      at % 16 < 15 &&
      !boards[index].solution.includes(at) &&
      !boards[index].solution.includes(at + 1),
  );
  const from = (await page.locator(`#cell-${start}`).boundingBox())!;
  const to = (await page.locator(`#cell-${start + 1}`).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2);
  await page.mouse.up();
  for (const at of [start, start + 1])
    await expect(page.locator(`#cell-${at}`)).toHaveAttribute(
      "aria-label",
      /crossed out/,
    );
  for (const at of boards[index].solution)
    await page.locator(`#cell-${at}`).dblclick();
  await expect(page.locator(".pet-cell img").first()).toHaveAttribute(
    "src",
    "/poodles-motion.webp",
  );
  await expect(page.getByRole("dialog")).toContainText("everyone’s home.");
  await page.getByRole("button", { name: "choose a puzzle" }).tap();
  await expect(
    page.getByRole("button", { name: "16 × 16", exact: true }),
  ).toBeVisible();
});
