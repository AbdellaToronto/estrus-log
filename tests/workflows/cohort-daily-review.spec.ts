import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("cohort daily review", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cohort-lab");
    await expect(page.getByRole("heading", { name: "North colony · Cycle study" })).toBeVisible();
  });

  test("prioritizes today's incomplete observations and opens a real profile", async ({ page }) => {
    await expect(page.getByRole("tab", { name: "Today" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("7 of 12 reviewed and saved")).toBeVisible();
    await expect(page.getByRole("button", { name: "Awaiting analysis · 5" })).toHaveAttribute("aria-pressed", "true");

    const firstSubject = page.locator("article").first();
    await expect(firstSubject.getByRole("heading", { name: "N-228" })).toBeVisible();
    await expect(firstSubject.getByText("Awaiting photograph")).toBeVisible();
    await firstSubject.getByRole("button", { name: "Open N-228 profile" }).click();
    await expect(page.getByRole("dialog", { name: "N-228 profile" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Analyze one" })).toHaveAttribute("href", "/observation-lab?subject=N-228");

    await expect(page).toHaveScreenshot("cohort-today-workspace.png", { animations: "disabled", fullPage: true });
  });

  test("keeps record identity visible without hover or hidden image crops", async ({ page }) => {
    await page.getByRole("tab", { name: "Records" }).click();
    await expect(page.getByRole("tabpanel", { name: "Records" })).toBeVisible();
    await expect(page.getByRole("tabpanel", { name: "Records" }).getByText("N-222").first()).toBeVisible();
    await expect(page.getByText("Scientist reviewed").first()).toBeVisible();
    await expect(page).toHaveScreenshot("cohort-records-workspace.png", { animations: "disabled", fullPage: true });
  });

  test("keeps the independent guardrail separate from exact-stage support", async ({ page }) => {
    await page.getByRole("tab", { name: "Trends" }).click();
    const panel = page.getByRole("tabpanel", { name: "Trends" });
    await expect(panel.getByText("Independent guardrail review")).toBeVisible();
    await expect(panel.getByText("127", { exact: true })).toBeVisible();
    await expect(panel.getByText("114", { exact: true })).toBeVisible();
    await expect(panel.getByText("Exact-stage model support by saved stage")).toBeVisible();
    await expect(page).toHaveScreenshot("cohort-new-model-trends.png", { animations: "disabled", fullPage: true });
  });

  test("turns evaluation into a provenance-first grouped-preflight gate", async ({ page }) => {
    await page.getByRole("tab", { name: "Evaluation" }).click();
    const panel = page.getByRole("tabpanel", { name: "Evaluation" });
    await expect(panel.getByRole("heading", { name: "Ready for grouped preflight" })).toBeVisible();
    await expect(panel.getByText(/external photos have an exact stage confirmed from a paired cytology record/)).toBeVisible();
    await expect(panel.getByText(/visual-only records excluded/)).toBeVisible();
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
