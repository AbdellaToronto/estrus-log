import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("AI-assisted single observation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/observation-lab");
    await expect(page.getByRole("heading", { name: "AI prediction review" })).toBeVisible();
  });

  test("leads with an exact-stage proposal and all four support scores", async ({ page }) => {
    const modelLead = page.getByTestId("model-suggestion-panel");

    await expect(modelLead).toContainText("AI stage prediction");
    await expect(modelLead).toContainText("Estrus");
    await expect(modelLead.getByLabel("Four-stage model support")).toContainText("Proestrus");
    await expect(modelLead.getByLabel("Four-stage model support")).toContainText("Diestrus");
    await expect(page.getByLabel("Prepared ROI preview")).toBeVisible();
    const zoom = page.getByRole("slider", { name: /^Zoom/ });
    // The lab fixture is already an 83:128 public frame, so it must not be
    // cropped a second time. Full-resolution lab captures start at 10x.
    await expect(zoom).toHaveValue("1");
    await zoom.fill("10.5");
    await expect(zoom).toHaveValue("10.5");
    await expect(page.getByText("Exact model field")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save confirmed stage" })).toBeDisabled();
    await expect(page.getByText("No Lab Selected")).toHaveCount(0);
  });

  test("requires accepting or correcting the AI proposal before saving", async ({ page }) => {
    await page.getByRole("button", { name: "Accept Estrus" }).click();
    await expect(page.getByRole("button", { name: "Save confirmed stage" })).toBeDisabled();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Save confirmed stage" }).click();
    await expect(page.getByRole("status")).toContainText("evidence attached");
  });

  test("keeps exact-stage provenance and guardrail diagnostics behind disclosure", async ({ page }) => {
    await page.getByText("Why this result?", { exact: true }).click();
    await expect(page.getByTestId("legacy-four-stage-disclosure")).toContainText("Exact-stage model proposal");
    await expect(page.getByText("Independent guardrail", { exact: true })).toBeVisible();
    await expect(page.getByText(/dark-coat stable/)).toBeVisible();
  });

  test("makes cytology an explicit confirmation source and remains accessible", async ({ page }) => {
    await page.getByLabel("Paired vaginal cytology").check();
    await expect(page.getByText(/Cytology linked/)).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
