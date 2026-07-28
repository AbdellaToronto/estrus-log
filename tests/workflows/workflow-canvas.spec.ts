import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  WORKFLOW_CONNECTIONS,
  WORKFLOW_FLOWS,
  WORKFLOW_STEPS,
} from "../../src/lib/workflow-lab";

const implementedRoutePatterns = new Set([
  "/sign-in",
  "/onboarding",
  "/dashboard",
  "/cohorts/[id]",
  "/cohorts/[id]#subjects",
  "/cohorts/[id]#evaluation",
  "/subjects/[id]",
  "/cohorts/[id]/batch",
  "/scans/[sessionId]",
  "/experiments",
  "/experiments/[id]",
  "/discover",
  "/settings",
  "/library",
]);

test.describe("workflow contract", () => {
  test("has unique, contiguous journeys and valid edges", () => {
    expect(new Set(WORKFLOW_FLOWS.map((flow) => flow.id)).size).toBe(
      WORKFLOW_FLOWS.length
    );
    expect(new Set(WORKFLOW_STEPS.map((step) => step.id)).size).toBe(
      WORKFLOW_STEPS.length
    );

    for (const flow of WORKFLOW_FLOWS) {
      const steps = WORKFLOW_STEPS.filter((step) => step.flowId === flow.id).sort(
        (left, right) => left.order - right.order
      );
      expect(steps.length, `${flow.id} must contain steps`).toBeGreaterThan(0);
      expect(steps.map((step) => step.order)).toEqual(
        Array.from({ length: steps.length }, (_, index) => index + 1)
      );
      expect(
        WORKFLOW_CONNECTIONS.filter((edge) =>
          steps.some((step) => step.id === edge.source)
        )
      ).toHaveLength(steps.length - 1);
    }

    const ids = new Set(WORKFLOW_STEPS.map((step) => step.id));
    for (const edge of WORKFLOW_CONNECTIONS) {
      expect(ids.has(edge.source), `unknown edge source ${edge.source}`).toBe(true);
      expect(ids.has(edge.target), `unknown edge target ${edge.target}`).toBe(true);
    }
  });

  test("maps only implemented app routes or explicit external boundaries", () => {
    for (const step of WORKFLOW_STEPS) {
      if (!step.route) {
        expect(step.surface).toBe("CLI / evaluation");
        continue;
      }
      expect(
        implementedRoutePatterns.has(step.route),
        `${step.id} points at an untracked route ${step.route}`
      ).toBe(true);
    }
  });

  test("known gaps and attention states explain why", () => {
    const flagged = WORKFLOW_STEPS.filter((step) =>
      ["attention", "gap"].includes(step.auditState)
    );
    expect(flagged.length).toBeGreaterThan(0);
    for (const step of flagged) {
      expect(step.auditNote, `${step.id} needs an audit note`).toBeTruthy();
    }
  });
});

test.describe("workflow canvas", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/workflow-lab");
    await expect(
      page.getByRole("heading", { name: "Estrus workflow lab" })
    ).toBeVisible();
  });

  test("renders the complete journey map and selected-state inspector", async ({ page }) => {
    await expect(page.getByTestId("workflow-canvas")).toBeVisible();
    await expect(page.locator('[data-testid^="workflow-step-"]')).toHaveCount(
      WORKFLOW_STEPS.length
    );
    await expect(page.getByTestId("workflow-inspector")).toContainText(
      WORKFLOW_STEPS[0].title
    );
  });

  for (const journey of [
    {
      button: "Single observation",
      flowId: "daily-observation",
      screenshot: "single-observation-canvas.png",
    },
    {
      button: "Batch session",
      flowId: "batch-session",
      screenshot: "batch-session-canvas.png",
    },
    {
      button: "Model evaluation",
      flowId: "evaluation",
      screenshot: "model-evaluation-canvas.png",
    },
  ]) {
    test(`filters to a readable ${journey.button.toLowerCase()} journey`, async ({
      page,
    }) => {
      await page
        .getByRole("button", { name: journey.button, exact: true })
        .click();
      const expected = WORKFLOW_STEPS.filter(
        (step) => step.flowId === journey.flowId
      );
      await expect(page.locator('[data-testid^="workflow-step-"]')).toHaveCount(
        expected.length
      );
      await expect(
        page.getByTestId(`workflow-step-${expected[0].id}`)
      ).toBeInViewport();
      await expect(page.getByTestId("workflow-canvas")).toHaveScreenshot(
        journey.screenshot,
        { animations: "disabled" }
      );
    });
  }

  test("maps bulk ROI automation as a confirmation-first workflow", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Batch session", exact: true }).click();

    const propose = page.getByTestId("workflow-step-batch-propose-roi");
    const confirm = page.getByTestId("workflow-step-batch-confirm-roi");
    const analyze = page.getByTestId("workflow-step-batch-analyze");

    await expect(propose).toContainText("Propose every ROI");
    await expect(confirm).toContainText("Confirm the crop sheet");
    await expect(analyze).toContainText("Run the analysis queue");
    await expect(confirm).toBeInViewport();
  });

  test("offers a semantic outline and passes an automated accessibility scan", async ({ page }) => {
    await page.getByRole("button", { name: "Outline" }).click();
    await expect(page.getByTestId("workflow-outline")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Single scientist-reviewed observation" })
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .exclude(".react-flow__minimap")
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
