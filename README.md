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

All subjects, images, histories, scores, and decisions in the public rehearsal are
illustrative. Relative support scores are not calibrated probabilities, the model
output is not live inference, and it never replaces the scientist's saved decision.
The route is intentionally excluded from search indexing and does not write
production records.

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
