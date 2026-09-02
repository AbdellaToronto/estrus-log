"use client";

/**
 * The cycle as a ring, with one day's phase posterior drawn on it.
 *
 * The strip shows the record as it was saved: one named state per day. This
 * shows what the record implies: a distribution over where in the loop the
 * animal is. Four things carry the meaning, and none of them is a bar chart
 * bent into a circle.
 *
 *   - The band is the cycle itself, divided into stage arcs pro rata by how
 *     long each stage lasts. Phase zero, the start of Proestrus, sits at twelve
 *     o'clock and the cycle runs clockwise.
 *   - The petals inside the band are the posterior, one per phase bin. Their
 *     depth is probability mass. A committed day is one long petal; a day the
 *     record cannot pin down is a fringe all the way round.
 *   - The needle points at the posterior's circular mean. Only the solid part
 *     of its length is "real": it is the resultant length, one for a point
 *     mass and zero for a flat ring. A short needle is the honest answer.
 *   - The trail is the last few days' means on the band, fading backwards, so
 *     progress around the loop is visible without a line that invents values.
 */

import { useState } from "react";
import { format } from "date-fns";
import type { ClassificationStage } from "@/lib/classification";
import { describePhase, type PhaseDay, type StageArc } from "@/lib/cycle-phase";
import { STAGE_VISUAL } from "@/lib/stage-palette";
import { cn } from "@/lib/utils";

const TAU = Math.PI * 2;
/** Horizontal room outside the ring for the arc labels, which would otherwise clip. */
const LABEL_GUTTER = 58;
const INK = "#292b4c";
const MUTED = "#625f58";

