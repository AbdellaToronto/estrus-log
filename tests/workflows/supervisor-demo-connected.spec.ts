import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { text } from "node:stream/consumers";

test.describe("supervisor demo connected workflow", () => {
  test("keeps the public supervisor journey independent from Clerk", async ({ page }) => {
    await page.goto("/supervisor-demo");
    await expect(page.getByRole("heading", { name: "Prediction inbox" })).toBeVisible();

    const clerkBrowserRequests = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => name.includes(".clerk.accounts.dev"))
    );
    expect(clerkBrowserRequests).toEqual([]);
  });

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
    const progress = page.getByRole("progressbar", { name: "Review progress" });
    await expect(progress).toHaveAttribute("aria-valuenow", "0");

    // The queue begins on N-223, then advances to the earliest remaining item.
    await page.getByRole("button", { name: "Accept Metestrus" }).click();
    await expect(progress).toHaveAttribute("aria-valuenow", "1");
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
    await expect(progress).toHaveAttribute("aria-valuenow", "8");
    await expect(page.getByRole("button", { name: "Day complete" })).toHaveAttribute(
      "aria-current",
      "page"
    );
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
    const csv = await text(await download.createReadStream());
    expect(csv).toContain('"proestrus_relative_support"');
    expect(csv).toContain('"estrus_relative_support"');
    expect(csv).toContain('"metestrus_relative_support"');
    expect(csv).toContain('"diestrus_relative_support"');
    expect(csv).toContain('"score_semantics"');
    expect(csv).toContain('"inference_mode"');
    expect(csv).toContain('"relative_support_not_calibrated_probability"');
    expect(csv).toContain('"illustrative_not_live_inference"');
    expect(csv).toContain(
      '"illustrative_demo","N-225","BALB/c","14 weeks","S-BIAD2395 · external photograph 155","Estrus","0.27","0.43","0.19","0.11","Proestrus","corrected"'
    );
    expect(csv).toContain(
      '"illustrative_demo","N-227","C57BL/6J","16 weeks","S-BIAD2395 · external photograph 174","Proestrus","0.39","0.31","0.18","0.12","Uncertain / transition","uncertain"'
    );
    const correctedFields = csv
      .split("\n")
      .find((row) => row.includes('"N-225"'))
      ?.slice(1, -1)
      .split('","');
    expect(correctedFields).toBeDefined();
    const supportTotal = correctedFields!
      .slice(6, 10)
      .reduce((total, value) => total + Number(value), 0);
    expect(supportTotal).toBeCloseTo(1, 8);

    await page.getByRole("button", { name: "Open saved records" }).click();
    await expect(page.getByRole("heading", { name: "Review complete" })).toBeVisible();
    await expect(page.getByTestId("receipt-stat-accepted")).toContainText("6");
    await expect(page.getByTestId("receipt-stat-corrected")).toContainText("1");
    await expect(page.getByTestId("receipt-stat-uncertain")).toContainText("1");
    const correctedRow = page.getByTestId("receipt-row-demo-225");
    await expect(correctedRow).toContainText("Estrus");
    await expect(correctedRow).toContainText("Proestrus");
  });

  test("keeps a partial receipt partial when it is exported", async ({ page }) => {
    await page.goto("/supervisor-demo");
    await page.getByRole("button", { name: "Accept Metestrus" }).click();
    await page.getByRole("button", { name: "Review receipt" }).click();

    await expect(page.getByRole("heading", { name: "Partial review saved" })).toBeVisible();
    await expect(
      page.getByRole("progressbar", { name: "Review progress" })
    ).toHaveAttribute("aria-valuenow", "1");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export receipt" }).click();
    const csv = await text(await (await downloadPromise).createReadStream());
    expect(csv).toContain(
      '"illustrative_demo","N-223","BALB/c","15 weeks","S-BIAD2395 · external photograph 106","Metestrus","0.05","0.1","0.68","0.17","Metestrus","accepted"'
    );
    expect(csv).toContain(
      '"illustrative_demo","N-221","BALB/c","14 weeks","S-BIAD2395 · external photograph 139","Estrus","0.06","0.82","0.08","0.04","","pending"'
    );
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

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByText("Swipe the timeline for earlier and later days")).toBeVisible();

    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.getByText("Swipe the timeline for earlier and later days")).toBeHidden();
  });

  test("keeps the prediction and receipt pages usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/supervisor-demo");

    const expectContained = async () => {
      const width = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(width.scroll).toBeLessThanOrEqual(width.client);
    };

    await expect(page.getByRole("heading", { name: "Prediction inbox" })).toBeVisible();
    await expectContained();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.getByRole("button", { name: "Review receipt" }).click();
    await expect(page.getByRole("heading", { name: "Review complete" })).toBeVisible();
    await expect(
      page.getByRole("progressbar", { name: "Review progress" })
    ).toHaveAttribute("aria-valuenow", "8");
    await expectContained();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.getByRole("button", { name: "How it works" }).click();
    await expect(
      page.getByRole("heading", { name: "AI proposes. Scientists supervise." })
    ).toBeVisible();
    await expectContained();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
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
