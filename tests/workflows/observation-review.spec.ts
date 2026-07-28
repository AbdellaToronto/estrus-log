import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("scientist-reviewed observation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/observation-lab");
    await expect(page.getByRole("heading", { name: "Review one observation" })).toBeVisible();
  });

  test("keeps the new binary lead ahead of an explicit scientist decision", async ({ page }) => {
    const modelLead = page.getByTestId("model-suggestion-panel");
    const decision = page.getByText("Choose the exact stage", { exact: true });

    await expect(modelLead).toContainText("New model lead");
    await expect(modelLead).toContainText("Proestrus / estrus group");
    await expect(page.getByLabel("Prepared ROI preview")).toBeVisible();
    const zoom = page.getByRole("slider", { name: /^Zoom/ });
    // The lab fixture is already an 83:128 public frame, so it must not be
    // cropped a second time. Full-resolution lab captures start at 10x.
    await expect(zoom).toHaveValue("1");
    await zoom.fill("10.5");
    await expect(zoom).toHaveValue("10.5");
    await expect(page.getByText("Exact model field")).toBeVisible();
    expect(await modelLead.evaluate((node, other) => Boolean(node.compareDocumentPosition(other as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await decision.elementHandle())).toBe(true);
    await expect(page.getByRole("button", { name: /Save confirmed stage/ })).toBeDisabled();
    await expect(page.getByText("No Lab Selected")).toHaveCount(0);
  });

  test("requires an exact stage and acknowledgement before confirming", async ({ page }) => {
    await page.getByRole("button", { name: /Estrus early group/ }).click();
    await expect(page.getByRole("button", { name: /Save confirmed stage/ })).toBeDisabled();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /Save confirmed stage/ }).click();
    await expect(page.getByRole("status")).toContainText("evidence attached");
  });

  test("keeps legacy output and diagnostics behind evidence disclosure", async ({ page }) => {
    await page.getByText("Why this result?", { exact: true }).click();
    await expect(page.getByTestId("legacy-four-stage-disclosure")).toContainText("Legacy four-stage comparison");
    await expect(page.getByTestId("legacy-four-stage-disclosure")).toContainText("Secondary reference");
    await expect(page.getByText(/dark-coat stable/)).toBeVisible();
  });

  test("makes cytology an explicit confirmation source and remains accessible", async ({ page }) => {
    await page.getByLabel("Paired vaginal cytology").check();
    await expect(page.getByText(/Cytology linked/)).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
