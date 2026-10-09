import { expect, test, type Page } from "@playwright/test";

// Brief, Part 1: "We will open five random pages. Every filter pill should be
// the same size, every primary button the same colour and shape, and spacing
// should match." This opens EVERY backend page and compares computed styles.

const PAGES = [
  "/store",
  "/store/design",
  "/store/content",
  "/store/pages",
  "/store/domain",
  "/core/inventory",
  "/core/inventory/new",
  "/core/pos",
  "/core/sales",
  "/core/repairs",
  "/core/repairs/new",
  "/core/repair-prices",
  "/core/buybacks",
  "/core/buyback-prices",
  "/core/settings",
];

const STYLE_PROPS = ["height", "padding-left", "padding-right", "border-radius", "font-size", "font-weight", "font-family", "background-color", "color"] as const;

async function stylesOf(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((els, props) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null) // visible only
      .map((el) => {
        const cs = getComputedStyle(el);
        return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
      }),
    STYLE_PROPS as unknown as string[],
  );
}

test("every backend page uses identical pills, buttons, titles and spacing", async ({ page }) => {
  const seen = { pill: new Set<string>(), primary: new Set<string>(), secondary: new Set<string>(), title: new Set<string>(), page: new Set<string>(), input: new Set<string>() };
  const record = (key: keyof typeof seen, styles: object[]) => styles.forEach((s) => seen[key].add(JSON.stringify(s)));

  for (const path of PAGES) {
    await test.step(path, async () => {
      const response = await page.goto(path);
      expect(response?.status(), `${path} loads`).toBeLessThan(400);
      await expect(page.locator('[data-ui="page-title"]')).toBeVisible();
      await page.waitForLoadState("networkidle");

      // Pills differ only in selected state; compare shape, not colour.
      const pills = await stylesOf(page, '[data-ui="pill"]');
      record("pill", pills.map(({ height, "padding-left": pl, "border-radius": r, "font-size": fs, "font-weight": fw }) => ({ height, pl, r, fs, fw })));
      record("primary", await stylesOf(page, '[data-ui="button-primary-md"]'));
      record("secondary", await stylesOf(page, '[data-ui="button-secondary-md"]'));
      record("title", await stylesOf(page, '[data-ui="page-title"]'));
      // Inputs with a "€" / "%" affix get extra side padding by design.
      const inputs = await stylesOf(page, '[data-ui="input"]');
      record("input", inputs.map((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !k.startsWith("padding")))));
      const padding = await page.locator('[data-ui="page"]').first().evaluate((el) => {
        const cs = getComputedStyle(el);
        return { pt: cs.paddingTop, pl: cs.paddingLeft, maxWidth: cs.maxWidth, gap: cs.rowGap };
      });
      seen.page.add(JSON.stringify(padding));

      // Next keeps recently visited pages in the DOM (hidden), so ids must be
      // unique app-wide or labels attach to the wrong (hidden) control.
      const duplicates = await page.evaluate(() => {
        const counts = new Map<string, number>();
        document.querySelectorAll("[id]").forEach((el) => counts.set(el.id, (counts.get(el.id) ?? 0) + 1));
        return [...counts].filter(([, n]) => n > 1).map(([id]) => id);
      });
      expect(duplicates, `duplicate ids after visiting ${path}`).toEqual([]);
    });
  }

  for (const [key, variants] of Object.entries(seen)) {
    expect([...variants], `${key}: all instances must share one style`).toHaveLength(1);
  }
});
