# Estrus supervisor-demo journey design QA

## Source visual truth

- Brief reference: `/Users/della/.codex/generated_images/019f783b-ec9b-77e3-81c7-bc9bbc53fc28/call_y1jOv5tWsBBOXeVq54OXKm1C.png`
- Review reference: `/Users/della/.codex/generated_images/019f783b-ec9b-77e3-81c7-bc9bbc53fc28/call_E5fsAkHV8ND2sxGzA7snkyTv.png`
- Outcome reference: `/Users/della/.codex/generated_images/019f783b-ec9b-77e3-81c7-bc9bbc53fc28/call_NmYZN7MdwqFHaXRx20VMCGjX.png`
- Selected direction: combine the three references as sequential states, retain the pale-bone and indigo research-workstation language, and intentionally reduce the mouse image so subject data and the scientist decision dominate the review.

Each reference is 1487 × 1058 px. The references are concept targets rather than a single route screenshot, so the implementation preserves their hierarchy and interaction model while integrating the user's explicit data-first review change.

## Browser-rendered implementation

- Local route: `http://localhost:3100/supervisor-demo`
- Browser: in-app Browser
- CSS viewport: 853 × 480
- Captured pixels: 853 × 480
- Device pixel ratio reported by the Browser: 3; the Browser capture was normalized to CSS-pixel dimensions.
- Brief: `work/product-audit-2026-07-28/14-redesign-brief-compact.png`
- Review: `work/product-audit-2026-07-28/12-redesign-review.png`
- Outcome: `work/product-audit-2026-07-28/13-redesign-outcome.png`
- Side-by-side comparisons:
  - `work/product-audit-2026-07-28/qa-brief-comparison-v2.png`
  - `work/product-audit-2026-07-28/qa-review-comparison.png`
  - `work/product-audit-2026-07-28/qa-outcome-comparison.png`

## Full-view comparison

The three implementation states read as one continuous product journey rather than three unrelated feature pages:

1. Prepare gives the researcher a resumed daily brief, visible workload, queue, review estimate, and clear next action.
2. Review keeps recent history, last saved stage, cycle position, model limitations, exact-stage choices, and confirmation on the larger left side. The source photograph is supporting evidence on the smaller right side.
3. Outcome converts the completed decisions into a 21-day colony atlas and an explicit provenance/export receipt.

The implementation intentionally uses a three-step rail rather than a separate fourth confirmation page. Confirmation happens on every observation; adding a second confirmation screen would duplicate the scientist's decision and make the journey longer without adding scientific integrity.

## Required fidelity surfaces

- Fonts and typography: Geist remains the application UI face and the existing serif fallback remains the display face. Weight, line height, compact uppercase labels, and indigo hierarchy match the references. The compact brief keeps the queue visible in the first viewport instead of allowing the headline to become a marketing hero.
- Spacing and layout rhythm: thin neutral rules, compact panels, small radii, and dense workstation spacing are consistent across all three states. The 853 px review remains two-column: data first, evidence second.
- Colors and visual tokens: warm ivory, deep indigo, restrained lavender, warm warning, and semantic stage colors map closely to the references and the existing app tokens. Contrast remained readable in browser inspection.
- Image quality and asset fidelity: the repeated placeholder was replaced by eight distinct S-BIAD2395 PNGs. Images use `object-contain`, retain their 83 × 128 source ratio, and are never stretched or presented as higher-resolution cytology evidence.
- Copy and content: model language is consistently binary early/late or abstention, exact stage is always the scientist's saved decision, and illustrative subject history is separated from real public image provenance.

## Focused comparison and iteration history

- P1 — the original demo opened as a “start anywhere” feature menu with authenticated exits. Replaced it with one public, stateful Prepare → Review → Outcome route and removed all auth-only links from the core journey.
- P1 — the first implementation gave the brief too much headline space, pushing useful queue data below the first viewport. Reduced header/hero height, moved to a data-first two-column brief at medium widths, and recaptured the comparison. The prepared queue is now visible at 853 × 480.
- P1 — the first review implementation stacked the photograph below the data at 853 px, making the image large again. Moved the data/evidence split to the medium breakpoint and constrained evidence to the smaller right column. The recapture shows the requested left-heavy data balance.
- P1 — the first step rail allowed an incomplete session to jump to a false “complete” outcome. Reduced the rail to the three actual states and disabled Outcome until all eight observations are confirmed. Browser evidence confirmed `Outcome` is disabled at 2/8 and becomes current only at 8/8.
- P2 — the prior batch demo repeated one image eight times. Added eight distinct public reference images and subject-specific filenames.
- P2 — confirmation initially preserved the page's old scroll position. Every state transition now returns to the top of the next state.
- P2 — the chart initially emitted a zero-dimension hydration warning. Added an explicit initial dimension; a fresh browser tab no longer emitted the chart warning.
- P2 — hidden public demo navigation still initialized Clerk organization hooks. Moved those hooks behind route-aware child components; the signed-out organization warning no longer appears.
- P3 — the root Clerk provider still reports that this project uses Clerk development keys. This is an environment warning, not a demo interaction or rendering error. The public supervisor journey does not expose login or require a Clerk session.

## Interaction and integrity evidence

- The primary brief CTA entered review without navigation or authentication.
- The incomplete Outcome step was disabled.
- Exact stages were selected and confirmed for the six remaining observations.
- Confirmation auto-advanced through N-223 to N-228.
- The sixth confirmation transitioned to Outcome at 8/8 and reset scroll to the state top.
- Outcome rendered 252 atlas cells and six provenance rows.
- CSV export is implemented as a local browser download.
- At all three states: no horizontal page overflow, no buttons without accessible names, no images without `alt`, and no duplicate IDs were found.
- Confirm remains disabled until an exact scientist stage is selected.
- Browser diagnostics contained no application error. The only remaining warning is the existing Clerk development-key notice.
- `pnpm exec tsc --noEmit`: passed.
- Scoped ESLint for the changed application and layout files: passed.
- `pnpm build`: passed; `/supervisor-demo` is statically prerendered.
- The existing Playwright workflow suite was not invoked because the selected Product Design browser is the in-app Browser; the complete journey was exercised directly there instead.

## Final result

final result: passed
