import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("first mouse cohort", () => {
  test("starts with the mouse-estrus cohort contract instead of generic templates", async ({ page }) => {
    await page.goto("/onboarding-flow-lab");

    await expect(page.getByRole("heading", { name: "Name your first mouse cohort" })).toBeVisible();
    await expect(page.getByText("Proestrus")).toBeVisible();
    await expect(page.getByText("coat colour and strain")).toBeVisible();
    await expect(page.getByText("Cell Culture Health")).toHaveCount(0);
    await expect(page.getByText("Plant Phenotyping")).toHaveCount(0);
    await expect(page.getByText("Wound Healing Assessment")).toHaveCount(0);
    await expect(page).toHaveScreenshot("first-mouse-cohort.png", {
      animations: "disabled",
      fullPage: true,
    });
  });

  test("sends a new cohort to subject identity before capture", async ({ page }) => {
    await page.goto("/onboarding-flow-lab");
    await page.getByRole("textbox", { name: "Cohort name" }).fill("Control · North colony");
    await page.getByRole("textbox", { name: "Study note" }).fill("Baseline animals under the standard diet protocol.");
    await page.getByRole("button", { name: "Create mouse cohort" }).click();

    await expect(page.getByRole("heading", { name: "Cohort ready" })).toBeVisible();
    await expect(page.getByText(/Add mouse identities, then let the AI prepare the first prediction inbox/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Add mouse subjects" })).toBeVisible();
    await expect(page.getByText("Bulk capture appears in the cohort workspace once subject identities are available.")).toBeVisible();
    await expect(page).toHaveScreenshot("first-cohort-subject-handoff.png", {
      animations: "disabled",
      fullPage: true,
    });
  });

  test("keeps both setup states accessible", async ({ page }) => {
    await page.goto("/onboarding-flow-lab");
    let results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);

    await page.getByRole("textbox", { name: "Cohort name" }).fill("Control cohort");
    await page.getByRole("button", { name: "Create mouse cohort" }).click();
    results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