function polar(cx: number, cy: number, radius: number, phase: number): [number, number] {
  const angle = phase * TAU - TAU / 4;
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

/** Annular sector between two radii from `start` to `end`, in turns, clockwise. */
function sectorPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  start: number,
  end: number
): string {
  const [ox1, oy1] = polar(cx, cy, outer, start);
  const [ox2, oy2] = polar(cx, cy, outer, end);
  const [ix1, iy1] = polar(cx, cy, inner, start);
  const [ix2, iy2] = polar(cx, cy, inner, end);
  const large = end - start > 0.5 ? 1 : 0;
  return [
    `M ${ox1.toFixed(2)} ${oy1.toFixed(2)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)}`,
    `L ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
    "Z",
  ].join(" ");
}

/** Arc along one radius from phase `from` forward to phase `to`. */
function ringArcPath(cx: number, cy: number, radius: number, from: number, to: number): string {
  const forward = (((to - from) % 1) + 1) % 1;
  const [x1, y1] = polar(cx, cy, radius, from);
  const [x2, y2] = polar(cx, cy, radius, from + forward);
  const large = forward > 0.5 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function stageForPhase(arcs: StageArc[], phase: number): ClassificationStage {
  const wrapped = ((phase % 1) + 1) % 1;
  return (arcs.find((arc) => wrapped >= arc.start && wrapped < arc.end) ?? arcs[arcs.length - 1]).stage;
}

/**
 * Rotating the needle the short way round. A phase that steps from 0.98 to
 * 0.02 has moved forward a little, not backwards a whole turn, so the angle
 * handed to CSS is unwrapped against the previous one.
 */
function useUnwrappedTurns(phase: number): number {
  const [tracked, setTracked] = useState({ phase, turns: phase });
  if (tracked.phase !== phase) {
    const delta = phase - tracked.phase;
    const shortest = delta - Math.round(delta);
    setTracked({ phase, turns: tracked.turns + shortest });
  }
  return tracked.turns;
}

export function CycleRing({
  day,
  trail = [],
  arcs,
  size = 280,
  reduceMotion = false,
  label,
  className,
}: {
  /** The day whose posterior is drawn. */
  day: PhaseDay;
  /** Earlier days, oldest first, whose means are marked on the band. */
  trail?: PhaseDay[];
  arcs: StageArc[];
  size?: number;
  reduceMotion?: boolean;
  label: string;
  className?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const width = size + LABEL_GUTTER * 2;
  const labelRadius = size / 2 - 8;
  const bandOuter = size / 2 - 24;
  const bandInner = bandOuter - 11;
  const bandMid = (bandOuter + bandInner) / 2;
  const petalOuter = bandInner - 4;
  const petalDepth = petalOuter * 0.52;
  const bins = day.posterior.length;
  const peak = Math.max(...day.posterior, 1e-9);
  const needleTurns = useUnwrappedTurns(day.meanPhase);
  const transition = reduceMotion ? undefined : "transform 320ms cubic-bezier(0.22,1,0.36,1)";
  const description = describePhase(day);
  const dateLabel = format(new Date(`${day.date}T00:00:00`), "MMM d");

  return (
    <div className={cn("relative shrink-0", className)} style={{ width, height: size }}>
      <svg
        width={width}
        height={size}
        viewBox={`${-LABEL_GUTTER} 0 ${width} ${size}`}
        overflow="visible"
        role="img"
        aria-label={`${label}: ${dateLabel}, ${description}. ${Math.round(day.concentration * 100)}% committed.`}
      >
        {/* The cycle band: stage arcs, pro rata by duration. */}
        {arcs.map((arc) => (
          <path
            key={arc.stage}
            d={sectorPath(cx, cy, bandOuter, bandInner, arc.start, arc.end)}
            fill={STAGE_VISUAL[arc.stage].tint}
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        ))}
        {/* Arc labels outside the band. Text anchors follow which side of the
            ring they fall on so no word runs back across the drawing. */}
        {arcs.map((arc) => {
          const mid = (arc.start + arc.end) / 2;
          const [x, y] = polar(cx, cy, labelRadius, mid);
          const horizontal = Math.cos(mid * TAU - TAU / 4);
          const anchor = horizontal > 0.35 ? "start" : horizontal < -0.35 ? "end" : "middle";
          const vertical = Math.sin(mid * TAU - TAU / 4);
          const baseline = vertical > 0.35 ? "hanging" : vertical < -0.35 ? "auto" : "middle";
          return (
            <text
              key={`label-${arc.stage}`}
              x={x}
              y={y}
              textAnchor={anchor}
              dominantBaseline={baseline}
              fontSize={10}
              fontWeight={700}
              letterSpacing="0.08em"
              fill={STAGE_VISUAL[arc.stage].color}
            >
              {arc.stage.toUpperCase()}
            </text>
          );
        })}

        {/* The posterior: one petal per bin, depth is probability mass. */}
        <g
          key={day.date}
          style={
            reduceMotion
              ? undefined
              : { animation: "cycle-ring-in 260ms cubic-bezier(0.22,1,0.36,1) both" }
          }
        >
          {day.posterior.map((mass, bin) => {
            const depth = (mass / peak) * petalDepth;
            if (depth < 0.4) return null;
            const start = bin / bins;
            const end = (bin + 1) / bins + 0.0008;
            const stage = stageForPhase(arcs, (bin + 0.5) / bins);
            return (
              <path
                key={bin}
                d={sectorPath(cx, cy, petalOuter, petalOuter - depth, start, end)}
                fill={STAGE_VISUAL[stage].color}
                fillOpacity={day.forecast ? 0.55 : 0.88}
              />
            );
          })}
        </g>

        {/* Trail of earlier days along the band, fading backwards. */}
        {trail.map((earlier, index) => {
          const next = trail[index + 1] ?? day;
          const age = trail.length - index;
          const opacity = Math.max(0.18, 0.85 - age * 0.14);
          const [x, y] = polar(cx, cy, bandMid, earlier.meanPhase);
          return (
            <g key={earlier.date} opacity={opacity}>
              <path
                d={ringArcPath(cx, cy, bandMid, earlier.meanPhase, next.meanPhase)}
                fill="none"
                stroke={INK}
                strokeWidth={1.4}
                strokeLinecap="round"
              />
              <circle cx={x} cy={y} r={2.6} fill="#ffffff" stroke={INK} strokeWidth={1.4} />
            </g>
          );
        })}

        {/* Needle: direction is the circular mean, solid length is the
            resultant length. It rotates the short way round. */}
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transform: `rotate(${needleTurns * 360}deg)`,
            transition,
          }}
        >
          <line
            x1={cx}
            y1={cy}
            x2={cx}
            y2={cy - petalOuter}
            stroke={INK}
            strokeWidth={1}
            strokeDasharray="2 3"
            opacity={0.35}
          />
          <line
            x1={cx}
            y1={cy}
            x2={cx}
            y2={cy - petalOuter * day.concentration}
            stroke={INK}
            strokeWidth={2.2}
            strokeLinecap="round"
            style={{ transition: reduceMotion ? undefined : "y2 320ms ease-out" }}
          />
          <circle
            cx={cx}
            cy={cy - bandMid}
            r={4.2}
            fill={day.forecast ? "#ffffff" : INK}
            stroke={INK}
            strokeWidth={1.8}
          />
        </g>
        <circle cx={cx} cy={cy} r={3} fill={INK} />
      </svg>

      {/* Readout in the clear centre. HTML so the description can wrap. */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
        style={{ padding: petalOuter - petalDepth + 12 }}
        aria-hidden="true"
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>
          {dateLabel}
          {day.forecast ? " · forecast" : day.observed ? "" : " · no photo"}
        </p>
        <p className="mt-0.5 font-serif text-[17px] leading-5" style={{ color: INK }}>
          {day.likelyStage}
        </p>
        <p className="mt-0.5 text-[10px] leading-3.5" style={{ color: MUTED }}>
          {description}
        </p>
      </div>
    </div>
  );
}

/**
 * One cell per day, coloured by the most likely stage and faded by how
 * committed the posterior is. Days the model filled without a photo keep a
 * dashed edge; forecast days are hatched. Hover, focus, or click selects.
 */
export function PhaseScrubber({
  days,
  selectedDate,
  onSelect,
  reduceMotion = false,
  label,
  className,
}: {
  days: PhaseDay[];
  selectedDate: string;
  onSelect: (date: string) => void;
  reduceMotion?: boolean;
  label: string;
  className?: string;
}) {
  const [pinned, setPinned] = useState<string | null>(null);
  const first = days[0];
  const last = days[days.length - 1];

  return (
    <div className={cn("relative", className)}>
      <div
        role="group"
        aria-label={label}
        className="flex w-full gap-[2px]"
        onMouseLeave={() => {
          if (pinned) onSelect(pinned);
        }}
      >
        {days.map((day, index) => {
          const visual = STAGE_VISUAL[day.likelyStage];
          const alpha = 0.3 + 0.7 * day.concentration;
          const selected = day.date === selectedDate;
          const background = day.forecast
            ? `repeating-linear-gradient(135deg, ${visual.color} 0 3px, transparent 3px 6px)`
            : undefined;
          return (
            <button
              key={day.date}
              type="button"
              aria-pressed={selected}
              aria-label={`${format(new Date(`${day.date}T00:00:00`), "MMM d")}: ${describePhase(day)}${day.forecast ? " (forecast)" : day.observed ? "" : " (no photo)"}`}
              onMouseEnter={() => onSelect(day.date)}
              onFocus={() => onSelect(day.date)}
              onClick={() => {
                setPinned(day.date);
                onSelect(day.date);
              }}
              className={cn(
                "relative h-8 min-w-0 flex-1 overflow-hidden outline-none",
                !day.observed && !day.forecast && "border border-dashed border-[#b9b5a8]",
                selected && "ring-2 ring-[#292b4c] ring-offset-1"
              )}
              style={{
                backgroundColor: day.forecast ? undefined : visual.color,
                backgroundImage: background,
                opacity: alpha,
                animation: reduceMotion
                  ? undefined
                  : "cycle-cell-in 320ms cubic-bezier(0.22,1,0.36,1) both",
                animationDelay: reduceMotion ? undefined : `${Math.min(index * 22, 800)}ms`,
              }}
            >
              {day.observed && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90">
                  {visual.short}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {first && last && (
        <div className="mt-1 flex justify-between text-[10px] tabular-nums" style={{ color: MUTED }}>
          <span>{format(new Date(`${first.date}T00:00:00`), "MMM d")}</span>
          <span>{format(new Date(`${last.date}T00:00:00`), "MMM d")}</span>
        </div>
      )}
    </div>
  );
}
