# Estrus

An AI-first estrous-cycle review workspace for research teams. The model proposes
a stage and shows relative support across all four stages; the scientist reviews
the image and context, then saves the scientific decision.

## Demo

The public rehearsal is available at
[estrus-dusky.vercel.app/demo](https://estrus-dusky.vercel.app/demo).
It is a complete, self-contained product journey:

- **Prediction inbox** — triage eight observations by model support and urgency.
- **Focused review** — inspect the image, cycle history, and four-stage model support.
- **Review receipt** — distinguish accepted, corrected, and uncertain decisions and
  export a provenance-rich CSV.
- **Day complete** — explore animated 7-, 14-, and 28-day subject histories,
  coverage, stage distribution, corrections, uncertainty, and projected Estrus
  windows.
- **Analyze a photo** — the one view that is *not* illustrative. It sends an
  uploaded photograph to the deployed SAM3 and BioCLIP endpoints and classifies it
  against the reference library in real time, showing the segmented animal, all
  four support scores, and the nearest reference photographs that produced them.

Everything except **Analyze a photo** is illustrative: those subjects, images,
histories, scores, and decisions are fixed demo data, not live inference. Across every
view, relative support scores are not calibrated probabilities and never replace the
scientist's saved decision. The route is intentionally excluded from search indexing
and does not write production records.

### Scope and accuracy, stated plainly

This is a **proof of concept on white-coated mice**, reproducing the published
external-photo protocol. Within that scope the guarded binary model — proestrus-or-estrus
against metestrus-or-diestrus, or abstain — scores **66/76 on the sealed public test
against the paper's own 63/76**, at ROC-AUC 0.914, and 89.2% selective accuracy once its
acquisition and reference-domain guards are applied.

Two boundaries on that claim:

- **Binary, not four-stage.** No exact four-stage model has been validated. Extending
  DINOv2 to four stages on local data reaches 28.2% balanced accuracy against a 25%
  chance rate, statistically tied with BioCLIP's 27.7%, so the four-stage view is
  labelled unvalidated in the interface.
- **White coats, not yet all coats.** On this lab's dark-coated photographs the same
  features reach 55.2% binary and 28.2% four-stage. That gap is data — coat colour,
  label provenance, subject count — not architecture, which is why expansion means
  collecting cytology-grounded labels across more coat colours rather than swapping
  backbones. Full numbers in
  [docs/model-evaluation-plan.md](docs/model-evaluation-plan.md).

Every figure holds each mouse out of its own training set. An image-level split leaks and
inflates the same data to 53.3%.

## Live analysis setup

`Analyze a photo` calls two GPU endpoints on Modal and needs no database:

```bash
BIOCLIP_API_URL=https://…-embed-endpoint.modal.run
SAM3_API_URL=https://…-segment-endpoint.modal.run
```

Both fall back to the deployed defaults when unset. Classification uses
`src/lib/reference-bank.json`, a bundled, int8-quantised bank of 233 labelled BioCLIP
embeddings, so the route keeps working when Supabase is unreachable. When the database
*is* reachable it prefers the live `reference_images` table instead. Rebuild the bank
with:

```bash
python3 scripts/build_reference_bank.py --dataset dataset_split_cropped/train --dataset dataset_split/train --dataset dataset_split/test
```

## Getting Started

Install dependencies and run the development server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000/demo](http://localhost:3000/demo).

## Validation

```bash
pnpm workflow:test
pnpm build
```

The workflow suite exercises the full eight-observation journey, data-export
semantics, accessibility, responsive layouts, and public-demo isolation from
authentication.

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS, Clerk, Supabase, and Playwright.
