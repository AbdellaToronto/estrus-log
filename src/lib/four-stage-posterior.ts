/**
 * A four-stage estrus estimate assembled from parts that individually hold up.
 *
 * No validated four-stage classifier exists for this task. The published dataset
 * is labelled estrus versus nonestrus, so a four-way head trained on it has no
 * ground truth to learn from, and a four-way head trained on this lab's own
 * photographs sits at chance (28.2% balanced against 25%). Shipping confidence
 * bars from either would look authoritative while meaning nothing.
 *
 * So this does not classify. It combines two things that are already trustworthy:
 *
 *   1. The binary likelihood from the validated model — is this animal heading
 *      into oestrus, or coming out of it — which scores 66/76 on the sealed
 *      public test.
 *   2. A transition prior from the subject's own recorded history. The cycle is
 *      an ordered loop, so yesterday's scientist-confirmed stage says a great
 *      deal about today's.
 *
 * Multiply them, normalise, and the result is a genuine posterior: every stage
 * gets a number, and each number traces back to either a measured model output or
 * an observed record. With no history the prior is uniform within each binary
 * half, so the estimate degrades to exactly what the binary model knows and no
 * further. That is the point — it widens instead of inventing.
 */

import { ESTRUS_STAGES, type ClassificationStage } from "@/lib/classification";

export type BinaryGroup = "PROESTRUS_OR_ESTRUS" | "METESTRUS_OR_DIESTRUS";

/** Which stages each half of the binary task covers. */
export const STAGES_IN_GROUP: Record<BinaryGroup, ClassificationStage[]> = {
  PROESTRUS_OR_ESTRUS: ["Proestrus", "Estrus"],
  METESTRUS_OR_DIESTRUS: ["Metestrus", "Diestrus"],
};

export function groupForStage(stage: ClassificationStage): BinaryGroup {
  return stage === "Proestrus" || stage === "Estrus"
    ? "PROESTRUS_OR_ESTRUS"
    : "METESTRUS_OR_DIESTRUS";
}

/**
 * Transition probabilities for a 4-5 day cycle, indexed [previous][next].
 *
 * The mouse oestrous cycle runs proestrus, estrus, metestrus, diestrus and back.
 * Advancing one step is the common case; diestrus is the stage that most often
 * persists across a day, and stepping backwards is rare but not impossible given
 * a day's sampling interval and observer variation.
 *
 * These are deliberately soft. They encode the ordering of the cycle, which is
 * settled biology, and not a claim about this colony's exact timing — which would
 * need per-colony estimation from confirmed histories.
 */
const TRANSITION: Record<ClassificationStage, Record<ClassificationStage, number>> = {
  Proestrus: { Proestrus: 0.20, Estrus: 0.62, Metestrus: 0.13, Diestrus: 0.05 },
  Estrus: { Proestrus: 0.05, Estrus: 0.22, Metestrus: 0.58, Diestrus: 0.15 },
  Metestrus: { Proestrus: 0.06, Estrus: 0.05, Metestrus: 0.19, Diestrus: 0.70 },
  Diestrus: { Proestrus: 0.42, Estrus: 0.08, Metestrus: 0.10, Diestrus: 0.40 },
};

/** Damps the prior as the record ages: a stage confirmed six days ago says little. */
function recencyWeight(daysSince: number): number {
  if (!Number.isFinite(daysSince) || daysSince < 0) return 0;
  if (daysSince <= 1) return 1;
  if (daysSince >= 5) return 0;
  // Linear decay from one day to five.
  return (5 - daysSince) / 4;
}

export type PosteriorInput = {
  /** Which half of the cycle the validated model reports. */
  group: BinaryGroup;
  /** Its probability for PROESTRUS_OR_ESTRUS, on the model's own scale. */
  probabilityProestrusOrEstrus: number;
  /** The subject's last scientist-confirmed stage, if there is one. */
  previousStage?: ClassificationStage | null;
  /** Days between that confirmation and this photograph. */
  daysSincePrevious?: number | null;
  /** True when the model declined, in which case the binary half is not trusted. */
  abstained?: boolean;
};

export type FourStagePosterior = {
  scores: Record<ClassificationStage, number>;
  /** Highest-scoring stage, or undefined when the estimate is too flat to name one. */
  leading?: ClassificationStage;
  margin: number;
  /** How much of the estimate came from history rather than the image. */
  priorWeight: number;
  basis: "binary_and_history" | "binary_only" | "history_only" | "uninformative";
  /** Plain-language account of what produced these numbers. */
  explanation: string;
};

