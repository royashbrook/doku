import { test, expect } from "@playwright/test";
import boards from "../../src/lib/boards.json" with { type: "json" };
test("direct play, real completion and a next puzzle", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "let’s play" }).click();
  await expect(page.getByRole("group", { name: "5 by 5 board" })).toBeVisible();
  for (const at of boards[0].solution)
    await page.locator(`#cell-${at}`).click();
  await expect(
    page.getByRole("heading", { name: "everyone’s home." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "next puzzle" }).click();
  await expect(page.getByText("puzzle 2", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("undo, free hint, reset cancellation and reload preserve progress", async ({
  page,
}) => {
  await page.goto("/?puzzle=2");
  await page.locator("#cell-" + boards[1].solution[0]).click();
  await page.getByRole("button", { name: "reset", exact: true }).click();
  await page.getByRole("button", { name: "keep playing", exact: true }).click();
  await expect(page.locator(".pet-cell")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".pet-cell")).toHaveCount(1);
  await page.getByRole("button", { name: "hint", exact: true }).click();
  await expect(page.locator(".hinted")).toHaveCount(1);
  await page.locator(".hinted").click();
  await page.getByRole("button", { name: "undo", exact: true }).click();
  await expect(page.locator(".pet-cell")).toHaveCount(1);
});
test("cross-out mode marks and clears squares without placing pets", async ({
  page,
}) => {
  await page.goto("/?puzzle=1");
  await page.getByRole("button", { name: "cross out", exact: true }).click();
  await page.locator("#cell-0").tap();
  await expect(page.locator("#cell-0")).toHaveAttribute(
    "aria-label",
    /crossed out/,
  );
  await page.locator("#cell-0").tap();
  await expect(page.locator("#cell-0")).toHaveAttribute("aria-label", /empty/);
  await expect(page.locator(".pet-cell")).toHaveCount(0);
});
test("poodles and theme settings persist without changing the puzzle", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "looks", exact: true }).click();
  await page.getByRole("button", { name: /poodles a little curly/ }).click();
  await page.getByRole("button", { name: "more", exact: true }).click();
  await page.getByRole("button", { name: "evening colors" }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await page.getByRole("button", { name: "let’s play" }).click();
  await page.locator("#cell-" + boards[0].solution[0]).click();
  await expect(page.locator(".pet-cell img")).toHaveAttribute(
    "src",
    "/poodle.webp",
  );
});
for (const width of [360, 390, 430])
  test(`phone ${width}: largest board fits and each square owns 44px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/?puzzle=97");
    const metrics = await page.evaluate(() => {
      const cells = [...document.querySelectorAll(".cell")].map((element) => {
        const b = element.getBoundingClientRect();
        return {
          width: b.width,
          height: b.height,
          owns:
            document
              .elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)
              ?.closest(".cell") === element,
        };
      });
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        vertical: document.documentElement.scrollHeight - innerHeight,
        cells,
      };
    });
    expect(metrics.overflow).toBeLessThanOrEqual(0);
    expect(metrics.vertical).toBeLessThanOrEqual(0);
    for (const cell of metrics.cells) {
      expect(cell.width).toBeGreaterThanOrEqual(44);
      expect(cell.height).toBeGreaterThanOrEqual(44);
      expect(cell.owns).toBe(true);
    }
  });
test("help dialog traps focus and closes with Escape", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() => !!document.activeElement?.closest("dialog")),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("a corrupt save is not overwritten by starting or changing skins", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("doku.save.v1", "{broken"),
  );
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("has not been replaced");
  await page.getByRole("button", { name: "let’s play" }).click();
  await page.locator("#cell-0").click();
  expect(await page.evaluate(() => localStorage.getItem("doku.save.v1"))).toBe(
    "{broken",
  );
});
test("completed progress exports, rejects malformed import and confirms replacement", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "more", exact: true }).click();
  await page.getByRole("button", { name: "move saved progress" }).click();
  const code = await page.getByRole("textbox").inputValue();
  await page.getByRole("textbox").fill("{bad");
  await page.getByRole("button", { name: "import code" }).click();
  await expect(page.getByRole("dialog")).toContainText("JSON");
  await page.getByRole("textbox").fill(code);
  await page.getByRole("button", { name: "import code" }).click();
  await expect(page.getByRole("dialog")).toContainText("replaces progress");
  await page.getByRole("button", { name: "cancel", exact: true }).click();
  await expect(page.getByRole("textbox")).toHaveValue(code);
});
test("offline installed navigation and primary flow, including notices", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "let’s play" }).click();
  for (const at of boards[0].solution)
    await page.locator(`#cell-${at}`).click();
  await expect(
    page.getByRole("heading", { name: "everyone’s home." }),
  ).toBeVisible();
  const notices = await page.evaluate(async () =>
    (await fetch("/licenses.md")).text(),
  );
  expect(notices).toContain("svelte");
});
test("all normal flows keep requests on the origin and set no cookies", async ({
  page,
  context,
}) => {
  const outside: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:")) outside.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "let’s play" }).click();
  await page.locator("#cell-0").click();
  await page.getByRole("button", { name: "Back to home" }).click();
  await page.getByRole("button", { name: "more", exact: true }).click();
  await page.getByRole("button", { name: "about doku" }).click();
  expect(outside).toEqual([]);
  expect(await context.cookies()).toEqual([]);
});
test("reduced motion disables pet entrance animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?puzzle=1");
  await page.locator("#cell-0").click();
  expect(
    await page
      .locator(".pet-cell img")
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
});
