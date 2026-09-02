/**
 * Cycle phase as a distribution on a ring, inferred from a subject's daily record.
 *
 * The four stage names are bins on a continuous loop: estradiol rises through
 * Proestrus, ovulation sits at Estrus, and progesterone carries Metestrus into
 * Diestrus before the loop closes. Treating that loop as four unrelated classes
 * throws away two things the record actually contains: the stages arrive in a
 * fixed order, and the whole loop takes about four to five days. Both are
 * strong priors, and neither needs a better image model.
 *
 * This module is a hidden Markov model whose hidden state is the phase, a
 * position on the ring, discretised into equal bins. Each calendar day the
 * phase advances by roughly one period's worth of a turn with some drift, and
 * each observation on a day is scored as evidence for the phase on that day:
 *
 *   - a scientist-saved stage concentrates the likelihood on that stage's arc,
 *     with a little mass left for the adjacent arcs because a visual label
 *     near a boundary is often one stage off;
 *   - the public binary model's probability of the early group (Proestrus or
 *     Estrus) is a half-ring likelihood, tempered by how far it can be trusted
 *     on this photograph;
 *   - an uncertain/transition record, or a day with no photo, contributes
 *     nothing and simply lets the prior carry the phase forward.
 *
 * Forward-backward then gives a posterior over phase for every day, including
 * days with no observation and days not yet reached. The posterior's circular
 * mean is the position on the ring; its resultant length is how committed the
 * estimate is. That pair is the gradient the categorical record never had.
 *
 * Everything here is deterministic and dependency-free so it can be scored
 * against a held-out sequence the same way the image models are.
 */

import type { ClassificationStage } from "./classification";
import { CYCLE_ORDER } from "./stage-palette";

export type PhaseObservation = {
  /** Calendar day of the observation, `YYYY-MM-DD`. */
  date: string;
  /** Stage the scientist saved, if the record carries one. */
  stage?: ClassificationStage | null;
  /** The record was saved as an uncertain or transition label. */
  uncertain?: boolean;
  /** Public binary model's probability of the Proestrus-or-Estrus group. */
  earlyGroupProbability?: number | null;
  /**
   * Whether the binary model backed that probability with an in-reference
   * match. Off-reference photographs (every dark-coated local image, so far)
   * get a much smaller say.
   */
  earlyGroupReferenceBacked?: boolean;
};

export type CyclePrior = {
  /** Expected time in each stage, in days. The ring is divided pro rata. */
  durations: Record<ClassificationStage, number>;
  /** Day-to-day irregularity of progress around the ring, in turns per day. */
  driftSd: number;
  /** Probability that a saved stage label is off by one stage. */
  labelNoise: number;
  /** Trust in a reference-backed binary probability, 0 to 1. */
  referenceBackedTrust: number;
  /** Trust in an off-reference binary probability, 0 to 1. */
  offReferenceTrust: number;
  /** Number of equal phase bins around the ring. */
  bins: number;
};

/**
 * Durations follow the textbook mouse cycle: about a day each in Proestrus and
 * Estrus, a short Metestrus, and the longest stretch in Diestrus, for a period
 * near four and three-quarter days. A lab with its own cytology timing should
 * replace these with what it measured.
 */
export const DEFAULT_CYCLE_PRIOR: CyclePrior = {
  durations: { Proestrus: 1, Estrus: 1, Metestrus: 0.75, Diestrus: 2 },
  driftSd: 0.06,
  labelNoise: 0.15,
  referenceBackedTrust: 0.6,
  offReferenceTrust: 0.25,
  bins: 72,
};

export type StageArc = {
  stage: ClassificationStage;
  /** Start of the arc in turns, 0 to 1, measured from the start of Proestrus. */
  start: number;
  /** End of the arc in turns. */
  end: number;
};

