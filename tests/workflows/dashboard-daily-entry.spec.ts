import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("prediction inbox entry", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard-lab");
    await expect(page.getByRole("heading", { name: "Prediction inbox" })).toBeVisible();
  });

  test("starts with exact-stage AI proposals instead of manual data entry", async ({ page }) => {
    const predictionHeader = page.getByRole("heading", { name: "AI predicts Metestrus" }).locator("..").locator("..");
    await expect(predictionHeader).toContainText("68%");
    await expect(predictionHeader).toContainText("model support");
    await expect(page.getByLabel("Four-stage model support")).toContainText("Metestrus");
    await expect(page.getByRole("button", { name: "N-225 Estrus 43%" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Analyze photographs" })).toHaveAttribute("href", /\/cohorts\/.+\/batch$/);
    await expect(page.getByText("Recent entries")).toBeHidden();
    await expect(page).toHaveScreenshot("dashboard-daily-entry.png", { animations: "disabled", fullPage: true });
  });

  test("keeps history available through progressive disclosure", async ({ page }) => {
    await page.getByText("Confirmed history and 7-day stage mix").click();
    await expect(page.getByText("7-Day Activity")).toBeVisible();
    await expect(page.getByText("Recent entries")).toBeVisible();
    await expect(page.getByText("N-222")).toBeVisible();
  });

  test("passes accessibility and hydration checks", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Prediction inbox" })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    expect(errors).toEqual([]);
  });
});
