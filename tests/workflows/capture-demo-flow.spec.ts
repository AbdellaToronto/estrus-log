import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Walks every step of the public demo and captures a screenshot of each.
 *
 * Separate from the assertion suites: this exists to produce a visual record of
 * the journey for review, not to gate a change. Captures go to
 * work/demo-flow/ which is gitignored.
 *
 * Run with:
 *   npx playwright test --config=playwright.workflow.config.ts \
 *     tests/workflows/capture-demo-flow.spec.ts
 */

const OUT = join(process.cwd(), "work", "demo-flow");

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
});

test.describe("demo flow capture", () => {
  test.setTimeout(300_000);

  test("captures every step a reviewer walks through", async ({ page }) => {
    const shot = async (name: string, fullPage = false) => {
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
    };

    await page.goto("/demo");
    await expect(page.getByRole("heading", { name: "Prediction inbox" })).toBeVisible();

    // 1. Triage: what lands in front of the scientist each morning.
    await shot("01-prediction-inbox");

    // 2. An exception rather than a clean accept.
    await page.getByRole("button", { name: /N-225/ }).click();
    await shot("02-needs-attention");

    // 3. Correcting a prediction rather than accepting it.
    await page.getByRole("button", { name: /Correct prediction/ }).click();
    await shot("03-correcting");

    // 4. Accept the rest so the receipt has real decisions in it.
    await page.getByRole("button", { name: /^Proestrus$/ }).first().click();
    for (let i = 0; i < 8; i += 1) {
      const accept = page.getByRole("button", { name: /^✓?\s*Accept / });
      if (!(await accept.isVisible().catch(() => false))) break;
      await accept.click();
      await page.waitForTimeout(150);
    }
    await shot("04-day-complete", true);

    // 5. The provenance-rich record.
    await page.getByRole("button", { name: "Review receipt", exact: true }).click();
    await shot("05-review-receipt", true);

    // 6. Longitudinal history.
    await page.getByRole("button", { name: "Day complete", exact: true }).click();
    await shot("06-longitudinal-history", true);

    // 7. Live analysis, before anything is uploaded.
    await page.getByRole("button", { name: /Analyze a photo/ }).click();
    await expect(
      page.getByRole("heading", { name: "Analyze a photograph" })
    ).toBeVisible();
    await shot("07-analyze-idle", true);

    // 8. Streamed progress. Captured mid-flight, so the stage checklist and the
    //    running clock are both visible.
    await page.setInputFiles(
      'input[type="file"]',
      join(process.cwd(), "public", "assets", "demo", "s-biad2395", "n-221.png")
    );
    await expect(page.getByText("Analyzing")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2_500);
    await shot("08-analyzing");

    // 9. The result: validated binary call, derived four-stage estimate,
    //    nearest references, and the guards.
    await expect(page.getByText(/Four-stage estimate/)).toBeVisible({
      timeout: 240_000,
    });
    await shot("09-result", true);

    // 10. The cycle-history control changing the four-stage split.
    const stageSelect = page.locator("select").first();
    await stageSelect.selectOption("Estrus");
    await page.waitForTimeout(600);
    await shot("10-result-with-history", true);

    // 11. Provenance and roadmap.
    await page.getByText("A published method, reproduced").scrollIntoViewIfNeeded();
    await shot("11-provenance");

    // 12. Mobile, since a scientist reviews at the cage rack.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/demo");
    await shot("12-mobile-inbox", true);
  });
});