export type PhaseDay = {
  date: string;
  /** Days since the first day of the series. */
  dayIndex: number;
  /** At least one observation was recorded on this day. */
  observed: boolean;
  /** This day lies after the last observation; the posterior is a forecast. */
  forecast: boolean;
  /** Posterior probability per phase bin. Sums to 1. */
  posterior: number[];
  /** Circular mean of the posterior, in turns, 0 to 1. */
  meanPhase: number;
  /** Resultant length of the posterior, 0 (spread over the ring) to 1 (a point). */
  concentration: number;
  /** Posterior mass falling on each stage's arc. */
  stageMass: Record<ClassificationStage, number>;
  /** Stage with the most posterior mass. */
  likelyStage: ClassificationStage;
};

export type CyclePhaseResult = {
  days: PhaseDay[];
  /** Period the series was scored with, in days. */
  period: number;
  /** Log marginal likelihood of the observations under the prior and period. */
  logLikelihood: number;
  /** Number of calendar days carrying at least one observation. */
  observedDays: number;
  arcs: StageArc[];
  bins: number;
};

export type InferCyclePhaseOptions = {
  prior?: Partial<CyclePrior>;
  /** Override the period instead of deriving it from the stage durations. */
  period?: number;
  /** How many days past the last observation to project. */
  forecastDays?: number;
};

const TAU = Math.PI * 2;

export function resolvePrior(overrides?: Partial<CyclePrior>): CyclePrior {
  return { ...DEFAULT_CYCLE_PRIOR, ...overrides };
}

export function cyclePeriod(prior: CyclePrior): number {
  return CYCLE_ORDER.reduce((total, stage) => total + prior.durations[stage], 0);
}

export function stageArcs(prior: CyclePrior = DEFAULT_CYCLE_PRIOR): StageArc[] {
  const period = cyclePeriod(prior);
  let cursor = 0;
  return CYCLE_ORDER.map((stage) => {
    const start = cursor;
    cursor += prior.durations[stage] / period;
    return { stage, start, end: cursor };
  });
}

/** Which stage's arc a phase in turns falls on. */
export function stageAtPhase(
  phase: number,
  prior: CyclePrior = DEFAULT_CYCLE_PRIOR
): ClassificationStage {
  const wrapped = ((phase % 1) + 1) % 1;
  const arcs = stageArcs(prior);
  return (arcs.find((arc) => wrapped >= arc.start && wrapped < arc.end) ?? arcs[arcs.length - 1]).stage;
}

/** Phase at the middle of a stage's arc, in turns. */
export function stageMidpoint(
  stage: ClassificationStage,
  prior: CyclePrior = DEFAULT_CYCLE_PRIOR
): number {
  const arc = stageArcs(prior).find((candidate) => candidate.stage === stage)!;
  return (arc.start + arc.end) / 2;
}

function uniform(bins: number): number[] {
  return new Array<number>(bins).fill(1 / bins);
}

function normalize(values: number[]): { values: number[]; total: number } {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return { values: uniform(values.length), total: 0 };
  return { values: values.map((value) => value / total), total };
}

/**
 * Arc membership softened at both edges, so a phase sitting on a boundary is
 * partly both stages instead of flipping between them. Width is in bins.
 */
function softArc(arc: StageArc, bins: number, edge = 1.5): number[] {
  const values = new Array<number>(bins).fill(0);
  for (let bin = 0; bin < bins; bin += 1) {
    const centre = (bin + 0.5) / bins;
    // Signed distance in bins from the phase to the nearest arc edge, positive inside.
    const toStart = circularDistance(centre, arc.start) * bins;
    const toEnd = circularDistance(centre, arc.end) * bins;
    const inside = isInsideArc(centre, arc);
    const nearest = Math.min(toStart, toEnd);
    const signed = inside ? nearest : -nearest;
    values[bin] = logistic(signed / (edge / 2));
  }
  return values;
}

function isInsideArc(phase: number, arc: StageArc): boolean {
  return phase >= arc.start && phase < arc.end;
}

