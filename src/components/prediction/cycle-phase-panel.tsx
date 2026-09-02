"use client";

/**
 * A subject's inferred cycle phase: the ring, the day's readout, and a scrubber
 * over every day of the record.
 *
 * The panel owns the inference. It fits a cycle length when the record is long
 * enough to support one, runs forward-backward over the daily observations,
 * and projects a few days past the last photo. The saved stages remain the
 * scientific record; this is the phase they imply once cycle order and period
 * are allowed to speak.
 */

import { useId, useMemo, useState } from "react";
import { format } from "date-fns";
import type { ClassificationStage } from "@/lib/classification";
import {
  daysUntilStage,
  describePhase,
  fitCyclePeriod,
  inferCyclePhase,
  type PhaseObservation,
} from "@/lib/cycle-phase";
import { CYCLE_ORDER, STAGE_VISUAL } from "@/lib/stage-palette";
import { cn } from "@/lib/utils";
import { CycleRing, PhaseScrubber } from "./cycle-ring";

const FORECAST_DAYS = 3;
/** Three days is under a full loop, so the trail reads as movement, not a circle. */
const TRAIL_DAYS = 3;

export function CyclePhasePanel({
  observations,
  subjectLabel,
  heading = "Cycle phase",
  reduceMotion = false,
  compact = false,
  className,
}: {
  observations: PhaseObservation[];
  subjectLabel: string;
  heading?: string;
  reduceMotion?: boolean;
  /** Smaller ring and tighter spacing, for an expanded row inside a list. */
  compact?: boolean;
  className?: string;
}) {
  const headingId = useId();
  const { result, fit } = useMemo(() => {
    const fit = fitCyclePeriod(observations);
    const result = inferCyclePhase(observations, {
      period: fit.period,
      forecastDays: FORECAST_DAYS,
    });
    return { result, fit };
  }, [observations]);

  const lastObserved = useMemo(
    () => [...result.days].reverse().find((day) => day.observed) ?? null,
    [result]
  );
  // Selection is a date, not an index, so a new record arriving keeps the
  // scientist on the day they were looking at; a date the series no longer
  // contains falls back to the last observed day.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedIndex = result.days.findIndex((day) => day.date === selectedDate);
  const selected = selectedIndex >= 0 ? result.days[selectedIndex] : lastObserved;

  if (!selected) {
    return (
      <section className={cn("border border-[#ded9cd] bg-white p-5", className)}>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#77736c]">{heading}</p>
        <p className="mt-2 text-sm text-[#625f58]">
          No dated observations yet. The ring needs at least one saved stage with a capture date.
        </p>
      </section>
    );
  }

  const currentIndex = result.days.indexOf(selected);
  const trail = result.days.slice(Math.max(0, currentIndex - TRAIL_DAYS), Math.max(0, currentIndex));
  const estrusWait = daysUntilStage(result, "Estrus");
  const ranked: ClassificationStage[] = CYCLE_ORDER.slice().sort(
    (a, b) => selected.stageMass[b] - selected.stageMass[a]
  );

  return (
    <section
      className={cn("border border-[#ded9cd] bg-white", compact ? "p-4" : "p-5 sm:p-6", className)}
      aria-labelledby={headingId}
      data-testid="cycle-phase-panel"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#77736c]">{heading}</p>
          <h2
            id={headingId}
            className={cn("mt-1 font-serif text-[#292b4c]", compact ? "text-xl" : "text-2xl")}
          >
            Where {subjectLabel} sits in the cycle
          </h2>
        </div>
        <p className="text-xs text-[#625f58]">
          {fit.fitted
            ? `Fitted cycle length ${fit.period.toFixed(2)} days from ${result.observedDays} observed days`
            : `Assumed ${result.period.toFixed(2)}-day cycle · ${result.observedDays} observed day${result.observedDays === 1 ? "" : "s"}, six needed to fit one`}
        </p>
      </div>

      <div
        className={cn(
          "mt-4 grid items-center gap-5",
          compact ? "sm:grid-cols-[auto_minmax(0,1fr)]" : "md:grid-cols-[auto_minmax(0,1fr)]"
        )}
      >
        <CycleRing
          day={selected}
          trail={trail}
          arcs={result.arcs}
          size={compact ? 232 : 284}
          reduceMotion={reduceMotion}
          label={`${subjectLabel} cycle phase`}
          className="justify-self-center"
        />

        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#77736c]">
            {format(new Date(`${selected.date}T00:00:00`), "EEEE, MMMM d")}
            {selected.forecast ? " · forecast" : selected.observed ? " · observed" : " · no photo, carried by the prior"}
          </p>
          <p className="mt-1 font-serif text-2xl text-[#292b4c]">{describePhase(selected)}</p>

          <dl className="mt-3 space-y-1.5" aria-label="Posterior mass by stage">
            {ranked.map((stage) => {
              const mass = selected.stageMass[stage];
              return (
                <div key={stage} className="grid grid-cols-[72px_minmax(0,1fr)_34px] items-center gap-2 text-[11px]">
                  <dt className={cn(stage === selected.likelyStage ? "font-bold text-[#292b4c]" : "text-[#625f58]")}>
                    {stage}
                  </dt>
                  <dd className="h-1.5 bg-[#ebe8f0]">
                    <span
                      className="block h-full"
                      style={{
                        width: `${mass * 100}%`,
                        backgroundColor: STAGE_VISUAL[stage].color,
                        transition: reduceMotion ? undefined : "width 320ms cubic-bezier(0.22,1,0.36,1)",
                      }}
                    />
                  </dd>
                  <dd className="text-right font-semibold tabular-nums text-[#292b4c]">
                    {Math.round(mass * 100)}%
                  </dd>
                </div>
              );
            })}
          </dl>

          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-[#ebe6dc] pt-3 text-xs">
            <dt className="text-[#625f58]">Commitment of this estimate</dt>
            <dd className="font-semibold tabular-nums text-[#292b4c]">{Math.round(selected.concentration * 100)}%</dd>
            <dt className="text-[#625f58]">Estrus expected</dt>
            <dd className="font-semibold text-[#292b4c]">
              {estrusWait === undefined
                ? "beyond the forecast"
                : estrusWait === 0
                  ? "now"
                  : `in ${estrusWait} day${estrusWait === 1 ? "" : "s"}`}
            </dd>
          </dl>
        </div>
      </div>

      <PhaseScrubber
        className="mt-4"
        days={result.days}
        selectedDate={selected.date}
        onSelect={setSelectedDate}
        reduceMotion={reduceMotion}
        label={`${subjectLabel} phase by day`}
      />

      <p className="mt-3 text-[10px] leading-4 text-[#77736c]">
        Phase is inferred from the saved stages, the order they must follow, and a
        {" "}{result.period.toFixed(1)}-day period; petal depth is posterior mass and the solid
        needle is how committed the estimate is. Days without a photo are carried by the
        prior, hatched days are forecasts, and the binary model&apos;s vote is tempered by
        whether the photograph was in its reference range. The saved stage remains the
        scientific record.
      </p>
    </section>
  );
}
