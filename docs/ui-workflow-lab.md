# Estrus UI workflow lab

## Why this exists

Component galleries are useful, but Estrus's highest-risk questions live between screens: which lab owns a record, whether an image is external photography or cytology, whether the model abstained, what the scientist confirmed, and whether an evaluation actually holds out whole mice. The workflow lab turns those journeys into an inspectable test contract.

The chosen approach combines three established patterns:

- [Storybook interaction tests](https://storybook.js.org/docs/9/writing-tests/interaction-testing) model deterministic UI states and named interaction steps. That is useful for dialogs and controls, but a component-only hierarchy does not show the topology of a scientist journey.
- [Playwright Trace Viewer](https://playwright.dev/docs/next/trace-viewer-intro) provides step-by-step DOM snapshots, screenshots, logs, and before/after inspection for executable tests.
- [React Flow](https://reactflow.dev/learn/concepts/building-a-flow) provides custom nodes, labelled edges, pan/zoom, and a minimap for the journey canvas itself.

Estrus therefore uses a hybrid: a React Flow map backed by typed workflow data, Playwright contract/visual tests, and an accessible ordered-list view. It does not introduce Storybook yet; page-level journeys are the higher-leverage first target.

## Included journeys

1. Lab entry and first-run setup
2. Single scientist-reviewed observation
3. Batch capture and review session
4. Cytology-grounded model evaluation
5. Experiment organization and reporting
6. Lab discovery, membership, and secondary surfaces

Each state records what the scientist sees, the primary action, expected outcome, data writes, route or external boundary, test assertions, and one of four audit states:

- `Mapped · audit pending`: the state exists and is ready for evidence capture.
- `Priority audit state`: structurally important or visibly dense; inspect early.
- `External / manual boundary`: authentication, downloads, or evaluation tools outside the main page flow.
- `Known product gap`: current code proves the destination is incomplete.

These labels are not UX grades. A screenshot-backed audit should replace “audit pending” with evidence-based findings.

## Run it

The route is deliberately disabled unless the local flag is present:

```bash
pnpm workflow:dev
```

Open `http://127.0.0.1:3100/workflow-lab`.

With permission to run Playwright directly, install the browser once and run the
contract, visual, and automated accessibility checks:

```bash
pnpm exec playwright install chromium
pnpm workflow:test:update  # intentionally accept a new visual baseline
pnpm workflow:test         # compare against that baseline thereafter
```

Test artifacts and traces are written beneath `work/ui-workflow-test-results` and the HTML report beneath `work/ui-workflow-report`. The accepted visual baseline stays beside the test in `tests/workflows/__screenshots__`.

## Initial audit order

1. Batch crop, assignment, and stage review: highest throughput and easiest place to analyze the wrong field, associate the wrong mouse, or save an unreviewed result. The local implementation now pauses after automatic ROI proposals, supports contact-sheet confirmation and per-item zoom/pan intervention, then analyzes only confirmed prepared crops.
2. Single-observation evidence review: verify the new binary lead, abstention, exact-stage decision, and saved crop evidence stay distinct. The first redesign pass is implemented and executable.
3. Capture contract at mobile and 200% zoom: the new prepared-ROI editor must remain understandable and operable without obscuring modality and provenance.
4. Cohort workspace navigation: the local redesign now opens on a daily checklist, puts unfinished mice first, and moves records, trends, evaluation, history, and export into secondary layers.
5. Evaluation readiness: the current `Filename check` tab label does not describe the cytology-grounded evidence workflow.
6. Organization creation/joining: confirm users understand permission, ownership, and pending-access consequences.

## Resolved structural gap

`/library` still exists as an unfinished internal route, but it no longer appears in primary navigation. Scientists are not sent to a coming-soon dead end during daily work.

## Evidence limits

The map is code-grounded. Its automated suite is wired to check graph integrity,
route inventory, rendering, focused visual baselines for the single-observation,
batch, and model-evaluation journeys, and an axe scan of the ordered outline.
During this pass the route was inspected in Codex's in-app browser at 1600 by
1000, including the all-journey map and focused scientist flows. TypeScript,
ESLint, and the production build are separate validation gates.

The Playwright runner and Chromium browser are installed, the focused visual
baselines have been inspected and accepted, and the current 33-test suite passes.
This still does not prove that the authenticated,
database-backed routes work end to end. That requires a capture run through the
actual local app with deterministic lab data, accepted screenshots for every
important state, keyboard testing, responsive reflow, and verification of
save/error behavior.

## Local validation record

On 2026-07-19 the current implementation passed:

- `pnpm exec tsc --noEmit`
- scoped ESLint for the workflow route, contract, Playwright config, and tests
- `ESTRUS_WORKFLOW_LAB=true pnpm build`
- fresh in-app-browser render and console inspection; no application errors or
  React Flow warnings remained (the expected Clerk development-key warning did)
- `pnpm workflow:test`: 33/33 passing, including the scientist review, single-item
  ROI framing, bulk confirmation-first crop contract, cohort daily review, visible
  record identity, dashboard daily prioritization, provenance-first evaluation
  readiness, experiment entry hierarchy, binary-model hierarchy, hydration checks,
  study-level collection integrity, the missing-data cycle atlas, provenance-first
  experiment records and export scope, mouse-specific first-cohort setup,
  subject-before-capture handoff, and automated accessibility scans

Accepted inspection captures live in `work/ui-workflow-audit` and cover the
all-journey canvas, single-observation canvas, model-evaluation canvas, and the
batch-session outline. The cohort audit adds deterministic Today, Records, and
Trends captures beneath `work/ui-workflow-audit/cohort-daily-review` and accepted
visual baselines beside the cohort Playwright test.
The dashboard audit adds a deterministic daily-entry baseline beside
`tests/workflows/dashboard-daily-entry.spec.ts`.
The evaluation audit adds before/after captures beneath
`work/ui-workflow-audit/evaluation-readiness` and a deterministic grouped-preflight
baseline beside the cohort test.
The experiment audit adds before/after captures beneath
`work/ui-workflow-audit/experiment-entry` and a deterministic entry baseline
beside the experiment Playwright test.
The experiment-detail audit adds a current-state capture and redesigned summary
and atlas captures beneath `work/ui-workflow-audit/experiment-detail`, plus
accepted summary and atlas baselines beside the experiment-detail test.
The first-cohort audit adds before/after setup and subject-handoff captures beneath
`work/ui-workflow-audit/first-cohort`, plus accepted setup and handoff baselines.

The batch Trigger task was also split locally into ROI proposal and analysis
phases. `uploaded → proposing_roi → roi_review → roi_confirmed → analyzing`
keeps the original immutable, stores the prepared ROI separately, and rejects
analysis until every item is confirmed. These task changes were compiled but
were not deployed or exercised against remote Trigger or production storage.
