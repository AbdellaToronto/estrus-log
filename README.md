# Estrus

An AI-first estrous-cycle review workspace for research teams. The model proposes
a stage and shows relative support across all four stages; the scientist reviews
the image and context, then saves the scientific decision.

## Supervisor demo

The public rehearsal is available at
[estrus-dusky.vercel.app/supervisor-demo](https://estrus-dusky.vercel.app/supervisor-demo).
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

### Accuracy, stated plainly

The four-stage classifier is **not usable for staging today**. Held out by mouse across
222 local photographs it reaches 27.7% balanced accuracy against a 25% chance rate, and
recalls Estrus at 68% but the other three stages at 10–17%. `Analyze a photo` is a live
demonstration of the encode-and-match pipeline, not evidence that staging works. See
[docs/model-evaluation-plan.md](docs/model-evaluation-plan.md).

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

Open [http://localhost:3000/supervisor-demo](http://localhost:3000/supervisor-demo).

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
