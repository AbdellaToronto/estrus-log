# Cycle phase on a ring

The four stage names are bins on a continuous loop. Estradiol rises through
Proestrus, ovulation sits at Estrus, and progesterone carries Metestrus into
Diestrus before the loop closes. Scoring that loop as four unrelated classes
throws away two things every daily record already contains: the stages arrive
in a fixed order, and the whole loop takes about four to five days.

`src/lib/cycle-phase.ts` keeps both. It is a hidden Markov model whose hidden
state is the phase, a position on the ring discretised into 72 bins. Each
calendar day the phase advances by one period's worth of a turn with some
drift, and each observation on a day is scored as evidence for the phase on
that day. Forward-backward then gives a posterior over phase for every day,
including days with no photo and days not yet reached.

The ring in `src/components/prediction/cycle-ring.tsx` draws that posterior.
Petal depth is probability mass, the needle points at the circular mean, and
only the solid part of the needle is real: its length is the resultant length,
one for a point mass and zero for a flat ring. A short needle is the honest
answer, and "Estrus, leaning Metestrus" is a value the categorical record could
never hold.

## What counts as evidence

| Record | Likelihood on the ring |
| --- | --- |
| Scientist-saved stage | Concentrated on that stage's arc, with `labelNoise` (15%) left for the neighbours, because a visual label near a boundary is often one stage off. Softened edges so a boundary phase is partly both stages. |
| Binary model probability of the early group | A half-ring vote. Tempered towards a coin flip by `referenceBackedTrust` (0.6) when the photo was in the model's reference range and by `offReferenceTrust` (0.25) when it was not. Every dark-coated local image so far is off-reference. |
| Uncertain / transition record | Flat. The day is marked observed but adds nothing. |
| No photo | Flat. The prior carries the phase across the gap. |

Several observations on one day multiply. The saved stage and the binary
probability are treated as independent looks, which is generous; the
tempering keeps that from mattering much.

## Tunables

`DEFAULT_CYCLE_PRIOR` holds the stage durations (Proestrus 1, Estrus 1,
Metestrus 0.75, Diestrus 2 days, a 4.75-day period), the day-to-day drift
(0.06 turns), the label noise, the two trust levels, and the bin count. A lab
with its own cytology timing should replace the durations with what it
measured; the ring divides pro rata.

`fitCyclePeriod` picks the period between 3.5 and 6.5 days that maximises the
marginal likelihood of a subject's record. It refuses to fit below six observed
days and returns the default period instead, since a period fitted to three
points is noise wearing a number.

## What it does not do

It cannot manufacture signal. A single dark-coat photograph still tells the
image model almost nothing about four stages, and a ring drawn from that alone
is a fringe all the way round. The value comes from the sequence: neighbours in
time outvote a one-stage label error, gaps get filled by order and period, and
the forecast says when Estrus is due.

That value depends on sampling. A record photographed on days 9, 11, 16 and 18
is aliased against a five-day period: a five-day gap looks like no gap on a
ring. Every mouse, every day, at the same time of day, for at least two full
cycles is the protocol that makes the phase estimate sharp and the period fit
trustworthy.

## Scoring it

The model is deterministic and dependency-free, so it can be held out the same
way the image models are: hide a subject's later days, run the forecast, and
score circular error against the stage that was actually saved. The test file
`src/lib/cycle-phase.test.ts` does this on simulated cycles with label errors,
gaps and aliasing; run it with `pnpm test`. The same harness will take a real
export once daily sequences exist.
