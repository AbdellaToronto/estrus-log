import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClassificationStage } from "./classification";
import {
  DEFAULT_CYCLE_PRIOR,
  circularMean,
  cyclePeriod,
  daysUntilStage,
  describePhase,
  fitCyclePeriod,
  formatDay,
  inferCyclePhase,
  observationLikelihood,
  parseDay,
  stageArcs,
  stageAtPhase,
  stageMidpoint,
  transitionKernel,
  type PhaseObservation,
} from "./cycle-phase";

/** A mulberry32 generator, so a "random" test is the same test every run. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const START = parseDay("2026-07-01");

/**
 * Simulate a mouse that really does go round the ring once per `period` days,
 * observed on a subset of days with occasional one-stage label errors.
 */
function simulate(options: {
  period: number;
  days: number;
  seed: number;
  observeEvery?: number;
  missingRate?: number;
  labelErrorRate?: number;
  binaryNoiseSd?: number;
}): { observations: PhaseObservation[]; truth: Map<string, ClassificationStage> } {
  const random = seeded(options.seed);
  const observations: PhaseObservation[] = [];
  const truth = new Map<string, ClassificationStage>();
  const arcs = stageArcs(DEFAULT_CYCLE_PRIOR);
  const startPhase = random();
  for (let day = 0; day < options.days; day += 1) {
    const phase = (startPhase + day / options.period) % 1;
    const stage = stageAtPhase(phase);
    const date = formatDay(START + day);
    truth.set(date, stage);
    if (day % (options.observeEvery ?? 1) !== 0) continue;
    if (random() < (options.missingRate ?? 0)) continue;
    let label = stage;
    if (random() < (options.labelErrorRate ?? 0)) {
      const index = arcs.findIndex((arc) => arc.stage === stage);
      const step = random() < 0.5 ? -1 : 1;
      label = arcs[(index + step + arcs.length) % arcs.length].stage;
    }
    const early = stage === "Proestrus" || stage === "Estrus" ? 0.85 : 0.15;
    const jitter = (random() - 0.5) * 2 * (options.binaryNoiseSd ?? 0);
    observations.push({
      date,
      stage: label,
      earlyGroupProbability: Math.min(1, Math.max(0, early + jitter)),
      earlyGroupReferenceBacked: true,
    });
  }
  return { observations, truth };
}

function accuracy(
  result: ReturnType<typeof inferCyclePhase>,
  truth: Map<string, ClassificationStage>
): number {
  let correct = 0;
  let total = 0;
  for (const day of result.days) {
    const actual = truth.get(day.date);
    if (!actual) continue;
    total += 1;
    if (day.likelyStage === actual) correct += 1;
  }
  return correct / total;
}

describe("ring geometry", () => {
  it("divides the ring pro rata by stage duration, in cycle order", () => {
    const arcs = stageArcs();
    assert.deepEqual(
      arcs.map((arc) => arc.stage),
      ["Proestrus", "Estrus", "Metestrus", "Diestrus"]
    );
    assert.equal(arcs[0].start, 0);
    assert.ok(Math.abs(arcs[arcs.length - 1].end - 1) < 1e-12);
    const period = cyclePeriod(DEFAULT_CYCLE_PRIOR);
    assert.ok(Math.abs(arcs[3].end - arcs[3].start - 2 / period) < 1e-12);
  });

  it("maps a phase to the arc it sits on, wrapping negative phases", () => {
    assert.equal(stageAtPhase(0.01), "Proestrus");
    assert.equal(stageAtPhase(stageMidpoint("Estrus")), "Estrus");
    assert.equal(stageAtPhase(-0.01), "Diestrus");
    assert.equal(stageAtPhase(1.0), "Proestrus");
  });

  it("round-trips calendar days", () => {
    assert.equal(formatDay(parseDay("2026-02-28")), "2026-02-28");
    assert.equal(formatDay(parseDay("2026-02-28") + 1), "2026-03-01");
  });
});

