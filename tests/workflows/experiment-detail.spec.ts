import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("experiment detail", () => {
  test("leads with study scope, collection integrity, and bounded model evidence", async ({ page }) => {
    await page.goto("/experiment-detail-lab");

    await expect(page.getByRole("heading", { name: "Diet intervention · Cycle timing" })).toBeVisible();
    await expect(page.getByText("Collection integrity")).toBeVisible();
    await expect(page.getByText("21 confirmed · 2 uncertain")).toBeVisible();
    await expect(page.getByText("Binary group evidence, never the saved stage.")).toBeVisible();
    await expect(page.getByText("Exact stage remains scientist-controlled")).toBeVisible();
    await expect(page).toHaveScreenshot("experiment-detail-summary.png", {
      animations: "disabled",
      fullPage: true,
    });
  });

  test("shows every subject-day and makes missing observations explicit", async ({ page }) => {
    await page.goto("/experiment-detail-lab");
    await page.getByRole("tab", { name: "Cycle atlas" }).click();

    await expect(page.getByText("Blank cells are missing observations, not inferred stages.")).toBeVisible();
    await expect(page.getByTitle("D02 · 2026-07-16 · Missing")).toBeVisible();
    await expect(page.getByText("96% subject-day coverage")).toBeVisible();
    await expect(page).toHaveScreenshot("experiment-cycle-atlas.png", {
      animations: "disabled",
      fullPage: true,
    });
  });

  test("keeps scientist stage, provenance, and binary review in separate record columns", async ({ page }) => {
    await page.goto("/experiment-detail-lab");
    await page.getByRole("tab", { name: "Records" }).click();

    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader", { name: "Scientist stage" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Provenance" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Binary review" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Confidence" })).toHaveCount(0);
    await expect(table.getByText("Paired cytology").first()).toBeVisible();
    await expect(table.getByText("Abstained").first()).toBeVisible();

    await page.getByRole("button", { name: "Export manifest" }).click();
    const dialog = page.getByRole("dialog", { name: "Export this study’s provenance manifest" });
    await expect(dialog.getByText("scoped to the attached cohorts")).toBeVisible();
    await expect(dialog.getByText("prepared ROI")).toBeVisible();
  });

  test("has no hydration warnings and passes the automated accessibility scan", async ({ page }) => {
    const hydrationWarnings: string[] = [];
    page.on("console", (message) => {
      if (/hydration|did not match|server rendered html/i.test(message.text())) {
        hydrationWarnings.push(message.text());
      }
    });

    await page.goto("/experiment-detail-lab");
    await page.getByRole("tab", { name: "Cycle atlas" }).click();
    await expect(page.getByTitle("D02 · 2026-07-16 · Missing")).toBeVisible();
    expect(hydrationWarnings).toEqual([]);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
