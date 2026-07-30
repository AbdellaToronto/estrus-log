import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Captures the upload paths for both coat colours, plus batch evaluation.
 *
 * The point of running both coats is that they exercise opposite behaviour: a
 * white-coated photograph is inside the validated reference set and gets a
 * backed answer, a dark-coated one is outside it and should be declined. A demo
 * that only ever shows the first is not showing the model honestly.
 *
 * Captures go to work/demo-flow/, which is gitignored. Assertions here are
 * minimal on purpose — this produces evidence, it does not gate a change.
 */

const OUT = join(process.cwd(), "work", "demo-flow");
const FIXTURES = join(process.cwd(), "work", "eval-fixtures");

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
});

test.describe("upload evaluation capture", () => {
  test.setTimeout(600_000);

  const shotOf = (page: import("@playwright/test").Page) =>
    async (name: string, fullPage = true) => {
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
    };

  test("white-coated upload gets a guard-backed answer", async ({ page }) => {
    const shot = shotOf(page);
    await page.goto("/demo");
    await page.getByRole("button", { name: /Analyze a photo/ }).click();
    await expect(page.getByRole("heading", { name: "Analyze a photograph" })).toBeVisible();

    await page.setInputFiles(
      'input[type="file"]',
      join(process.cwd(), "public", "assets", "demo", "s-biad2395", "n-224.png")
    );
    await expect(page.getByText(/Four-stage estimate/)).toBeVisible({ timeout: 300_000 });

    // The guards should have backed this one.
    await expect(page.getByText("Reference-backed suggestion")).toBeVisible();
    await shot("20-white-coat-backed");
  });

  test("dark-coated upload is declined and says why", async ({ page }) => {
    const shot = shotOf(page);
    await page.goto("/demo");
    await page.getByRole("button", { name: /Analyze a photo/ }).click();
    await expect(page.getByRole("heading", { name: "Analyze a photograph" })).toBeVisible();

    await page.setInputFiles(
      'input[type="file"]',
      join(FIXTURES, "dark_estrus.jpg")
    );
    await expect(page.getByText(/Four-stage estimate/)).toBeVisible({ timeout: 300_000 });

    // The call is shown, flagged as ahead of where validation currently reaches.
    await expect(page.getByText("Not yet validated for this coat")).toBeVisible();
    await expect(page.getByText("Shown, but not yet backed by validation")).toBeVisible();
    await shot("21-dark-coat-unvalidated");
  });

  test("batch evaluation scores a mixed folder", async ({ page }) => {
    const shot = shotOf(page);
    await page.goto("/demo");
    await page.getByRole("button", { name: /Batch evaluation/ }).click();
    await expect(
      page.getByRole("heading", { name: "Evaluate a folder at once" })
    ).toBeVisible();
    await shot("22-batch-idle");

    // The bundled set, run the way a visitor would: one button, no files needed.
    await page.getByRole("button", { name: /Run the batch/ }).click();

    await expect(page.getByText(/Analysing/)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(4_000);
    await shot("23-batch-running");

    await expect(page.getByText(/8 photographs analysed/)).toBeVisible({
      timeout: 420_000,
    });
    await shot("24-batch-complete");
  });
});
