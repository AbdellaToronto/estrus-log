"use client";

/**
 * A subject's cycle history as a band of daily states.
 *
 * This replaces a line sparkline, which was the wrong form twice over. A line
 * encodes magnitude and interpolates between its points, but stage is a named
 * state with nothing in between — there is no "2.5" between Estrus and
 * Metestrus. And because the cycle loops, the step from the last stage back to
 * the first plotted as a full-height plunge on a 1-4 axis, so the most dramatic
 * mark on the chart was an artefact of the encoding rather than anything the
 * animal did.
 *
 * One cell per day, coloured by state, is the honest encoding: no false slopes,
 * no invented intermediates, and a missing day reads as a gap instead of being
 * quietly bridged. It also scans across a whole cohort at once, which a row of
 * twelve sparklines never did.
 */

import { useId, useState } from "react";
import type { ClassificationStage } from "@/lib/classification";
import { CYCLE_ORDER, STAGE_VISUAL } from "@/lib/stage-palette";
import { cn } from "@/lib/utils";

export type CyclePoint = {
  day: number;
  dateLabel: string;
  stage: ClassificationStage | null;
};

export function CycleStrip({
  points,
  label,
  reduceMotion = false,
  dense = false,
  todayDay,
  className,
}: {
  points: CyclePoint[];
  label: string;
  reduceMotion?: boolean;
  dense?: boolean;
  todayDay?: number;
  className?: string;
}) {
  const [hovered, setHovered] = useState<CyclePoint | null>(null);
  const tooltipId = useId();

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn("flex w-full", dense ? "gap-[1.5px]" : "gap-[2px]")}
        role="img"
        aria-label={`${label}: ${points
          .map((p) => `${p.dateLabel} ${p.stage ?? "no observation"}`)
          .join(", ")}`}
        onMouseLeave={() => setHovered(null)}
      >
        {points.map((point, index) => {
          const visual = point.stage ? STAGE_VISUAL[point.stage] : null;
          const isToday = todayDay !== undefined && point.day === todayDay;

          return (
            <div
              key={point.day}
              onMouseEnter={() => setHovered(point)}
              className={cn(
                "relative min-w-0 flex-1 overflow-hidden",
                dense ? "h-6" : "h-9",
                // A day with no observation stays empty rather than being
                // bridged; the hairline shows the slot existed.
                !visual && "border border-dashed border-[#ded9cd] bg-transparent"
              )}
              style={
                visual
                  ? {
                      backgroundColor: visual.color,
                      // Days arrive left to right, which is the axis the data
                      // actually moves along.
                      animation: reduceMotion
                        ? undefined
                        : `cycle-cell-in 320ms cubic-bezier(0.22,1,0.36,1) both`,
                      animationDelay: reduceMotion
                        ? undefined
                        : `${Math.min(index * 26, 900)}ms`,
                    }
                  : undefined
              }
            >
              {/* Identity is never colour alone: the letter rides the cell
                  wherever there is room for it. */}
              {visual && !dense && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/85">
                  {visual.short}
                </span>
              )}
              {isToday && (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-[#292b4c]" />
              )}
            </div>
          );
        })}
      </div>

      {hovered && (
        <div
          id={tooltipId}
          role="status"
          className="pointer-events-none absolute -top-1 left-0 z-20 -translate-y-full border border-[#ded9cd] bg-white px-2.5 py-1.5 text-xs shadow-sm"
        >
          <span className="font-semibold text-[#292b4c]">{hovered.dateLabel}</span>
          <span className="mx-1.5 text-[#ded9cd]">·</span>
          {hovered.stage ? (
            <span className="inline-flex items-center gap-1.5 text-[#625f58]">
              <span
                className="inline-block h-2 w-2"
                style={{ backgroundColor: STAGE_VISUAL[hovered.stage].color }}
              />
              {hovered.stage}
            </span>
          ) : (
            <span className="text-[#8d887e]">no observation</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Always present, because four hues alone never carry identity. */
export function CycleLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {CYCLE_ORDER.map((stage) => (
        <li key={stage} className="flex items-center gap-1.5">
          <span
            className="inline-flex h-3 w-3 items-center justify-center text-[8px] font-bold text-white/90"
            style={{ backgroundColor: STAGE_VISUAL[stage].color }}
          >
            {STAGE_VISUAL[stage].short}
          </span>
          <span className="text-xs text-[#625f58]">{stage}</span>
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 border border-dashed border-[#ded9cd]" />
        <span className="text-xs text-[#625f58]">No observation</span>
      </li>
    </ul>
  );
}
