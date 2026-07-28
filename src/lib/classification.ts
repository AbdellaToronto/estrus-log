/**
 * Shared contracts for an estrus-stage suggestion.
 *
 * `confidence_scores` are relative model support scores, not calibrated clinical
 * probabilities. Consumers should use `review_required` and the evidence fields
 * when deciding whether a human needs to inspect a prediction.
 */
export const ESTRUS_STAGES = [
  "Proestrus",
  "Estrus",
  "Metestrus",
  "Diestrus",
] as const;

export type ClassificationStage = (typeof ESTRUS_STAGES)[number];

export type ClassificationFeatures = {
  /** Canonical keys used in saved logs and cohort analytics. */
  opening?: string;
  color?: string;
  swelling?: string;
  moistness?: string;
  /** Legacy keys retained so older single-image responses remain readable. */
  vaginal_opening?: string;
  tissue_color?: string;
  moisture?: string;
};

export type ClassificationEvidence = {
  method: string;
  reference_count?: number;
  nearest_similarity?: number;
  mean_similarity?: number;
  /** Optional corroboration from the validated public binary photo model. */
  external_binary?: {
    task: "external_photo_binary_estrus_group";
    binary_suggestion: "PROESTRUS_OR_ESTRUS" | "METESTRUS_OR_DIESTRUS";
    reference_backed_binary_suggestion:
      | "PROESTRUS_OR_ESTRUS"
      | "METESTRUS_OR_DIESTRUS"
      | null;
    decision_status: "reference_backed_suggestion" | "abstain";
    abstention_reasons: string[];
    probability_proestrus_or_estrus: number;
    threshold: number;
    synthetic_dark_coat: {
      binary_suggestion: "PROESTRUS_OR_ESTRUS" | "METESTRUS_OR_DIESTRUS";
      probability_proestrus_or_estrus: number;
      agrees_with_clean: boolean;
      absolute_probability_shift: number;
    };
    reference_domain: { out_of_reference: boolean };
    acquisition_domain: {
      out_of_range: boolean;
      outlier_metrics: string[];
      severe_outlier_metrics: string[];
      metrics: Record<string, number>;
    };
    review_required: true;
    review_reasons: string[];
    model_version: string;
  };
  external_binary_agrees_with_stage_group?: boolean;
  roi_confirmed?: boolean;
};

export interface ClassificationResult {
  estrus_stage: ClassificationStage;
  confidence_scores: Record<ClassificationStage, number>;
  features: ClassificationFeatures;
  reasoning: string;
  thoughts?: string;
  /** A prediction can be shown, but should not be logged without review. */
  review_required?: boolean;
  review_reasons?: string[];
  evidence?: ClassificationEvidence;
  model_version?: string;
}

export type ClassificationSummary = {
  stage: ClassificationStage;
  confidence: number;
  runnerUp: ClassificationStage;
  margin: number;
  reviewRequired: boolean;
};

const emptyScores = (): Record<ClassificationStage, number> => ({
  Proestrus: 0,
  Estrus: 0,
  Metestrus: 0,
  Diestrus: 0,
});

export function isClassificationStage(value: unknown): value is ClassificationStage {
  return typeof value === "string" && ESTRUS_STAGES.includes(value as ClassificationStage);
}

/**
 * Convert arbitrary score payloads (including legacy JSON) into a safe,
 * normalized distribution. Invalid, negative, and missing values contribute 0.
 */
export function normalizeConfidenceScores(
  scores: Partial<Record<ClassificationStage, unknown>> | null | undefined
): Record<ClassificationStage, number> {
  const normalized = emptyScores();

  for (const stage of ESTRUS_STAGES) {
    const value = scores?.[stage];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      normalized[stage] = value;
    }
  }

  const total = Object.values(normalized).reduce((sum, value) => sum + value, 0);
  if (total === 0) return normalized;

  for (const stage of ESTRUS_STAGES) {
    normalized[stage] /= total;
  }
  return normalized;
}

/** Makes the feature vocabulary consistent between the Gemini and BioCLIP flows. */
export function normalizeClassificationFeatures(
  features: ClassificationFeatures | Record<string, unknown> | null | undefined
): ClassificationFeatures {
  if (!features || typeof features !== "object") return {};
  const raw = features as Record<string, unknown>;
  const text = (key: string): string | undefined =>
    typeof raw[key] === "string" && raw[key].trim().length > 0
      ? raw[key].trim()
      : undefined;

  return {
    opening: text("opening") ?? text("vaginal_opening"),
    color: text("color") ?? text("tissue_color"),
    swelling: text("swelling"),
    moistness: text("moistness") ?? text("moisture"),
  };
}

export function summarizeClassification(
  result?: Pick<ClassificationResult, "estrus_stage" | "confidence_scores" | "review_required"> | null
): ClassificationSummary | undefined {
  if (!result || !isClassificationStage(result.estrus_stage)) return undefined;

  const scores = normalizeConfidenceScores(result.confidence_scores);
  const ranked = [...ESTRUS_STAGES].sort((a, b) => scores[b] - scores[a]);
  const stage = result.estrus_stage;
  const confidence = scores[stage];
  const runnerUp = ranked.find((candidate) => candidate !== stage) ?? stage;

  return {
    stage,
    confidence,
    runnerUp,
    margin: Math.max(0, confidence - scores[runnerUp]),
    reviewRequired: Boolean(result.review_required),
  };
}

export function getPrimaryStageName(
  result?: ClassificationResult | null
): ClassificationStage | undefined {
  return summarizeClassification(result)?.stage;
}

export function getPrimaryStageConfidence(
  result?: ClassificationResult | null
): number {
  return summarizeClassification(result)?.confidence ?? 0;
}

export function getPrimaryStagePrediction(
  result?: ClassificationResult | null
): { name: ClassificationStage; confidence: number; reviewRequired: boolean } | undefined {
  const summary = summarizeClassification(result);
  if (!summary) return undefined;

  return {
    name: summary.stage,
    confidence: summary.confidence,
    reviewRequired: summary.reviewRequired,
  };
}

const ROUTINE_CONFIRMATION_PATTERN =
  /human confirmation is required|until this classifier is validated|scientist confirmation/i;

/**
 * `review_required` historically also carried the universal rule that a human
 * must click Accept. The UI already enforces that rule for every prediction.
 * This helper isolates the predictions that need *extra* scrutiny so the inbox
 * can still distinguish ready work from genuine exceptions.
 */
export function needsCloserPredictionReview(
  result?: Pick<ClassificationResult, "review_required" | "review_reasons"> | null
): boolean {
  if (!result?.review_required) return false;
  const reasons = result.review_reasons ?? [];
  return reasons.length === 0 ||
    reasons.some((reason) => !ROUTINE_CONFIRMATION_PATTERN.test(reason));
}
