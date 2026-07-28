import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("cohort daily review", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cohort-lab");
    await expect(page.getByRole("heading", { name: "North colony · Cycle study" })).toBeVisible();
  });

  test("prioritizes today's incomplete observations and opens capture directly", async ({ page }) => {
    await expect(page.getByRole("tab", { name: "Today" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("2 of 6 recorded")).toBeVisible();
    await expect(page.getByRole("button", { name: "Needs observation · 4" })).toHaveAttribute("aria-pressed", "true");

    const firstSubject = page.locator("article").first();
    await expect(firstSubject.getByRole("heading", { name: "N-221" })).toBeVisible();
    await expect(firstSubject.getByText("Due today")).toBeVisible();
    await expect(firstSubject.getByRole("link", { name: "Record observation" })).toHaveAttribute("href", /\/subjects\/.+\?new=1$/);

    await expect(page).toHaveScreenshot("cohort-today-workspace.png", { animations: "disabled", fullPage: true });
  });

  test("keeps record identity visible without hover or hidden image crops", async ({ page }) => {
    await page.getByRole("tab", { name: "Records" }).click();
    await expect(page.getByRole("tabpanel", { name: "Records" })).toBeVisible();
    await expect(page.getByText("N-222")).toBeVisible();
    await expect(page.getByText("Scientist reviewed").first()).toBeVisible();
    await expect(page).toHaveScreenshot("cohort-records-workspace.png", { animations: "disabled", fullPage: true });
  });

  test("puts new binary evidence ahead of legacy support", async ({ page }) => {
    await page.getByRole("tab", { name: "Trends" }).click();
    const panel = page.getByRole("tabpanel", { name: "Trends" });
    await expect(panel.getByText("New binary review")).toBeVisible();
    await expect(panel.getByText("18", { exact: true })).toBeVisible();
    await expect(panel.getByText("15", { exact: true })).toBeVisible();
    await expect(panel.getByText("Legacy four-stage model support")).toBeVisible();
    await expect(page).toHaveScreenshot("cohort-new-model-trends.png", { animations: "disabled", fullPage: true });
  });

  test("turns evaluation into a provenance-first grouped-preflight gate", async ({ page }) => {
    await page.getByRole("tab", { name: "Evaluation" }).click();
    const panel = page.getByRole("tabpanel", { name: "Evaluation" });
    await expect(panel.getByRole("heading", { name: "Ready for grouped preflight" })).toBeVisible();
    await expect(panel.getByText("4 external photos have an exact stage confirmed from a paired cytology record.")).toBeVisible();
    await expect(panel.getByText("2 visual-only records excluded · 0 transition pairs held out")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Export preflight manifest" })).toBeEnabled();
    await expect(panel.getByText("Legacy filename import QA")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    await expect(page).toHaveScreenshot("cohort-evaluation-readiness.png", { animations: "disabled", fullPage: true });
  });

  test("hands an evaluation gap back to the visible record library", async ({ page }) => {
    await page.getByRole("tab", { name: "Evaluation" }).click();
    await page.getByRole("button", { name: "Review records" }).click();
    await expect(page.getByRole("tab", { name: "Records" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Cytology paired").first()).toBeVisible();
  });

  test("passes an automated accessibility scan", async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("hydrates without application console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "North colony · Cycle study" })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
