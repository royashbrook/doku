import { test, expect } from "@playwright/test";

// Puzzle 119 (8 × 8) opens with a four-step explanation: two colors stuck in
// one row, one square that would block a row, then a row with one square left.
test("why? walks through a hint step by step and lights the board", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?puzzle=119");
  await page.getByRole("button", { name: "hint", exact: true }).tap();
  const target = await page.locator(".hinted").getAttribute("data-cell");
  await page.getByRole("button", { name: "why?", exact: true }).tap();
  const line = page.locator(".hint-line");
  await expect(line).toContainText("1 of 4.");
  await expect(
    page.getByRole("button", { name: "back", exact: true }),
  ).toBeDisabled();
  for (let step = 1; step <= 4; step++) {
    await expect(line).toContainText(`${step} of 4.`);
    const board = await page.locator(".board .cell").evaluateAll((cells) =>
      cells.map((cell) => ({
        focus: cell.classList.contains("focus"),
        ruled: cell.classList.contains("ruled"),
        opacity: Number(getComputedStyle(cell).opacity),
        hinted: cell.classList.contains("hinted"),
      })),
    );
    // The step's squares are lit and everything else fades back.
    expect(board.some((c) => c.focus)).toBe(true);
    for (const c of board) expect(c.opacity < 0.5).toBe(!c.focus && !c.hinted);
    // Every step but the last rules something out, shown on the board.
    expect(board.some((c) => c.ruled)).toBe(step < 4);
    if (step < 4)
      await page.getByRole("button", { name: "next", exact: true }).tap();
  }
  await expect(line).toContainText("only one square is left");
  await page.getByRole("button", { name: "done", exact: true }).tap();
  await expect(page.locator(".board.explaining")).toHaveCount(0);
  await expect(page.locator(".hinted")).toHaveAttribute("data-cell", target!);
  // A move clears the hint, and the hint button comes back.
  await page.locator(`#cell-${target}`).dblclick();
  await expect(
    page.getByRole("button", { name: "hint", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

// A longer explanation never claims "one square left" before why?, and a
// one-step hint lights the color it talks about right away.
test("the hint line only says what the board already shows", async ({
  page,
}) => {
  const line = page.locator(".hint-line");
  await page.goto("/?puzzle=119");
  await page.getByRole("button", { name: "hint", exact: true }).tap();
  await expect(line).toContainText("Tap why? to see how we know.");
  await expect(line).not.toContainText("one square is left");
  await expect(page.locator(".board.explaining")).toHaveCount(0);
  await page.goto("/?puzzle=33");
  await page.getByRole("button", { name: "hint", exact: true }).tap();
  await expect(line).toContainText("Only one square is left in this color.");
  await expect(page.locator(".board.explaining")).toHaveCount(1);
  // Every square of that color is lit, and nothing else.
  const board = await page.locator(".board .cell").evaluateAll((cells) =>
    cells.map((c) => ({
      color: getComputedStyle(c).getPropertyValue("--region"),
      focus: c.classList.contains("focus"),
    })),
  );
  const color = board.find((c) => c.focus)!.color;
  for (const c of board) expect(c.focus).toBe(c.color === color);
  await expect(page.locator(".cell.focus.hinted")).toHaveCount(1);
});

// A long walk can always be left partway, without losing the hint.
test("close leaves the walkthrough from any step", async ({ page }) => {
  await page.goto("/?puzzle=119");
  await page.getByRole("button", { name: "hint", exact: true }).tap();
  const target = await page.locator(".hinted").getAttribute("data-cell");
  const close = page.getByRole("button", { name: "close", exact: true });
  for (const steps of [0, 1, 3]) {
    await page.getByRole("button", { name: "why?", exact: true }).tap();
    for (let i = 0; i < steps; i++)
      await page.getByRole("button", { name: "next", exact: true }).tap();
    await expect(page.locator(".hint-line")).toContainText(
      `${steps + 1} of 4.`,
    );
    await close.tap();
    await expect(page.locator(".board.explaining")).toHaveCount(0);
    await expect(close).toHaveCount(0);
    await expect(page.locator(".hinted")).toHaveAttribute("data-cell", target!);
  }
});