describe("transition kernel", () => {
  it("is a distribution centred on one day's advance", () => {
    const bins = 72;
    const period = 4.75;
    const kernel = transitionKernel(period, 0.06, bins);
    const total = kernel.reduce((sum, value) => sum + value, 0);
    assert.ok(Math.abs(total - 1) < 1e-9);
    const peak = kernel.indexOf(Math.max(...kernel));
    assert.ok(Math.abs(peak - bins / period) <= 1);
  });

  it("assigns no mass to moving backwards a whole stage", () => {
    const kernel = transitionKernel(4.75, 0.06, 72);
    // Offset 54 is 18 bins backwards, a full quarter turn the wrong way.
    assert.ok(kernel[54] < 1e-6);
  });
});

describe("observation likelihood", () => {
  it("puts most of a saved stage's likelihood on its own arc", () => {
    const likelihood = observationLikelihood({ date: "2026-07-01", stage: "Estrus" });
    const total = likelihood.reduce((sum, value) => sum + value, 0);
    const onArc = likelihood.reduce(
      (sum, value, bin) =>
        stageAtPhase((bin + 0.5) / likelihood.length) === "Estrus" ? sum + value : sum,
      0
    );
    assert.ok(onArc / total > 0.6, `expected most mass on Estrus, got ${onArc / total}`);
    // Everything keeps a floor, so a wrong label can be outvoted by its neighbours.
    assert.ok(Math.min(...likelihood) > 0.05);
  });

  it("treats an uncertain record and a bare date as flat", () => {
    const flat = observationLikelihood({ date: "2026-07-01", uncertain: true, stage: "Estrus" });
    assert.ok(flat.every((value) => value === 1));
    const bare = observationLikelihood({ date: "2026-07-01" });
    assert.ok(bare.every((value) => value === 1));
  });

  it("tempers the binary model by reference trust", () => {
    const backed = observationLikelihood({
      date: "2026-07-01",
      earlyGroupProbability: 0.95,
      earlyGroupReferenceBacked: true,
    });
    const offReference = observationLikelihood({
      date: "2026-07-01",
      earlyGroupProbability: 0.95,
      earlyGroupReferenceBacked: false,
    });
    const ratio = (values: number[]) => Math.max(...values) / Math.min(...values);
    assert.ok(ratio(backed) > ratio(offReference));
    assert.ok(ratio(offReference) > 1);
  });
});

describe("circular mean", () => {
  it("returns full concentration for a point mass and none for a flat ring", () => {
    const bins = 72;
    const point = new Array<number>(bins).fill(0);
    point[10] = 1;
    const peaked = circularMean(point);
    assert.ok(Math.abs(peaked.phase - 10.5 / bins) < 1e-9);
    assert.ok(Math.abs(peaked.concentration - 1) < 1e-9);
    const flat = circularMean(new Array<number>(bins).fill(1 / bins));
    assert.ok(flat.concentration < 1e-9);
  });
});