const emptyScores = (): Record<ClassificationStage, number> => ({
  Proestrus: 0,
  Estrus: 0,
  Metestrus: 0,
  Diestrus: 0,
});

/** Below this the estimate is too flat to name a single stage. */
const FLAT_BELOW = 0.34;

export function fourStagePosterior(input: PosteriorInput): FourStagePosterior {
  const {
    group,
    probabilityProestrusOrEstrus,
    previousStage,
    daysSincePrevious,
    abstained = false,
  } = input;

  // Binary likelihood, spread evenly across the two stages in each half. The
  // model genuinely cannot distinguish within a half, and pretending otherwise is
  // the error this whole module exists to avoid.
  const pEarly = Math.min(1, Math.max(0, probabilityProestrusOrEstrus));
  const likelihood = emptyScores();
  if (abstained) {
    for (const stage of ESTRUS_STAGES) likelihood[stage] = 0.25;
  } else {
    likelihood.Proestrus = pEarly / 2;
    likelihood.Estrus = pEarly / 2;
    likelihood.Metestrus = (1 - pEarly) / 2;
    likelihood.Diestrus = (1 - pEarly) / 2;
  }

  const weight = previousStage ? recencyWeight(daysSincePrevious ?? 1) : 0;
  const prior = emptyScores();
  if (previousStage && weight > 0) {
    const row = TRANSITION[previousStage];
    for (const stage of ESTRUS_STAGES) {
      // Blend toward uniform as the record ages.
      prior[stage] = weight * row[stage] + (1 - weight) * 0.25;
    }
  } else {
    for (const stage of ESTRUS_STAGES) prior[stage] = 0.25;
  }

  const combined = emptyScores();
  let total = 0;
  for (const stage of ESTRUS_STAGES) {
    combined[stage] = likelihood[stage] * prior[stage];
    total += combined[stage];
  }
  if (total > 0) {
    for (const stage of ESTRUS_STAGES) combined[stage] /= total;
  } else {
    for (const stage of ESTRUS_STAGES) combined[stage] = 0.25;
  }

  const ranked = [...ESTRUS_STAGES].sort((a, b) => combined[b] - combined[a]);
  const margin = combined[ranked[0]] - combined[ranked[1]];
  const informative = combined[ranked[0]] >= FLAT_BELOW;

  const usesHistory = Boolean(previousStage) && weight > 0;
  const basis: FourStagePosterior["basis"] = abstained
    ? usesHistory
      ? "history_only"
      : "uninformative"
    : usesHistory
      ? "binary_and_history"
      : "binary_only";

  return {
    scores: combined,
    leading: informative ? ranked[0] : undefined,
    margin,
    priorWeight: weight,
    basis,
    explanation: explain(basis, group, pEarly, previousStage, weight),
  };
}

function explain(
  basis: FourStagePosterior["basis"],
  group: BinaryGroup,
  pEarly: number,
  previousStage?: ClassificationStage | null,
  weight = 0
): string {
  const half =
    group === "PROESTRUS_OR_ESTRUS" ? "proestrus or estrus" : "metestrus or diestrus";
  const confidence = `${Math.round((group === "PROESTRUS_OR_ESTRUS" ? pEarly : 1 - pEarly) * 100)}%`;
  const aged = weight < 1 ? ", discounted for age" : "";

  switch (basis) {
    case "binary_and_history":
      return `The validated model puts this at ${half} with ${confidence} support. ${previousStage} was the last confirmed stage, and the cycle's ordering makes some continuations far likelier than others${aged}. Those two together produce the split below.`;
    case "binary_only":
      return `The validated model puts this at ${half} with ${confidence} support, but it cannot separate the two stages inside that half. With no recent confirmed stage for this subject there is nothing to break the tie, so they are shown as equally likely rather than guessed at.`;
    case "history_only":
      return `The model declined to call a half for this photograph, so the split below rests only on ${previousStage} being the last confirmed stage and on the cycle's usual progression. Treat it as an expectation, not a reading of this image.`;
    default:
      return "The model declined this photograph and there is no recent confirmed stage for this subject, so no stage can be favoured over another.";
  }
}

/** For the interface: how much to trust this at a glance. */
export function posteriorStrength(
  posterior: FourStagePosterior
): "informative" | "directional" | "uninformative" {
  if (posterior.basis === "uninformative" || !posterior.leading) return "uninformative";
  return posterior.margin >= 0.18 ? "informative" : "directional";
}
