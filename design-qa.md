# Prediction Inbox design QA

## Comparison target

- Source visual truth: `/Users/della/.codex/generated_images/019f783b-ec9b-77e3-81c7-bc9bbc53fc28/call_GyiQAY5IQQssR8IL0fTUOdIS.png`
- Implementation route: `http://localhost:3100/supervisor-demo`
- Implementation screenshot: `tmp/design-qa/prediction-inbox-implementation.png`
- Mobile screenshot: `tmp/design-qa/prediction-inbox-mobile.png`
- Side-by-side comparison: `tmp/design-qa/prediction-inbox-side-by-side.png`
- State: fresh eight-image prediction inbox, N-223 selected, no decisions saved

## Viewport and normalization

- Source pixels: 1487 x 1058.
- Desktop implementation capture: 1487 x 923 pixels.
- Source comparison crop: top 1487 x 923 pixels, preserving scale and alignment.
- Browser CSS width: 1487 px. Browser device scale factor: 1.5.
- Browser viewport override: 2231 x 1790 device pixels; the in-app browser exposed a 1487 px CSS page width and a 923 px screenshot content area.
- Mobile validation: 390 px CSS width with no horizontal overflow.

## Full-view comparison evidence

The source and implementation are placed together in
`tmp/design-qa/prediction-inbox-side-by-side.png`. Both use the selected warm
ivory, deep-indigo editorial system; a compact grouped prediction rail; an
exact-stage AI headline; four-stage support bars; a separate guardrail; and a
secondary supporting photograph. The implementation intentionally adds a
minimal demo navigation header and replaces the source's unsupported
"calibrated confidence" claim with the scientifically accurate "model support"
label.

The selected prediction region, score bars, guardrail, photograph treatment,
and primary accept/correct controls are all readable in the full comparison.
A separate focused crop was not needed because the equal-width side-by-side
evidence preserves these details at legible size. Mobile received a separate
focused capture because its ordering changes materially.

## Required fidelity surfaces

- Fonts and typography: serif display hierarchy, restrained sans-serif UI
  labels, uppercase tracking, weights, wrapping, and line heights match the
  chosen direction. Mobile title wrapping remains deliberate and readable.
- Spacing and layout rhythm: thin dividers, square-edged data surfaces, compact
  queue rows, three-region desktop hierarchy, and generous evidence spacing
  match the source. The mobile layout has no horizontal overflow.
- Colors and tokens: warm ivory background, deep indigo type/actions, lavender
  selection, muted stage colors, green guardrail, and warm warning states are
  consistent across the demo and integrated product screens.
- Image quality: real public reference photographs are used. The prepared crop
  is contained rather than stretched or hidden behind an object-cover crop.
- Copy and content: exact-stage AI prediction is primary. All four scores are
  labeled relative model support, not calibrated probabilities. The independent
  early/late model is described as a guardrail. Accept, correct, abstain, and
  receipt language is internally consistent.
- Icons and affordances: Lucide icons use one stroke family and remain
  secondary to labels. Accept and correction are explicit semantic buttons.
- Accessibility and behavior: semantic buttons/headings/landmarks are present;
  selected rows and progress are not conveyed by color alone; 390 px layout has
  no horizontal overflow; console error log is empty.

## Comparison history

### Iteration 1

- P2: the initial desktop build duplicated the summary in a full-width band and
  pushed accept/correct below the visible comparison area.
- Fix: condensed the 8/5/2/1 summary into the title header, reduced the demo
  wrapper, moved subject context under the photograph, and kept actions attached
  to the prediction panel.
- Post-fix evidence: `tmp/design-qa/prediction-inbox-implementation.png`.

### Iteration 2

- P2: at 390 px, the entire queue appeared before the selected prediction,
  recreating a list-first rather than AI-decision-first hierarchy.
- Fix: reordered the responsive layout so the selected prediction appears
  before the queue below the XL breakpoint; applied the same fix to the real
  dashboard.
- Post-fix evidence: `tmp/design-qa/prediction-inbox-mobile.png`.

### Iteration 3

- P2: stage scores appeared in cycle order rather than placing the proposed
  stage first, weakening the selected design's primary prediction hierarchy.
- Fix: stage distributions now show the proposed stage first and sort remaining
  stages by support. The guardrail moved below the distribution, matching the
  source's evidence sequence.
- Post-fix evidence: `tmp/design-qa/prediction-inbox-implementation.png` and
  `tmp/design-qa/prediction-inbox-side-by-side.png`.

## Primary interactions tested

- Accepting N-223 advances the queue and selects the next unresolved prediction.
- Correcting a prediction exposes all four stages plus
  `Uncertain / transition`.
- A corrected decision increments the receipt's corrected count.
- The receipt preserves AI proposal and saved decision side by side.
- Reload restores the clean supervisor-demo state.

## Console check

- In-app browser console errors: none.

## Remaining findings

No actionable P0, P1, or P2 findings remain.

P3: the supervisor-demo navigation header is an intentional product wrapper not
shown in the source concept. It slightly reduces vertical canvas area but keeps
the demo's Prediction Inbox, receipt, and method views discoverable.

final result: passed
