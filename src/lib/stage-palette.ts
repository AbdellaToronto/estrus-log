/**
 * The one stage palette, validated rather than chosen by eye.
 *
 * There were three of these in the codebase — one in the cohort presets, one in
 * the stage-distribution bars, one in the cycle history — and no two agreed.
 * Proestrus was pink in one place, light blue in another. Worse, two of the
 * three failed an automated check: the history palette's light blue and green
 * read as grey, and the distribution palette put Estrus and Proestrus at ΔE 14.5
 * apart, below the floor at which normal colour vision can separate them. Those
 * are the two stages the model itself confuses most, so the chart was making the
 * hardest scientific distinction the hardest thing to see.
 *
 * These four pass all six checks all-pairs against a white surface — lightness
 * band, chroma floor, colourblind separation, normal-vision floor, and contrast —
 * with one known exception recorded below.
 *
 *   worst all-pairs CVD      #2a78d6 ↔ #4a3aa7   ΔE 13.0 (deutan), 17.1 (tritan)
 *   worst normal vision      #2a78d6 ↔ #4a3aa7   ΔE 16.3
 *
 * Known WARN: gold sits at 2.17:1 against white, under the 3:1 bar. That is not
 * dismissable — every surface using it must carry a visible text label or a table
 * view so identity is never colour alone. Both consumers do.
 *
 * Regenerate the verdict with the bundled validator:
 *   node scripts/validate_palette.js \
 *     "#4a3aa7,#e34948,#eda100,#2a78d6" --mode light --surface "#ffffff" --pairs all
 */

import type { ClassificationStage } from "@/lib/classification";

export type StageVisual = {
  /** Fill for marks. */
  color: string;
  /** Tint for large quiet areas, where the full-strength hue would shout. */
  tint: string;
  /** Single letter for dense strips where a word will not fit. */
  short: string;
  /**
   * Position in the oestrous cycle, 0-indexed. The cycle is a loop, so this is
   * an angle rather than a magnitude — see CYCLE_ORDER.
   */
  position: number;
};

/**
 * Biological order of the cycle. Metestrus wraps back to Diestrus.
 *
 * This ordering is why the history is no longer drawn as a line: on a linear
 * 1-4 axis the wrap from the last stage to the first plots as a full-height
 * plunge, so every completed cycle rendered as a crash that never happened.
 */
export const CYCLE_ORDER: ClassificationStage[] = [
  "Proestrus",
  "Estrus",
  "Metestrus",
  "Diestrus",
];

export const STAGE_VISUAL: Record<ClassificationStage, StageVisual> = {
  Proestrus: { color: "#4a3aa7", tint: "#e2ddf5", short: "P", position: 0 },
  Estrus: { color: "#e34948", tint: "#fadcdb", short: "E", position: 1 },
  Metestrus: { color: "#eda100", tint: "#fbe9c2", short: "M", position: 2 },
  Diestrus: { color: "#2a78d6", tint: "#d3e4fa", short: "D", position: 3 },
};

export function stageColor(stage: ClassificationStage): string {
  return STAGE_VISUAL[stage].color;
}

/** Steps forward around the loop, so Metestrus to Diestrus is 1 rather than -2. */
export function cycleAdvance(
  from: ClassificationStage,
  to: ClassificationStage
): number {
  const span = CYCLE_ORDER.length;
  return (STAGE_VISUAL[to].position - STAGE_VISUAL[from].position + span) % span;
}
