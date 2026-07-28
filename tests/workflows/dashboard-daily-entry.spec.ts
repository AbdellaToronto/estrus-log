import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("dashboard daily entry", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard-lab");
    await expect(page.getByRole("heading", { name: "Daily lab briefing" })).toBeVisible();
  });

  test("starts with outstanding cohort work instead of historical analytics", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "4 mice still need a record" })).toBeVisible();
    await expect(page.getByText("8 of 12 active mice recorded")).toBeVisible();

    const north = page.getByRole("article").filter({ hasText: "North colony · Cycle study" });
    await expect(north.getByText("4 due", { exact: true }).first()).toBeVisible();
    await expect(north.getByRole("link", { name: "Open cohort" })).toHaveAttribute("href", /\/cohorts\/.+$/);
    await expect(north.getByRole("link", { name: "Bulk" })).toHaveAttribute("href", /\/cohorts\/.+\/batch$/);

    await expect(page.getByText("Recent entries")).toBeHidden();
    await expect(page).toHaveScreenshot("dashboard-daily-entry.png", { animations: "disabled", fullPage: true });
  });

  test("keeps history available through progressive disclosure", async ({ page }) => {
    await page.getByText("Recent activity and 7-day stage mix").click();
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
    await expect(page.getByRole("heading", { name: "Daily lab briefing" })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    expect(errors).toEqual([]);
  });
});
