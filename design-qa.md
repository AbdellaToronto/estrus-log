# Day Complete design QA

## Comparison target

- Source visual truth:
  `/Users/della/.codex/generated_images/019f783b-ec9b-77e3-81c7-bc9bbc53fc28/call_OtV9aiTYQoHYOMvTuonQKfi1.png`
- Implementation route: `http://localhost:3100/supervisor-demo`
- Browser-rendered implementation:
  `work/design-qa/day-complete-iab.jpg`
- Stable workflow screenshot:
  `tests/workflows/__screenshots__/supervisor-day-complete.png`
- Full side-by-side evidence:
  `work/design-qa/day-complete-side-by-side.png`
- Focused cycle-history evidence:
  `work/design-qa/day-complete-cycle-focus.png`
- State: Day Complete, 14-day range, N-225 expanded, one correction, and
  one uncertain transition.

## Viewport and normalization

- Source pixels: 1487 x 1058.
- Stable implementation pixels: 1488 x 1610.
- Stable implementation CSS viewport: 1488 x 1058 at device scale factor 1.
- In-app browser implementation pixels: 1440 x 1610.
- In-app browser CSS viewport: 1440 x 1024 at device pixel ratio 2.
- Full-view comparison: both artifacts were normalized to 720 px width without
  cropping, then placed side by side.
- Focused comparison: each left-side cycle-history region was cropped from its
  native artifact, normalized to 720 px width, and placed side by side. The
  different vertical lengths remain visible rather than being distorted.

## Full-view comparison evidence

The combined evidence in
`work/design-qa/day-complete-side-by-side.png` shows the same selected editorial
system: warm ivory background, indigo serif hierarchy, thin dividers, dense
longitudinal rows, a persistent Today marker, and a top-aligned insight rail.
The implementation intentionally runs longer than the concept because the
expanded state includes the prepared observation and all four relative support
scores. This is a product-content addition requested after the concept, not an
unexplained layout drift.

The header, completion metrics, at-a-glance distribution, history controls,
selected subject, insight rail, actions, and provenance remain aligned to the
source composition. No region overlaps or clips at the target width.

## Focused region evidence

`work/design-qa/day-complete-cycle-focus.png` compares the most information-dense
region at readable scale. It confirms:

- all eight mice remain scannable as aligned rows;
- gaps are visible rather than interpolated;
- the selected N-225 trajectory separates the AI proposal from the
  scientist-saved point;
- the compact evidence thumbnail is subordinate to the chart;
- all four support scores are visible without displacing the longitudinal
  record;
- stage names remain readable on the expanded chart.
- the cyclic-order caveat prevents vertical distance from being read as a
  biological magnitude.

No additional focus crop was needed for the right rail because its labels,
counts, percentages, insight copy, and actions are legible in the full-view
comparison.

## Required fidelity surfaces

- Fonts and typography: the serif display hierarchy, sans-serif data labels,
  uppercase tracking, weights, line heights, and wrapping preserve the source.
  The implementation uses slightly smaller operational copy in the denser
  evidence region but keeps the primary headings optically equivalent.
- Spacing and layout rhythm: the two-column desktop grid, top-aligned summary
  rail, completion metrics, compact mouse rows, selected-row expansion, thin
  dividers, and square data surfaces match the concept. The expanded row is
  intentionally taller to carry four-stage support evidence.
- Colors and visual tokens: warm ivory, deep indigo, lavender selection, muted
  stage colors, green forecast, blue uncertainty, and neutral dividers are
  coherent with the source and meet the app's established design system.
- Image quality and asset fidelity: the real public reference photographs are
  retained. The selected photograph is a small subordinate crop, not a hero
  image, and no image is stretched or replaced by CSS art.
- Copy and content: AI proposal, all four relative support scores, saved
  scientist decision, uncertainty, correction, provenance, illustrative-history
  caveat, categorical-distance caveat, observation coverage, and non-calibrated
  score caveat are explicit and internally consistent.
- Icons and affordances: Lucide icons use one stroke family. Range controls,
  replay, insight shortcuts, saved records, and export are visibly interactive.
- Responsiveness: the 390 x 844 workflow check reports no document-level
  horizontal overflow. The dense history is deliberately contained in a
  horizontally scrollable, named evidence region on small screens, with a
  visible swipe instruction before the timeline at every breakpoint where
  horizontal scrolling is still required.
- Accessibility: the reduced-motion state passes Axe with no violations;
  chart SVGs are not nested focus targets; the two complementary landmarks have
  distinct names; semantic headings, labels, controls, image alt text, and a
  replay live region are present.

## Comparison history

### Iteration 1

- P2: the first implementation placed the at-a-glance distribution below the
  full-width completion hero, leaving the concept's upper-right information
  region empty and making the page feel looser than the selected design.
- Fix: moved the saved-stage distribution into the top two-column completion
  grid and aligned the insight rail with the cycle-history region.
