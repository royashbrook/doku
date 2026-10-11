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
    "/poodles-faces.webp",
  );
});
for (const width of [360, 390, 430])
  test(`phone ${width}: 8 by 8 board fits and each square owns 44px`, async ({
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
  const atlases = await page.evaluate(async () =>
    Promise.all(
      ["/cats-faces.webp", "/poodles-faces.webp"].map(async (path) => {
        const response = await fetch(path);
        return {
          ok: response.ok,
          bytes: (await response.arrayBuffer()).byteLength,
        };
      }),
    ),
  );
  for (const atlas of atlases) {
    expect(atlas.ok).toBe(true);
    expect(atlas.bytes).toBeGreaterThan(1000);
  }
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
test("reduced motion disables pet entrance, glances and blinks", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?puzzle=1");
  await page.locator("#cell-0").click();
  expect(
    await page
      .locator(".pet-cell img")
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  expect(
    await page
      .locator(".pet-cell .pet")
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
});

test("pet identities survive reload and skin changes, with visible glance and blink frames", async ({
  page,
}) => {
  await page.goto("/?puzzle=1");
  for (const at of boards[0].solution.slice(0, 4))
    await page.locator(`#cell-${at}`).tap();
  const pets = page.locator(".pet-cell .pet");
  const identities = await pets.evaluateAll((elements) =>
    elements.map((pet) => pet.getAttribute("data-face")),
  );
  expect(new Set(identities).size).toBe(4);
  await page.reload();
  expect(
    await pets.evaluateAll((elements) =>
      elements.map((pet) => pet.getAttribute("data-face")),
    ),
  ).toEqual(identities);

  const samples = await pets.first().evaluate(async (pet) => {
    const image = pet.querySelector("img")!;
    await image.decode();
    const frame = image.parentElement!;
    const animation = image.getAnimations()[0];
    animation.pause();
    const timing = animation.effect!.getTiming();
    const positions = [];
    for (const progress of [0.1, 0.35, 0.65, 0.195]) {
      animation.currentTime =
        Number(timing.delay) + Number(timing.duration) * progress;
      positions.push(
        Math.round(
          parseFloat(getComputedStyle(image).left) / frame.clientWidth,
        ),
      );
    }
    return {
      positions,
      row: Math.round(
        parseFloat(getComputedStyle(image).top) / frame.clientHeight,
      ),
    };
  });
  expect(samples.positions).toEqual([0, -1, -2, -3]);
  expect(samples.row + Number(identities[0])).toBe(0);

  await page.getByRole("button", { name: "looks", exact: true }).click();
  await page.getByRole("button", { name: /poodles a little curly/ }).click();
  await page.getByRole("button", { name: "play", exact: true }).click();
  expect(
    await pets.evaluateAll((elements) =>
      elements.map((pet) => pet.getAttribute("data-face")),
    ),
  ).toEqual(identities);
  await expect(pets.first().locator("img")).toHaveAttribute(
    "src",
    "/poodles-faces.webp",
  );
});

test("visibility handler pauses and resumes decorative faces", async ({
  page,
}) => {
  await page.goto("/?puzzle=1");
  await page.locator("#cell-0").tap();
  const image = page.locator(".pet-cell img");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() =>
      image.evaluate((element) => getComputedStyle(element).animationPlayState),
    )
    .toBe("paused");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() =>
      image.evaluate((element) => getComputedStyle(element).animationPlayState),
    )
    .toBe("running");
});

test("every pet surface clips one full-size face, including compact home and looks", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const assertFrames = async (selector: string) =>
    expect(async () => {
      const frames = await page.locator(selector).evaluateAll((elements) =>
        elements.map((pet) => {
          const frame = pet.querySelector(".pet-face")!.getBoundingClientRect();
          const image = pet.querySelector("img")!.getBoundingClientRect();
          return {
            width: frame.width,
            height: frame.height,
            imageWidth: image.width,
            imageHeight: image.height,
          };
        }),
      );
      expect(frames.length).toBeGreaterThan(0);
      for (const frame of frames) {
        expect(frame.width).toBeGreaterThan(20);
        expect(frame.height).toBeCloseTo(frame.width, 1);
        expect(frame.imageWidth).toBeCloseTo(frame.width * 4, 1);
        expect(frame.imageHeight).toBeCloseTo(frame.height * 4, 1);
      }
    }).toPass({ timeout: 5000 });
  await page.goto("/");
  await assertFrames(".pet-bubble .pet");
  await page.getByRole("button", { name: "looks", exact: true }).click();
  await assertFrames(".skin-choices .pet");
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  await assertFrames(".how-pet .pet");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "play", exact: true }).click();
  for (const at of boards[0].solution) await page.locator(`#cell-${at}`).tap();
  await assertFrames(".win-pets .pet");
  const payoff = await page.locator(".win").evaluate((panel) => {
    const box = panel.getBoundingClientRect();
    return [...panel.children].map((child) => {
      const bounds = child.getBoundingClientRect();
      return { above: bounds.top < box.top, below: bounds.bottom > box.bottom };
    });
  });
  expect(payoff).toEqual(payoff.map(() => ({ above: false, below: false })));
});
test("the color row shows each region's pet once it is placed", async ({
  page,
}) => {
  const index = boards.findIndex((board) => board.size === 16);
  await page.goto(`/?puzzle=${index + 1}`);
  const row = page.getByRole("list", { name: "Colors" }).getByRole("listitem");
  await expect(row).toHaveCount(16);
  await expect(row.locator(".pet")).toHaveCount(0);
  const at = boards[index].solution[0];
  const region = boards[index].regions[at];
  await page.locator(`#cell-${at}`).click();
  await expect(row.locator(".pet")).toHaveCount(1);
  await expect(row.nth(region)).toHaveAttribute("aria-label", /: cat$/);
  await expect(row.nth(region).locator(".pet")).toHaveCount(1);
  const swatch = await row.nth(region).evaluate((li) => {
    const cell = document.querySelector(`#cell-${CSS.escape(String(0))}`)!;
    return {
      color: getComputedStyle(li).backgroundColor,
      bottom: li.getBoundingClientRect().bottom,
      top: cell.getBoundingClientRect().top,
    };
  });
  const cellColor = await page
    .locator(`#cell-${at}`)
    .evaluate((cell) => getComputedStyle(cell).backgroundColor);
  expect(swatch.color).toBe(cellColor);
  expect(swatch.bottom).toBeLessThan(swatch.top);
  await page.locator(`#cell-${at}`).click();
  await expect(row.locator(".pet")).toHaveCount(0);
});
test("a frame over the board redraws the corners the rounded clip cuts", async ({
  page,
}) => {
  await page.goto("/?puzzle=1");
  const frame = await page.locator(".board-wrap").evaluate((wrap) => {
    const ring = getComputedStyle(wrap, "::after");
    const board = wrap.querySelector(".board")!.getBoundingClientRect();
    const box = wrap.getBoundingClientRect();
    return {
      content: ring.content,
      width: ring.borderTopWidth,
      radius: ring.borderTopLeftRadius,
      pointer: ring.pointerEvents,
      covers: [
        board.left - box.left,
        board.top - box.top,
        board.width - box.width,
      ],
    };
  });
  expect(frame).toEqual({
    content: '""',
    width: "2px",
    radius: "16px",
    pointer: "none",
    covers: [0, 0, 0],
  });
});
