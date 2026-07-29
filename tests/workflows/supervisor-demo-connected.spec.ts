import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("supervisor demo connected workflow", () => {
  test("makes a mouse card open a usable profile", async ({ page }) => {
    await page.goto("/cohort-lab");
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "Open N-231 profile" }).click();
    const profile = page.getByRole("dialog", { name: "N-231 profile" });
    await expect(profile.getByText("10", { exact: true })).toBeVisible();
    await expect(profile.getByText("observations", { exact: true })).toBeVisible();
    await expect(profile.getByRole("link", { name: "Analyze one" })).toHaveAttribute("href", "/observation-lab?subject=N-231");
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

  test("turns a completed AI review into an explorable longitudinal record", async ({ page }) => {
    await page.goto("/supervisor-demo");
    await page.getByRole("button", { name: "Day complete" }).click();

    await expect(page.getByRole("heading", { name: "Morning review complete" })).toBeVisible();
    await expect(page.getByText("8 / 8", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "14 days" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByText("14-day history coverage")).toBeVisible();
    await expect(page.getByText("86.6%", { exact: true })).toBeVisible();
    await expect(page.getByTestId("expanded-cycle-history")).toContainText("N-225");
    await expect(page.getByTestId("expanded-cycle-history")).toContainText("AI proposal");
    await expect(page.getByTestId("expanded-cycle-history")).toContainText("Saved decision");

    await page.getByRole("button", { name: /N-227 is uncertain/ }).click();
    const uncertainHistory = page.locator("#history-N-227").getByTestId("expanded-cycle-history");
    await expect(uncertainHistory).toContainText("N-227");
    await expect(uncertainHistory).toContainText(
      "Uncertain / transition"
    );

    await page.getByRole("button", { name: "28 days" }).click();
    await expect(page.getByRole("button", { name: "28 days" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByText("28-day history coverage")).toBeVisible();
    await expect(page.getByText("85.3%", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Replay cycle" }).click();
    await expect(page.getByRole("button", { name: /Replaying/ })).toBeVisible();
  });

  test("carries real review decisions into the completed-day history", async ({ page }) => {
    await page.goto("/supervisor-demo");

    // The queue begins on N-223, then advances to the earliest remaining item.
    await page.getByRole("button", { name: "Accept Metestrus" }).click();
    await page.getByRole("button", { name: "Accept Estrus" }).click();
    await page.getByRole("button", { name: "Accept Proestrus" }).click();
    await page.getByRole("button", { name: "Accept Diestrus" }).click();

    await expect(page.getByRole("heading", { name: "AI predicts Estrus" })).toBeVisible();
    await page.getByRole("button", { name: "Correct prediction" }).click();
    await page.getByRole("button", { name: "Proestrus", exact: true }).click();

    await page.getByRole("button", { name: "Accept Metestrus" }).click();
    await page.getByRole("button", { name: "Correct prediction" }).click();
    await page.getByRole("button", { name: "Uncertain / transition" }).click();
    await page.getByRole("button", { name: "Accept Diestrus" }).click();

    await expect(page.getByRole("heading", { name: "Morning review complete" })).toBeVisible();
    await expect(page.getByText("8 / 8", { exact: true })).toBeVisible();
    await expect(page.getByText("1", { exact: true }).nth(0)).toBeVisible();

    await page.getByRole("button", { name: "Open saved records" }).click();
    await expect(page.getByTestId("receipt-row-demo-225")).toContainText("Proestrus");
    await expect(page.getByTestId("receipt-row-demo-227")).toContainText(
      "Uncertain / transition"
    );
  });

  test("keeps complete-review provenance available in the receipt export", async ({ page }) => {
    await page.goto("/supervisor-demo");
    await page.getByRole("button", { name: "Day complete" }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export review receipt" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(
      "north-colony-review-receipt-2026-07-28.csv"
    );

    await page.getByRole("button", { name: "Open saved records" }).click();
    await expect(page.getByRole("heading", { name: "Review complete" })).toBeVisible();
    const correctedRow = page.getByTestId("receipt-row-demo-225");
    await expect(correctedRow).toContainText("Estrus");
    await expect(correctedRow).toContainText("Proestrus");
  });

  test("keeps the completed-day dashboard accessible and contained on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/supervisor-demo");
    await page.getByRole("button", { name: "Day complete" }).click();

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client);
    await expect(page.getByText("Swipe the timeline for earlier and later days")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Scrollable cycle histories" })
    ).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("captures the selected day-complete visual target", async ({ page }) => {
    await page.setViewportSize({ width: 1488, height: 1058 });
    await page.goto("/supervisor-demo");
    await page.getByRole("button", { name: "Day complete" }).click();
    await expect(page.getByTestId("expanded-cycle-history")).toBeVisible();
    await expect(page).toHaveScreenshot("supervisor-day-complete.png", {
      animations: "disabled",
      fullPage: true,
    });
  });
});