- Post-fix evidence:
  `work/design-qa/day-complete-iab.jpg` and
  `work/design-qa/day-complete-side-by-side.png`.

### Iteration 2

- P2: the first expanded history showed only the winning model score and used a
  larger supporting image, weakening the app's four-stage AI-first model and
  the user's preference for data to dominate the photograph.
- Fix: reduced the photograph to a compact evidence thumbnail and added animated
  bars for Proestrus, Estrus, Metestrus, and Diestrus with exact relative
  support percentages.
- Post-fix evidence:
  `work/design-qa/day-complete-cycle-focus.png`.

### Iteration 3

- P2: the date labels remained fixed to seven days when the chart changed to
  14 or 28 days, and Replay did not remount the saved-stage distribution.
- Fix: added range-specific date labels and keyed both the trajectory and
  distribution animations to the replay state.
- Post-fix evidence: the 7/14/28 and replay workflow assertions pass in
  `tests/workflows/supervisor-demo-connected.spec.ts`.

### Iteration 4

- P1: decorative Recharts surfaces were focusable inside `aria-hidden` rows,
  two complementary landmarks were unnamed, and an automated contrast scan
  could observe the entry transition before it settled.
- Fix: disabled Recharts accessibility layers where a surrounding semantic
  description already exists, named both landmark regions, and validated Axe
  under the product's reduced-motion behavior.
- Post-fix evidence: the mobile accessibility workflow passes with zero Axe
  violations.

### Iteration 5

- P2: on the 390 px production capture, the timeline correctly stayed inside
  its own horizontal scroller, but the first viewport made the remaining dates
  look clipped rather than intentionally swipeable. A 768 px tablet audit
  showed the same issue before the history reaches its non-scrolling layout.
- Fix: added a concise compact-view swipe instruction and named the scrollable
  history region for assistive technology and keyboard access. The instruction
  remains visible through the tablet breakpoint and disappears once the
  timeline fits without scrolling.
- Post-fix evidence: the connected suite now includes the complete eight-mouse
  review path plus mobile prediction, receipt, history, and accessibility
  checks; all 44
  workflows pass.

### Iteration 6

- P1: extending the mobile audit from Day Complete to the Prediction Inbox
  exposed small neutral labels that measured between 3.62:1 and 4.29:1 against
  white, ivory, and lavender surfaces.
- Fix: darkened the secondary neutral text tokens without changing the
  hierarchy or selected-state palette.
- Post-fix evidence: Prediction Inbox and Review Receipt both pass Axe at
  390 x 844 with no violations.

### Iteration 7

- P1: the receipt summary originally counted an uncertain transition as a
  correction because both outcomes differ from the AI proposal. That disagreed
  with Day Complete, which correctly reported one correction and one uncertain
  record.
- Fix: split uncertain transitions into their own receipt metric. The completed
  demo now reports six accepted proposals, one corrected stage, and one
  uncertain transition across eight reviewed observations.
- Post-fix evidence: the receipt workflow asserts each outcome count and the
  exact corrected and uncertain rows.

## Primary interactions tested

- Day Complete is directly reachable from the demo navigation.
- Demo navigation exposes the current page semantically, and the animated
  review-progress bar reports 0 through 8 decisions to assistive technology
  while respecting reduced-motion preferences.
- The real queue can be completed from AI proposals through five accepted
  predictions, one corrected stage, and one uncertain transition; those exact
  scientist decisions then appear in Day Complete and the saved-record receipt.
- 7-, 14-, and 28-day ranges update the visible history window and date labels.
- History coverage updates with each range and preserves missing records.
- Hovering the expanded trajectory reveals the exact date and saved stage.
- Selecting N-225 or N-227 expands the matching historical record.
- Insight shortcuts select the corrected or uncertain subject.
- Replay remounts the cycle and stage-distribution animations while respecting
  reduced-motion preferences.
- Open saved records preserves AI proposal and scientist-saved decision side by
  side.
- Opening Review Receipt before any interaction presents the completed
  demonstration state, while opening it after one or more real demo decisions
  preserves and exports the actual partial review.
- Export review receipt downloads a CSV with the proposal, all four relative
  support scores, image reference, guardrail, scientist decision, review
  outcome, timestamp, and explicit illustrative-demo scope.
- Mobile at 390 x 844 has no page-level overflow, explains how to swipe the
  dense timeline, and passes Axe.

## Console check

- In-app browser console errors: none.
- The public rehearsal routes no longer initialize Clerk, so the supervisor
  demo has no development-key warning and makes no request to the Clerk browser
  client at `*.clerk.accounts.dev`. Authenticated application routes retain the
  normal Clerk provider.
- Earlier Recharts measurement warnings did not recur after adding initial
  responsive-container dimensions.

## Remaining findings

No actionable P0, P1, or P2 findings remain.

P3: the implementation is vertically longer than the concept because it shows
the prepared image and all four support scores in the selected history. This is
an intentional information-density tradeoff and is preferable for the AI-first
scientist workflow.

final result: passed
