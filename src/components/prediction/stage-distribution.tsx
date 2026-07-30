"use client";

import {
  ESTRUS_STAGES,
  normalizeConfidenceScores,
  type ClassificationStage,
} from "@/lib/classification";
import { cn } from "@/lib/utils";

// Colour comes from the one validated palette. The previous values put Estrus
// and Proestrus at ΔE 14.5, below the floor at which normal colour vision can
// separate them — and those are the two stages the model confuses most.
const STAGE_TONES: Record<ClassificationStage, string> = {
  Proestrus: "bg-[#4a3aa7]",
  Estrus: "bg-[#e34948]",
  Metestrus: "bg-[#eda100]",
  Diestrus: "bg-[#2a78d6]",
};

export function StageDistribution({
  scores,
  predictedStage,
  compact = false,
  className,
}: {
  scores: Partial<Record<ClassificationStage, number>>;
  predictedStage?: ClassificationStage;
  compact?: boolean;
  className?: string;
}) {
  const normalized = normalizeConfidenceScores(scores);
  const orderedStages: ClassificationStage[] = predictedStage
    ? [
        predictedStage,
        ...ESTRUS_STAGES
          .filter((stage) => stage !== predictedStage)
          .sort((left, right) => normalized[right] - normalized[left]),
      ]
    : [...ESTRUS_STAGES];

  return (
    <div className={cn("space-y-3", className)} aria-label="Four-stage model support">
      {orderedStages.map((stage) => {
        const percentage = Math.round(normalized[stage] * 100);
        const active = predictedStage === stage;
        return (
          <div key={stage} className="grid grid-cols-[88px_minmax(0,1fr)_42px] items-center gap-3">
            <span
              className={cn(
                compact ? "text-xs" : "text-sm",
                active ? "font-semibold text-[#292b4c]" : "text-[#6f6b64]"
              )}
            >
              {stage}
            </span>
            <div className={cn("overflow-hidden rounded-full bg-[#ebe7df]", compact ? "h-1.5" : "h-2")}>
              <div
                className={cn("h-full rounded-full transition-[width] duration-300", STAGE_TONES[stage])}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span
              className={cn(
                "text-right tabular-nums",
                compact ? "text-xs" : "text-sm",
                active ? "font-semibold text-[#292b4c]" : "text-[#625f58]"
              )}
            >
              {percentage}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
