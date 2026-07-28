"use client";

import {
  ESTRUS_STAGES,
  normalizeConfidenceScores,
  type ClassificationStage,
} from "@/lib/classification";
import { cn } from "@/lib/utils";

const STAGE_TONES: Record<ClassificationStage, string> = {
  Proestrus: "bg-[#8f83d8]",
  Estrus: "bg-[#c76f87]",
  Metestrus: "bg-[#d3a450]",
  Diestrus: "bg-[#6493ba]",
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
