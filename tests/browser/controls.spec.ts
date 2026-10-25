import { test, expect, type Page } from "@playwright/test";
import boards from "../../src/lib/boards.json" with { type: "json" };

async function seed(page: Page, values: number[] = []) {
  await page.addInitScript((values) => {
    localStorage.setItem(
      "doku.save.v1",
      JSON.stringify({
        schema: 1,
        skin: "cats",
        theme: "day",
        labels: false,
        autoCross: false,
        completed: [],
        current: 0,
        boards: { 0: [...values, ...Array(25 - values.length).fill(0)] },
      }),
    );
  }, values);
}

async function row(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("doku.save.v1")!).boards[0].slice(0, 5),
  );
}

test("native taps cycle cross, pet, maybe and empty without placement modes", async ({
  page,
}) => {
  await page.goto("/?puzzle=1");
  await expect(page.locator(".mode-picker")).toHaveCount(0);
  const cell = page.locator("#cell-0");
  for (const label of [/crossed out$/, /cat$/, /maybe$/, /empty$/]) {
    await cell.tap();
    await expect(cell).toHaveAttribute("aria-label", label);
  }
  await page.getByRole("button", { name: "undo", exact: true }).tap();
  await expect(cell).toHaveAttribute("aria-label", /maybe$/);
  await page.reload();
  await expect(cell).toHaveAttribute("aria-label", /maybe$/);
});

test("rapid mouse clicks and keyboard activation use the same cycle", async ({
  page,
}) => {
  await page.goto("/?puzzle=1");
  const cell = page.locator("#cell-0");
  await cell.dblclick();
  await expect(cell).toHaveAttribute("aria-label", /cat$/);
  await cell.dblclick();
  await expect(cell).toHaveAttribute("aria-label", /empty$/);
  await cell.focus();
  for (const key of ["Space", "Enter", "Space", "Enter"])
    await page.keyboard.press(key);
  await expect(cell).toHaveAttribute("aria-label", /empty$/);
  await page.keyboard.press("Space");
  await expect(cell).toHaveAttribute("aria-label", /crossed out$/);
});

test("an explicit maybe is visible even where another pet adds an automatic cross", async ({
  page,
}) => {
  await seed(page, [2, 0]);
  await page.addInitScript(() => {
    const save = JSON.parse(localStorage.getItem("doku.save.v1")!);
    save.autoCross = true;
    localStorage.setItem("doku.save.v1", JSON.stringify(save));
  });
  await page.goto("/?puzzle=1");
  const cell = page.locator("#cell-1");
  await expect(cell).toHaveAttribute("aria-label", /ruled out by a pet$/);
  await cell.tap();
  await expect(cell).toHaveAttribute("aria-label", /crossed out$/);
  await cell.tap();
  await expect(cell).toHaveAttribute("aria-label", /cat$/);
  await cell.tap();
  await expect(cell).toHaveAttribute("aria-label", /maybe$/);
  await expect(cell.locator(".maybe")).toHaveCount(1);
  await cell.tap();
  await expect(cell).toHaveAttribute("aria-label", /ruled out by a pet$/);
});

test("a fast drag fills skipped squares, clears on a second pass and preserves pets", async ({
  page,
}) => {
  await seed(page, [0, 0, 2, 3, 0]);
  await page.goto("/?puzzle=1");
  const start = (await page.locator("#cell-0").boundingBox())!;
  const end = (await page.locator("#cell-4").boundingBox())!;
  const drag = async () => {
    await page.mouse.move(
      start.x + start.width / 2,
      start.y + start.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2);
    await page.mouse.up();
  };
  await drag();
  expect(await row(page)).toEqual([1, 1, 2, 1, 1]);
  await drag();
  expect(await row(page)).toEqual([0, 0, 2, 0, 0]);
  await expect(page.locator(".pet-cell")).toHaveCount(1);
});