function circularDistance(a: number, b: number): number {
  const raw = Math.abs(a - b) % 1;
  return Math.min(raw, 1 - raw);
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * One day's transition kernel: a wrapped Gaussian centred on the expected
 * advance. Indexed by how many bins the phase moved.
 */
export function transitionKernel(
  period: number,
  driftSd: number,
  bins: number
): number[] {
  const shift = bins / period;
  const sigma = Math.max(driftSd * bins, 1e-3);
  const kernel = new Array<number>(bins).fill(0);
  for (let offset = 0; offset < bins; offset += 1) {
    let mass = 0;
    // Sum the Gaussian over enough wraps that the tails are accounted for.
    for (let wrap = -3; wrap <= 3; wrap += 1) {
      const distance = offset + wrap * bins - shift;
      mass += Math.exp(-(distance * distance) / (2 * sigma * sigma));
    }
    kernel[offset] = mass;
  }
  return normalize(kernel).values;
}

function stepForward(distribution: number[], kernel: number[]): number[] {
  const bins = distribution.length;
  const next = new Array<number>(bins).fill(0);
  for (let from = 0; from < bins; from += 1) {
    const mass = distribution[from];
    if (mass === 0) continue;
    for (let offset = 0; offset < bins; offset += 1) {
      next[(from + offset) % bins] += mass * kernel[offset];
    }
  }
  return next;
}

function stepBackward(message: number[], kernel: number[]): number[] {
  const bins = message.length;
  const previous = new Array<number>(bins).fill(0);
  for (let from = 0; from < bins; from += 1) {
    let sum = 0;
    for (let offset = 0; offset < bins; offset += 1) {
      sum += kernel[offset] * message[(from + offset) % bins];
    }
    previous[from] = sum;
  }
  return previous;
}

/**
 * Likelihood of one observation across the ring. A day with several
 * observations multiplies its likelihoods, treating them as independent looks.
 */
export function observationLikelihood(
  observation: PhaseObservation,
  prior: CyclePrior = DEFAULT_CYCLE_PRIOR
): number[] {
  const { bins } = prior;
  const arcs = stageArcs(prior);
  let likelihood = new Array<number>(bins).fill(1);

  if (observation.stage && !observation.uncertain) {
    const index = arcs.findIndex((arc) => arc.stage === observation.stage);
    if (index >= 0) {
      const own = softArc(arcs[index], bins);
      const before = softArc(arcs[(index + arcs.length - 1) % arcs.length], bins);
      const after = softArc(arcs[(index + 1) % arcs.length], bins);
      const noise = prior.labelNoise;
      likelihood = likelihood.map(
        (value, bin) =>
          value *
          (noise / 2 +
            (noise / 2) * Math.max(before[bin], after[bin]) +
            (1 - noise) * own[bin])
      );
    }
  }

  const probability = observation.earlyGroupProbability;
  if (typeof probability === "number" && Number.isFinite(probability)) {
    const trust = observation.earlyGroupReferenceBacked
      ? prior.referenceBackedTrust
      : prior.offReferenceTrust;
    const clamped = Math.min(1, Math.max(0, probability));
    // Shrink towards a coin flip in proportion to how little the model can be
    // trusted on this photograph. Trust 0 makes the evidence vanish.
    const tempered = 0.5 + trust * (clamped - 0.5);
    const early = arcs
      .filter((arc) => arc.stage === "Proestrus" || arc.stage === "Estrus")
      .map((arc) => softArc(arc, bins));
    likelihood = likelihood.map((value, bin) => {
      const inEarly = Math.max(...early.map((arc) => arc[bin]));
      return value * (inEarly * tempered + (1 - inEarly) * (1 - tempered));
    });
  }

  return likelihood;
}

export function circularMean(distribution: number[]): {
  phase: number;
  concentration: number;
} {
  const bins = distribution.length;
  let x = 0;
  let y = 0;
  for (let bin = 0; bin < bins; bin += 1) {
    const angle = ((bin + 0.5) / bins) * TAU;
    x += distribution[bin] * Math.cos(angle);
    y += distribution[bin] * Math.sin(angle);
  }
  const phase = ((Math.atan2(y, x) / TAU) % 1 + 1) % 1;
  return { phase, concentration: Math.min(1, Math.hypot(x, y)) };
}

export function stageMass(
  distribution: number[],
  prior: CyclePrior = DEFAULT_CYCLE_PRIOR
): Record<ClassificationStage, number> {
  const bins = distribution.length;
  const mass = { Proestrus: 0, Estrus: 0, Metestrus: 0, Diestrus: 0 };
  for (let bin = 0; bin < bins; bin += 1) {
    mass[stageAtPhase((bin + 0.5) / bins, prior)] += distribution[bin];
  }
  return mass;
}

export function likelyStage(mass: Record<ClassificationStage, number>): ClassificationStage {
  return CYCLE_ORDER.reduce((best, stage) => (mass[stage] > mass[best] ? stage : best));
}

const DAY_MS = 86_400_000;

export function parseDay(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function formatDay(dayNumber: number): string {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

function groupByDay(observations: PhaseObservation[]): Map<number, PhaseObservation[]> {
  const groups = new Map<number, PhaseObservation[]>();
  for (const observation of observations) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(observation.date)) continue;
    const day = parseDay(observation.date);
    if (!Number.isFinite(day)) continue;
    groups.set(day, [...(groups.get(day) ?? []), observation]);
  }
  return groups;
}

/**
 * Run forward-backward over every calendar day from the first observation to
 * the last, plus any forecast days. Days without observations carry a flat
 * likelihood, so the prior alone moves the phase across them.
 */
export function inferCyclePhase(
  observations: PhaseObservation[],
  options: InferCyclePhaseOptions = {}
): CyclePhaseResult {
  const prior = resolvePrior(options.prior);
  const period = options.period ?? cyclePeriod(prior);
  const forecastDays = Math.max(0, Math.floor(options.forecastDays ?? 0));
  const { bins } = prior;
  const arcs = stageArcs(prior);
  const groups = groupByDay(observations);

  if (groups.size === 0) {
    return { days: [], period, logLikelihood: 0, observedDays: 0, arcs, bins };
  }

  const dayNumbers = [...groups.keys()];
  const firstDay = Math.min(...dayNumbers);
  const lastObserved = Math.max(...dayNumbers);
  const lastDay = lastObserved + forecastDays;
  const length = lastDay - firstDay + 1;

  const likelihoods: number[][] = [];
  for (let index = 0; index < length; index += 1) {
    const dayObservations = groups.get(firstDay + index) ?? [];
    let likelihood = new Array<number>(bins).fill(1);
    for (const observation of dayObservations) {
      const single = observationLikelihood(observation, prior);
      likelihood = likelihood.map((value, bin) => value * single[bin]);
    }
    likelihoods.push(likelihood);
  }

  const kernel = transitionKernel(period, prior.driftSd, bins);

  // Forward pass with per-day normalisation; the normalisers are the marginal
  // likelihood, which is what period fitting maximises.
  const forward: number[][] = [];
  let logLikelihood = 0;
  let carried = uniform(bins);
  for (let index = 0; index < length; index += 1) {
    if (index > 0) carried = stepForward(carried, kernel);
    const scored = normalize(carried.map((value, bin) => value * likelihoods[index][bin]));
    logLikelihood += Math.log(scored.total > 0 ? scored.total : 1e-300);
    forward.push(scored.values);
    carried = scored.values;
  }

  const backward: number[][] = new Array(length);
  let message = new Array<number>(bins).fill(1);
  backward[length - 1] = message;
  for (let index = length - 2; index >= 0; index -= 1) {
    const weighted = message.map((value, bin) => value * likelihoods[index + 1][bin]);
    message = normalize(stepBackward(weighted, kernel)).values;
    backward[index] = message;
  }

  const days: PhaseDay[] = [];
  for (let index = 0; index < length; index += 1) {
    const posterior = normalize(forward[index].map((value, bin) => value * backward[index][bin])).values;
    const mean = circularMean(posterior);
    const mass = stageMass(posterior, prior);
    const dayNumber = firstDay + index;
    days.push({
      date: formatDay(dayNumber),
      dayIndex: index,
      observed: groups.has(dayNumber),
      forecast: dayNumber > lastObserved,
      posterior,
      meanPhase: mean.phase,
      concentration: mean.concentration,
      stageMass: mass,
      likelyStage: likelyStage(mass),
    });
  }

  return { days, period, logLikelihood, observedDays: groups.size, arcs, bins };
}

export type PeriodFit = {
  period: number;
  logLikelihood: number;
  /** Every period tried, with its score, for plotting or auditing. */
  candidates: { period: number; logLikelihood: number }[];
  /** False when there were too few observed days to trust a fit. */
  fitted: boolean;
};

/**
 * Choose the cycle length that best explains a subject's record. The marginal
 * likelihood from the forward pass is the score, so this is a one-parameter
 * maximum-likelihood fit with no gradient to tune. Below `minObservedDays`
 * the default period is returned unchanged; a period fitted to three points
 * is noise wearing a number.
 */
export function fitCyclePeriod(
  observations: PhaseObservation[],
  options: {
    prior?: Partial<CyclePrior>;
    candidates?: number[];
    minObservedDays?: number;
  } = {}
): PeriodFit {
  const prior = resolvePrior(options.prior);
  const fallback = cyclePeriod(prior);
  const minObservedDays = options.minObservedDays ?? 6;
  const candidates =
    options.candidates ??
    Array.from({ length: 13 }, (_, index) => 3.5 + index * 0.25);

  const observedDays = groupByDay(observations).size;
  if (observedDays < minObservedDays) {
    return { period: fallback, logLikelihood: Number.NaN, candidates: [], fitted: false };
  }

  const scored = candidates.map((period) => ({
    period,
    logLikelihood: inferCyclePhase(observations, { prior, period }).logLikelihood,
  }));
  const best = scored.reduce((winner, candidate) =>
    candidate.logLikelihood > winner.logLikelihood ? candidate : winner
  );
  return { ...best, candidates: scored, fitted: true };
}

/**
 * First forecast day on which a stage holds at least `threshold` of the
 * posterior, counted from the last observed day. Undefined when the forecast
 * never commits that far.
 */
export function daysUntilStage(
  result: CyclePhaseResult,
  stage: ClassificationStage,
  threshold = 0.5
): number | undefined {
  const lastObserved = [...result.days].reverse().find((day) => day.observed);
  if (!lastObserved) return undefined;
  if (lastObserved.stageMass[stage] >= threshold) return 0;
  for (const day of result.days) {
    if (day.dayIndex <= lastObserved.dayIndex) continue;
    if (day.stageMass[stage] >= threshold) return day.dayIndex - lastObserved.dayIndex;
  }
  return undefined;
}

/**
 * Plain words for a day's posterior, for captions and screen readers. The
 * second stage is named whenever it holds a real share, because "Estrus,
 * leaning Metestrus" is the gradient the categorical label could not say.
 */
export function describePhase(day: PhaseDay): string {
  const ranked = CYCLE_ORDER.slice().sort((a, b) => day.stageMass[b] - day.stageMass[a]);
  const [first, second] = ranked;
  const lead = day.stageMass[first];
  const runnerUp = day.stageMass[second];
  if (lead < 0.4) return "Spread around the cycle";
  if (runnerUp >= 0.25) return `${first}, leaning ${second}`;
  if (lead >= 0.8) return `Firmly ${first}`;
  return `Likely ${first}`;
}