describe("phase inference", () => {
  it("returns an empty result with no usable observations", () => {
    const result = inferCyclePhase([{ date: "not a date", stage: "Estrus" }]);
    assert.equal(result.days.length, 0);
    assert.equal(result.observedDays, 0);
  });

  it("recovers a clean daily record almost exactly", () => {
    const { observations, truth } = simulate({ period: 4.75, days: 20, seed: 1 });
    const result = inferCyclePhase(observations);
    assert.equal(result.days.length, 20);
    assert.ok(accuracy(result, truth) >= 0.95);
    assert.ok(result.days.every((day) => day.concentration > 0.7));
  });

  it("fills unobserved days from the prior and marks them", () => {
    const { observations, truth } = simulate({
      period: 4.75,
      days: 24,
      seed: 2,
      missingRate: 0.35,
    });
    const result = inferCyclePhase(observations);
    const gaps = result.days.filter((day) => !day.observed);
    assert.ok(gaps.length > 0);
    assert.ok(gaps.every((day) => !day.forecast));
    let correct = 0;
    for (const day of gaps) if (day.likelyStage === truth.get(day.date)) correct += 1;
    assert.ok(correct / gaps.length >= 0.8, `gap accuracy ${correct / gaps.length}`);
  });

  it("outvotes one-stage label errors with the neighbours", () => {
    const { observations, truth } = simulate({
      period: 4.75,
      days: 28,
      seed: 3,
      labelErrorRate: 0.2,
    });
    const rawAgreement =
      observations.filter((observation) => observation.stage === truth.get(observation.date))
        .length / observations.length;
    const result = inferCyclePhase(observations);
    const smoothed = accuracy(result, truth);
    assert.ok(smoothed > rawAgreement, `smoothed ${smoothed} vs raw ${rawAgreement}`);
  });

  it("is less committed on a sparse, aliased record", () => {
    const daily = simulate({ period: 4.75, days: 20, seed: 4 });
    const sparse = simulate({ period: 4.75, days: 20, seed: 4, observeEvery: 5 });
    const meanConcentration = (observations: PhaseObservation[]) => {
      const result = inferCyclePhase(observations);
      const gaps = result.days.filter((day) => !day.observed);
      const pool = gaps.length > 0 ? gaps : result.days;
      return pool.reduce((sum, day) => sum + day.concentration, 0) / pool.length;
    };
    assert.ok(meanConcentration(sparse.observations) < meanConcentration(daily.observations));
  });

  it("forecasts past the last observation and reports days until a stage", () => {
    const { observations } = simulate({ period: 4.75, days: 12, seed: 5 });
    // Stop on a day the model should call Diestrus so Estrus is still ahead.
    const truncated = observations.slice(0, 10);
    const result = inferCyclePhase(truncated, { forecastDays: 5 });
    assert.equal(result.days.filter((day) => day.forecast).length, 5);
    const forecastDays = result.days.filter((day) => day.forecast);
    assert.ok(forecastDays.every((day) => !day.observed));
    const wait = daysUntilStage(result, "Estrus");
    assert.ok(wait === undefined || (wait >= 0 && wait <= 5));
  });

  it("combines binary evidence and a saved stage without breaking", () => {
    const { observations, truth } = simulate({
      period: 4.75,
      days: 16,
      seed: 6,
      binaryNoiseSd: 0.2,
      labelErrorRate: 0.1,
    });
    const result = inferCyclePhase(observations);
    assert.ok(accuracy(result, truth) >= 0.85);
    for (const day of result.days) {
      const total = Object.values(day.stageMass).reduce((sum, value) => sum + value, 0);
      assert.ok(Math.abs(total - 1) < 1e-9);
    }
  });
});

describe("period fitting", () => {
  it("declines to fit on too few days", () => {
    const { observations } = simulate({ period: 4.75, days: 4, seed: 7 });
    const fit = fitCyclePeriod(observations);
    assert.equal(fit.fitted, false);
    assert.equal(fit.period, cyclePeriod(DEFAULT_CYCLE_PRIOR));
  });

  it("recovers the true period from a fortnight of daily labels", () => {
    for (const truePeriod of [4, 5.5]) {
      const { observations } = simulate({ period: truePeriod, days: 16, seed: 8 });
      const fit = fitCyclePeriod(observations);
      assert.ok(fit.fitted);
      assert.ok(
        Math.abs(fit.period - truePeriod) <= 0.25,
        `expected ${truePeriod}, fitted ${fit.period}`
      );
    }
  });
});

describe("descriptions", () => {
  it("names the runner-up when it holds a real share", () => {
    const base = {
      date: "2026-07-01",
      dayIndex: 0,
      observed: true,
      forecast: false,
      posterior: [],
      meanPhase: 0,
      concentration: 0.5,
    };
    assert.equal(
      describePhase({
        ...base,
        stageMass: { Proestrus: 0.05, Estrus: 0.6, Metestrus: 0.3, Diestrus: 0.05 },
        likelyStage: "Estrus",
      }),
      "Estrus, leaning Metestrus"
    );
    assert.equal(
      describePhase({
        ...base,
        stageMass: { Proestrus: 0.05, Estrus: 0.9, Metestrus: 0.03, Diestrus: 0.02 },
        likelyStage: "Estrus",
      }),
      "Firmly Estrus"
    );
    assert.equal(
      describePhase({
        ...base,
        stageMass: { Proestrus: 0.3, Estrus: 0.3, Metestrus: 0.2, Diestrus: 0.2 },
        likelyStage: "Proestrus",
      }),
      "Spread around the cycle"
    );
  });
});
