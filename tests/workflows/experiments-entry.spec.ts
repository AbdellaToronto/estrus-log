import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("experiment entry", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/experiments-lab");
    await expect(page.getByRole("heading", { name: "Study workspaces" })).toBeVisible();
  });

  test("separates current studies from completed work and removes mock-data ambiguity", async ({ page }) => {
    await expect(page.getByText("Mock Data")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Active and planned" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open workspace" })).toHaveCount(2);
    await expect(page.getByText("Imaging protocol pilot")).toBeHidden();
    await expect(page).toHaveScreenshot("experiments-entry.png", { animations: "disabled", fullPage: true });
  });

  test("creates a study container before cohorts are attached", async ({ page }) => {
    await page.getByRole("button", { name: "New experiment" }).click();
    const dialog = page.getByRole("dialog", { name: "Create an experiment" });
    await expect(dialog.getByLabel("Study name")).toBeVisible();
    await expect(dialog.getByLabel(/Study question or note/)).toBeVisible();
    await expect(dialog.getByLabel(/Start date/)).toBeVisible();
    await expect(dialog.getByLabel(/End date/)).toBeVisible();
    await expect(dialog.getByText("Attach the intended cohorts next.")).toBeVisible();
  });

  test("keeps destructive and completed actions secondary and remains accessible", async ({ page }) => {
    await page.getByText("Completed studies · 1").click();
    await expect(page.getByText("Imaging protocol pilot")).toBeVisible();
    await expect(page.getByLabel("Actions for Imaging protocol pilot")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