test("pressing is not a tap until release, and cancelled input does not cycle", async ({
  page,
}) => {
  await page.goto("/?puzzle=1");
  const cell = page.locator("#cell-0");
  const box = (await cell.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(cell).toHaveAttribute("aria-label", /empty$/);
  await cell.dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  await expect(cell).toHaveAttribute("aria-label", /empty$/);
  await cell.tap();
  await expect(cell).toHaveAttribute("aria-label", /crossed out$/);
});

test("old saves keep all four cell meanings before the next tap", async ({
  page,
}) => {
  await seed(page, [0, 1, 2, 3, 0]);
  await page.goto("/?puzzle=1");
  const labels = [/empty$/, /crossed out$/, /cat$/, /maybe$/];
  for (let at = 0; at < 4; at++)
    await expect(page.locator(`#cell-${at}`)).toHaveAttribute(
      "aria-label",
      labels[at],
    );
  for (let at = 0; at < 4; at++) await page.locator(`#cell-${at}`).tap();
  expect(await row(page)).toEqual([1, 2, 3, 0, 0]);
});

test("native finger drag crosses a row and ignores a second finger", async ({
  page,
  browserName,
  context,
}) => {
  test.skip(browserName !== "chromium", "native touch-move injection uses CDP");
  await page.goto("/?puzzle=1");
  const session = await context.newCDPSession(page);
  const first = (await page.locator("#cell-0").boundingBox())!;
  const last = (await page.locator("#cell-4").boundingBox())!;
  const point = {
    x: first.x + first.width / 2,
    y: first.y + first.height / 2,
    id: 0,
  };
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point, { x: point.x, y: point.y + first.height, id: 1 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { ...point, x: last.x + last.width / 2 },
      { x: point.x, y: point.y + first.height, id: 1 },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(await row(page)).toEqual([1, 1, 1, 1, 1]);
  await expect(page.locator("#cell-5")).toHaveAttribute("aria-label", /empty$/);
});

for (const theme of ["day", "night"])
  for (const size of [5, 16]) {
    test(`white outlined question marks stay inside ${size} squares in ${theme}`, async ({
      page,
    }) => {
      const index = boards.findIndex((b) => b.size === size);
      await page.addInitScript(
        ({ theme, size, index }) => {
          localStorage.setItem(
            "doku.save.v1",
            JSON.stringify({
              schema: 1,
              skin: "cats",
              theme,
              labels: true,
              autoCross: false,
              completed: [],
              current: index,
              boards: { [index]: [3, 1, ...Array(size * size - 2).fill(0)] },
            }),
          );
        },
        { theme, size, index },
      );
      await page.setViewportSize({ width: 360, height: 640 });
      await page.goto(`/?puzzle=${index + 1}`);
      const mark = await page.locator("#cell-0 .maybe").evaluate((el) => {
        const edge = el.parentElement!.querySelector(".maybe-edge")!;
        const r = el.getBoundingClientRect(),
          cell = el.parentElement!.getBoundingClientRect();
        return {
          face: getComputedStyle(el).color,
          edge: edge && getComputedStyle(edge).color,
          faceStroke: Number(el.getAttribute("stroke-width")),
          edgeStroke: edge && Number(edge.getAttribute("stroke-width")),
          width: r.width / cell.width,
          inside:
            r.left >= cell.left &&
            r.right <= cell.right &&
            r.top >= cell.top &&
            r.bottom <= cell.bottom,
        };
      });
      const cross = await page.locator("#cell-1 .cross").evaluate((el) => ({
        face: getComputedStyle(el).color,
        edge: getComputedStyle(el.parentElement!.querySelector(".cross-edge")!)
          .color,
      }));
      expect(mark.face).toBe(cross.face);
      expect(mark.edge).toBe(cross.edge);
      expect(mark.edgeStroke).toBeGreaterThan(mark.faceStroke);
      expect(mark.width).toBeGreaterThanOrEqual(0.7);
      expect(mark.inside).toBe(true);
    });
  }
