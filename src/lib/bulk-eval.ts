/**
 * Scoring helpers for evaluating a batch of photographs at once.
 *
 * A single upload demonstrates the pipeline. A batch is what tells you whether
 * the model is any use, because it exposes the two things one photograph cannot:
 * how often the guards decline, and how often the calls that survive are right.
 *
 * Ground truth is read from the filename where the lab's own convention supplies
 * it — `AH09_2_EST.jpg`, `227A_10_16_ESTRUS.jpg`. When it is absent the batch
 * still runs; it just reports coverage rather than accuracy.
 */

import type { ClassificationStage } from "@/lib/classification";

export type BinaryGroup = "PROESTRUS_OR_ESTRUS" | "METESTRUS_OR_DIESTRUS";

/** Stage tokens the lab uses in filenames, longest first so METESTRUS is not
 *  matched by the ESTRUS substring inside it. */
const STAGE_TOKENS: Array<[RegExp, ClassificationStage]> = [
  [/(^|[^A-Z])PROESTRUS([^A-Z]|$)/i, "Proestrus"],
  [/(^|[^A-Z])METESTRUS([^A-Z]|$)/i, "Metestrus"],
  [/(^|[^A-Z])DIESTRUS([^A-Z]|$)/i, "Diestrus"],
  [/(^|[^A-Z])ESTRUS([^A-Z]|$)/i, "Estrus"],
  // Whitespace counts as a delimiter: the lab's duplicate files are named
  // "AH09_2_PRO 3.jpg", so the token is followed by a space rather than a dot.
  [/(^|[\s_-])PRO([\s_.\-]|$)/i, "Proestrus"],
  [/(^|[\s_-])MET([\s_.\-]|$)/i, "Metestrus"],
  [/(^|[\s_-])DI([\s_.\-]|$)/i, "Diestrus"],
  [/(^|[\s_-])EST([\s_.\-]|$)/i, "Estrus"],
];

/**
 * Infer the labelled stage from a filename, or null.
 *
 * Order matters twice over: PROESTRUS and METESTRUS both contain ESTRUS, and the
 * short forms must be checked only after the long ones or `AH09_2_PRO` would
 * never reach its own rule.
 */
export function stageFromFilename(filename: string): ClassificationStage | null {
  const stem = filename.replace(/\.[^.]+$/, "");
  for (const [pattern, stage] of STAGE_TOKENS) {
    if (pattern.test(stem)) return stage;
  }
  return null;
}

export function groupForStage(stage: ClassificationStage): BinaryGroup {
  return stage === "Proestrus" || stage === "Estrus"
    ? "PROESTRUS_OR_ESTRUS"
    : "METESTRUS_OR_DIESTRUS";
}

export type BulkRow = {
  id: string;
  filename: string;
  previewUrl: string;
  status: "queued" | "running" | "done" | "error";
  error?: string;
  /** Null when the guards declined to back a call. */
  group?: BinaryGroup | null;
  rawSuggestion?: BinaryGroup;
  probabilityProestrusOrEstrus?: number;
  outOfReference?: boolean;
  acquisitionOutOfRange?: boolean;
  /** False when the call flipped under the synthetic dark-coat view, meaning it
   *  was keying on coat brightness rather than tissue. A third decline reason,
   *  and the only one that can fire on an otherwise in-range photograph. */
  darkCoatAgrees?: boolean;
  /** Unvalidated four-stage reference match, retained for context only. */
  referenceStage?: ClassificationStage;
  truth?: ClassificationStage | null;
  elapsedMs?: number;
};

export type BulkSummary = {
  total: number;
  analysed: number;
  failed: number;
  /** Calls the guards were willing to stand behind. */
  backed: number;
  declined: number;
  /** Of the declined, how many for each reason. */
  outOfReference: number;
  acquisitionOutOfRange: number;
  coatDependent: number;
  /** Present only when at least one filename carried a label. */
  labelled: number;
  correct: number;
  /** Accuracy over guard-backed calls that also have a label. */
  backedLabelled: number;
  backedCorrect: number;
};

export function summarise(rows: BulkRow[]): BulkSummary {
  const summary: BulkSummary = {
    total: rows.length,
    analysed: 0,
    failed: 0,
    backed: 0,
    declined: 0,
    outOfReference: 0,
    acquisitionOutOfRange: 0,
    coatDependent: 0,
    labelled: 0,
    correct: 0,
    backedLabelled: 0,
    backedCorrect: 0,
  };

  for (const row of rows) {
    if (row.status === "error") {
      summary.failed += 1;
      continue;
    }
    if (row.status !== "done") continue;
    summary.analysed += 1;

    const backed = Boolean(row.group);
    if (backed) summary.backed += 1;
    else summary.declined += 1;
    if (row.outOfReference) summary.outOfReference += 1;
    if (row.acquisitionOutOfRange) summary.acquisitionOutOfRange += 1;
    if (row.darkCoatAgrees === false) summary.coatDependent += 1;

    if (row.truth) {
      summary.labelled += 1;
      // Score the raw suggestion too, so declining is not rewarded as accuracy.
      const called = row.group ?? row.rawSuggestion;
      const hit = called === groupForStage(row.truth);
      if (hit) summary.correct += 1;
      if (backed) {
        summary.backedLabelled += 1;
        if (hit) summary.backedCorrect += 1;
      }
    }
  }

  return summary;
}

export function percent(numerator: number, denominator: number): string {
  if (!denominator) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}
