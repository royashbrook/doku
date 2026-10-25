import { test, expect } from "@playwright/test";
import boards from "../../src/lib/boards.json" with { type: "json" };

for (const theme of ["day", "night"])
  for (const size of [5, 16]) {
    test(`bold manual and automatic crosses fit the ${size} board in ${theme}`, async ({
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
      const index = boards.findIndex((board) => board.size === size);
      await page.goto(`/?puzzle=${index + 1}`);
      await page.getByRole("button", { name: "cross out", exact: true }).tap();
      const manual = boards[index].solution.includes(0) ? 1 : 0;
      await page.locator(`#cell-${manual}`).tap();
      await page
        .getByRole("button", { name: "place a pet", exact: true })
        .tap();
      await page.locator(`#cell-${boards[index].solution[0]}`).tap();
      await expect(page.locator(".cross")).not.toHaveCount(0);
      const marks = await page.locator(".cell .cross").evaluateAll((els) =>
        els.map((el) => {
          const svg = el as SVGSVGElement,
            cell = el.parentElement!,
            r = cell.getBoundingClientRect();
          const path = svg.querySelector("path") as SVGPathElement;
          const box = path.getBBox(),
            matrix = path.getScreenCTM()!;
          const stroke = Number(svg.getAttribute("stroke-width"));
          const start = new DOMPoint(
            box.x - stroke / 2,
            box.y - stroke / 2,
          ).matrixTransform(matrix);
          const end = new DOMPoint(
            box.x + box.width + stroke / 2,
            box.y + box.height + stroke / 2,
          ).matrixTransform(matrix);
          return {
            coverage: (end.x - start.x) / r.width,
            left: start.x - r.x,
            right: r.right - end.x,
            opacity: getComputedStyle(svg).opacity,
            stroke,
            cap: svg.getAttribute("stroke-linecap"),
            color: getComputedStyle(svg).color,
            edge: getComputedStyle(cell.querySelector(".cross-edge")!).color,
            edgeStroke: Number(
              cell.querySelector(".cross-edge")!.getAttribute("stroke-width"),
            ),
            tile: getComputedStyle(cell).borderRadius,
            fill: getComputedStyle(cell).backgroundColor,
            owns:
              document
                .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
                ?.closest(".cell") === cell,
          };
        }),
      );
      const luminance = (s: string) => {
        const channels = s
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((v) => v / 255);
        return channels
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      };
      for (const mark of marks) {
        expect(mark.coverage).toBeGreaterThan(0.8);
        expect(mark.coverage).toBeLessThan(1);
        expect(mark.left).toBeGreaterThan(0);
        expect(mark.right).toBeGreaterThan(0);
        expect(mark.opacity).toBe("1");
        expect(mark.stroke).toBeGreaterThanOrEqual(3);
        expect(mark.cap).toBe("round");
        expect(mark.owns).toBe(true);
        // A white X with a dark edge: the edge carries the contrast on every
        // colour, and the white face stands out from its own edge.
        expect(mark.edgeStroke).toBeGreaterThan(mark.stroke);
        expect(
          (luminance(mark.fill) + 0.05) / (luminance(mark.edge) + 0.05),
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          (luminance(mark.color) + 0.05) / (luminance(mark.edge) + 0.05),
        ).toBeGreaterThanOrEqual(4.5);
        expect(luminance(mark.color)).toBeGreaterThan(0.9);
        expect(parseFloat(mark.tile)).toBeGreaterThan(0);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(0);
    });
  }

for (const theme of ["day", "night"])
  test(`region labels stay readable over bold crosses in ${theme}`, async ({
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
            labels: true,
            autoCross: true,
            completed: [],
            current: 0,
            boards: {},
          }),
        ),
      theme,
    );
    const index = boards.findIndex((board) => board.size === 16);
    await page.goto(`/?puzzle=${index + 1}`);
    await page.getByRole("button", { name: "cross out", exact: true }).tap();
    const manual = boards[index].solution.includes(0) ? 1 : 0;
    await page.locator(`#cell-${manual}`).tap();
    await page.getByRole("button", { name: "place a pet", exact: true }).tap();
    await page.locator(`#cell-${boards[index].solution[0]}`).tap();
    const labels = await page
      .locator(".crossed .region-label")
      .evaluateAll((els) =>
        els.map((el) => {
          const cell = el.parentElement!,
            cross = cell.querySelector(".cross")!;
          const style = getComputedStyle(el),
            rect = el.getBoundingClientRect(),
            bounds = cell.getBoundingClientRect();
          // Geometry alone cannot prove paint order. Temporarily enable hit-testing on
          // both decorations and ask the browser which one owns the label's pixels.
          (el as HTMLElement).style.pointerEvents = "auto";
          (cross as SVGSVGElement).style.pointerEvents = "auto";
          const topmost =
            document.elementFromPoint(
              rect.x + rect.width / 2,
              rect.y + rect.height / 2,
            ) === el;
          const matrix = (cross as SVGSVGElement).getScreenCTM()!;
          let exposed = 0;
          const points: DOMPoint[] = [];
          for (let step = 0; step <= 10; step++) {
            const t = step / 10;
            for (const x of [6 + 12 * t, 18 - 12 * t]) {
              const point = new DOMPoint(x, 6 + 12 * t).matrixTransform(matrix);
              points.push(point);
              if (
                document
                  .elementFromPoint(point.x, point.y)
                  ?.closest(".cross") === cross
              )
                exposed++;
            }
          }
          // Some subpixel samples fall outside a browser's stroke hit region.
          // Compare exactly the same points with/without the label, not a
          // theoretical SVG stroke rasterisation.
          (el as HTMLElement).style.display = "none";
          const baseline = points.filter(
            (point) =>
              document.elementFromPoint(point.x, point.y)?.closest(".cross") ===
              cross,
          ).length;
          (el as HTMLElement).style.removeProperty("display");
          (el as HTMLElement).style.removeProperty("pointer-events");
          (cross as SVGSVGElement).style.removeProperty("pointer-events");
          return {
            topmost,
            fill: style.backgroundColor,
            cellFill: getComputedStyle(cell).backgroundColor,
            opacity: style.opacity,
            text: el.textContent,
            exposed: exposed / baseline,
            debug: {
              label: [rect.x, rect.y, rect.width, rect.height],
              cell: [bounds.x, bounds.y, bounds.width, bounds.height],
              font: style.fontSize,
              exposed,
              baseline,
            },
            inside:
              rect.left >= bounds.left &&
              rect.right <= bounds.right &&
              rect.top >= bounds.top &&
              rect.bottom <= bounds.bottom,
          };
        }),
      );
    expect(labels.length).toBeGreaterThan(1);
    expect(labels.some((label) => Number(label.text) >= 10)).toBe(true);
    for (const label of labels) {
      expect(label.topmost).toBe(true);
      expect(label.fill).toBe(label.cellFill);
      expect(label.opacity).toBe("1");
      expect(label.inside).toBe(true);
      // A corner-sized mark stays dominant: at least three quarters of its
      // sampled centreline remains exposed even with a two-digit label.
      expect(label.exposed, JSON.stringify(label.debug)).toBeGreaterThanOrEqual(
        0.75,
      );
    }
    const petClear = await page.locator(".pet-cell").evaluateAll((cells) =>
      cells.every((cell) => {
        const label = cell.querySelector(".region-label")!;
        const rect = label.getBoundingClientRect(),
          pet = cell.querySelector(".pet")!.getBoundingClientRect();
        return (
          !rect.width ||
          !(
            rect.left <= pet.x + pet.width / 2 &&
            rect.right >= pet.x + pet.width / 2 &&
            rect.top <= pet.y + pet.height / 2 &&
            rect.bottom >= pet.y + pet.height / 2
          )
        );
      }),
    );
    expect(petClear).toBe(true);
  });

for (const motion of ["no-preference", "reduce"] as const)
  test(`placed pets hop in and respect reduced motion (${motion})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: motion });
    const index = boards.findIndex((board) => board.size === 5);
    await page.goto(`/?puzzle=${index + 1}`);
    await page.getByRole("button", { name: "place a pet", exact: true }).tap();
    await page.locator(`#cell-${boards[index].solution[0]}`).tap();
    const names = await page.locator(".pet-cell .pet").evaluate((pet) => ({
      hop: getComputedStyle(pet).animationName,
      paused: pet.getAttribute("data-paused"),
    }));
    expect(names).toEqual(
      motion === "reduce"
        ? { hop: "none", paused: "true" }
        : {
            hop: "pet-in",
            paused: "false",
          },
    );
  });
