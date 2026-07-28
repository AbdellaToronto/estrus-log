import { expect, test } from "@playwright/test";

test.describe("supervisor demo connected workflow", () => {
  test("makes a mouse card open a usable profile", async ({ page }) => {
    await page.goto("/cohort-lab");
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "Open N-231 profile" }).click();
    const profile = page.getByRole("dialog", { name: "N-231 profile" });
    await expect(profile.getByText("10", { exact: true })).toBeVisible();
    await expect(profile.getByText("observations", { exact: true })).toBeVisible();
    await expect(profile.getByRole("link", { name: "Review one" })).toHaveAttribute("href", "/observation-lab?subject=N-231");
  });

  test("runs a populated batch from analysis through a confirmed scientist stage", async ({ page }) => {
    await page.goto("/batch-lab");
    await page.waitForTimeout(600);
    await expect(page.getByTestId("batch-item-grid").getByRole("button")).toHaveCount(8);
    await page.getByTestId("analyze-batch").click();
    await expect(page.getByRole("button", { name: "Re-run demo analysis" })).toBeVisible();
    await page.getByRole("button", { name: "Proestrus" }).click();
    await page.getByRole("button", { name: "Confirm saved stage" }).click();
    await expect(page.getByRole("button", { name: "Stage confirmed" })).toBeVisible();
    await expect(page.getByText("1 / 8", { exact: true })).toBeVisible();
  });

  test("changes the chart window and filters its recent activity", async ({ page }) => {
    await page.goto("/cohort-lab");
    await page.waitForTimeout(600);
    await page.getByRole("tab", { name: "Trends" }).click();
    await page.getByRole("button", { name: "21 days" }).click();
    await expect(page.getByRole("button", { name: "21 days" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Estrus 31" }).click();
    await expect(page.getByText("Latest Estrus observations")).toBeVisible();
  });
});
