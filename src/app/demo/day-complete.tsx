"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  CircleAlert,
  Download,
  Info,
  Play,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ESTRUS_STAGES, type ClassificationStage } from "@/lib/classification";
import { CycleLegend, CycleStrip } from "@/components/prediction/cycle-strip";
import { CyclePhasePanel } from "@/components/prediction/cycle-phase-panel";
import type { PhaseObservation } from "@/lib/cycle-phase";
import { STAGE_VISUAL } from "@/lib/stage-palette";
import { cn } from "@/lib/utils";

type SavedStage = ClassificationStage | "Uncertain / transition";

export type CompletedDemoItem = {
  subject: string;
  strain: string;
  age: string;
  image: string;
  prediction: ClassificationStage;
  scores: Record<ClassificationStage, number>;
  finalStage?: SavedStage;
};

type HistoryRange = 7 | 14 | 28;

type HistoryPoint = {
  day: number;
  dateLabel: string;
  stage: ClassificationStage | null;
  value: number | null;
};

/**
 * Lane positions only. Colour comes from the validated palette in
 * src/lib/stage-palette.ts — this file used to carry a fourth, conflicting set.
 *
 * The order runs Diestrus, Proestrus, Estrus, Metestrus so the lanes stack in
 * the cycle's own sequence. It is a position on a loop, not a magnitude, which
 * is why nothing draws a line between the lanes.
 */
const STAGE_META: Record<ClassificationStage, { value: number }> = {
  Diestrus: { value: 1 },
  Proestrus: { value: 2 },
  Estrus: { value: 3 },
  Metestrus: { value: 4 },
};

const CYCLE_PATTERN: ClassificationStage[] = [
  "Diestrus",
  "Diestrus",
  "Proestrus",
  "Estrus",
  "Metestrus",
];

const GAPS: Record<string, number[]> = {
  "N-221": [6, 7, 13, 21],
  "N-222": [4, 12, 13, 20, 24],
  "N-223": [2, 9, 18, 19, 25],
  "N-224": [8, 14, 23],
  "N-225": [5, 11, 17],
  "N-226": [3, 10, 19, 24],
  "N-227": [7, 8, 15, 22, 23],
  "N-228": [4, 12, 20],
};

const RANGE_LABEL_DAYS: Record<HistoryRange, number[]> = {
  7: [22, 23, 24, 25, 26, 27, 28],
  14: [15, 17, 19, 21, 23, 25, 28],
  28: [1, 5, 10, 15, 20, 24, 28],
};

function historyFor(item: CompletedDemoItem, subjectIndex: number): HistoryPoint[] {
  return Array.from({ length: 28 }, (_, index) => {
    const day = index + 1;
    const missing = GAPS[item.subject]?.includes(day);
    const generatedStage = CYCLE_PATTERN[(day + subjectIndex * 2) % CYCLE_PATTERN.length];
    const savedStage =
      day === 28
        ? item.finalStage === "Uncertain / transition"
          ? null
          : item.finalStage ?? item.prediction
        : generatedStage;

    return {
      day,
      dateLabel: `Jul ${day}`,
      stage: missing && day !== 28 ? null : savedStage,
      value:
        missing && day !== 28
          ? null
          : savedStage
            ? STAGE_META[savedStage].value
            : null,
    };
  });
}

function pointsForStage(points: HistoryPoint[], stage: ClassificationStage) {
  return points.filter((point) => point.stage === stage);
}

function CompactSupportScores({
  item,
  reduceMotion,
}: {
  item: CompletedDemoItem;
  reduceMotion: boolean;
}) {
  return (
    <div className="mt-4 border-t border-[#d4d1e4] pt-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#625f58]">
        All four relative support scores
      </p>
      <div className="mt-2 space-y-1.5">
        {ESTRUS_STAGES.map((stage) => (
          <div key={stage} className="grid grid-cols-[62px_minmax(0,1fr)_28px] items-center gap-2 text-[10px]">
            <span className={cn(stage === item.prediction ? "font-bold text-[#292b4c]" : "text-[#625f58]")}>
              {stage}
            </span>
            <span className="h-1.5 bg-[#dedbe8]">
              <motion.span
                key={`${item.subject}-${stage}`}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${item.scores[stage] * 100}%` }}
                transition={{ duration: reduceMotion ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
                className="block h-full"
                style={{ backgroundColor: STAGE_VISUAL[stage].color }}
              />
            </span>
            <span className="text-right font-semibold tabular-nums text-[#292b4c]">
              {Math.round(item.scores[stage] * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpandedHistory({
  item,
  points,
  range,
  replayKey,
  reduceMotion,
}: {
  item: CompletedDemoItem;
  points: HistoryPoint[];
  range: HistoryRange;
  replayKey: number;
  reduceMotion: boolean;
}) {
  const visible = points.slice(-range);
  // The whole 28-day record feeds the phase model even when the chart shows a
  // shorter range: a cycle length cannot be fitted to a week. Today's four
  // relative support scores enter as the early-group share, the same half-ring
  // vote the public binary model casts on a real record.
  const phaseObservations = useMemo<PhaseObservation[]>(
    () =>
      points
        // A day with no saved stage is a gap for the prior to carry, not an
        // observation. Today is the exception when it was saved as uncertain:
        // a photo was taken, it just did not settle on a stage.
        .filter((point) => point.stage !== null || point.day === 28)
        .map((point) => ({
          date: `2026-07-${String(point.day).padStart(2, "0")}`,
          stage: point.stage,
          uncertain: point.day === 28 && item.finalStage === "Uncertain / transition",
          earlyGroupProbability:
            point.day === 28 ? item.scores.Proestrus + item.scores.Estrus : null,
          earlyGroupReferenceBacked: true,
        })),
    [points, item]
  );
  const aiProposal = [
    { day: 28, value: STAGE_META[item.prediction].value },
  ];
  const savedStage = item.finalStage ?? item.prediction;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.34, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden border-y border-[#c9c7e7] bg-[#f0eff9]"
      data-testid="expanded-cycle-history"
    >
      <div className="grid gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#454a9f]">
                {item.subject} · {item.strain} · {item.age}
              </p>
              <h3 className="mt-1 font-serif text-2xl text-[#292b4c]">Saved cycle trajectory</h3>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#625f58]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#292b4c]" />
                Scientist-saved stage
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-[#454a9f] bg-white" />
                Today&apos;s AI proposal
              </span>
            </div>
          </div>

          <div
            className="mt-3 h-44 min-w-[620px]"
            role="img"
            aria-label={`${item.subject} ${range}-day stage history. Today's AI proposal is ${item.prediction}; the scientist saved ${savedStage}.`}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={1}
              initialDimension={{ width: 800, height: 176 }}
            >
              <ComposedChart
                key={`${replayKey}-${range}-${item.subject}`}
                data={visible}
                margin={{ top: 8, right: 20, bottom: 4, left: 2 }}
                accessibilityLayer={false}
              >
                <CartesianGrid vertical={false} stroke="#e2dff0" />
                <XAxis
                  dataKey="day"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tick={{ fill: "#625f58", fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: "#c9c7d6" }}
                  tickFormatter={(day) => `${day}`}
                />
                <YAxis
                  domain={[0.7, 4.3]}
                  ticks={[1, 2, 3, 4]}
                  tick={{ fill: "#625f58", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tickFormatter={(value) =>
                    (Object.keys(STAGE_META) as ClassificationStage[]).find(
                      (stage) => STAGE_META[stage].value === value
                    ) ?? ""
                  }
                />
                <Tooltip
                  filterNull={false}
                  cursor={{ stroke: "#8f91bd", strokeDasharray: "3 3" }}
                  content={({ active, label }) => {
                    if (!active) return null;
                    const point = visible.find((candidate) => candidate.day === Number(label));
                    if (!point) return null;
                    return (
                      <div className="border border-[#b9b6d4] bg-white px-3 py-2 text-xs shadow-sm">
                        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#625f58]">
                          {point.dateLabel}
                        </p>
                        <p className="mt-1 font-semibold text-[#292b4c]">
                          {point.stage ?? "No observation"}
                        </p>
                      </div>
                    );
                  }}
                />
                {/* Lanes, not a line. The stages are named states in a loop, so
                    a connecting line both invented values between them and made
                    the wrap from the last stage back to the first read as a
                    full-height plunge. The band behind each lane carries the
                    category; the dots carry the days. */}
                {(Object.keys(STAGE_META) as ClassificationStage[]).map((stage) => (
                  <ReferenceArea
                    key={`lane-${stage}`}
                    y1={STAGE_META[stage].value - 0.42}
                    y2={STAGE_META[stage].value + 0.42}
                    fill={STAGE_VISUAL[stage].tint}
                    fillOpacity={0.55}
                    stroke="none"
                    ifOverflow="extendDomain"
                  />
                ))}
                {(Object.keys(STAGE_META) as ClassificationStage[]).map((stage, stageIndex) => (
                  <Scatter
                    key={stage}
                    data={pointsForStage(visible, stage)}
                    dataKey="value"
                    fill={STAGE_VISUAL[stage].color}
                    shape="circle"
                    isAnimationActive={!reduceMotion}
                    animationBegin={stageIndex * 90}
                    animationDuration={750}
                  />
                ))}
                <Scatter
                  data={aiProposal}
                  dataKey="value"
                  fill="#ffffff"
                  stroke="#454a9f"
                  strokeWidth={3}
                  isAnimationActive={!reduceMotion}
                  animationBegin={900}
                  animationDuration={500}
                />
                <ReferenceLine
                  x={28}
                  label={{ value: "TODAY", fill: "#454a9f", fontSize: 9, position: "top" }}
                  stroke="#454a9f"
                  strokeWidth={1.4}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[10px] leading-4 text-[#625f58]">
            Vertical position follows cyclic stage order; distance is not a biological measurement.
          </p>
        </div>

        <div className="border-t border-[#d4d1e4] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <div className="grid grid-cols-[58px_minmax(0,1fr)] gap-3">
            <div className="relative h-[76px] overflow-hidden border border-[#d4d1e4] bg-[#e9e5dd]">
              <Image
                src={item.image}
                alt={`Prepared observation for ${item.subject}`}
                fill
                sizes="58px"
                className="object-cover"
              />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#625f58]">
                Today&apos;s evidence
              </p>
              <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[11px]">
                <dt className="text-[#625f58]">AI proposal</dt>
                <dd className="font-semibold text-[#454a9f]">{item.prediction}</dd>
                <dt className="text-[#625f58]">Saved decision</dt>
                <dd className="font-semibold text-[#292b4c]">{savedStage}</dd>
              </dl>
            </div>
          </div>
          <CompactSupportScores item={item} reduceMotion={reduceMotion} />
        </div>
      </div>
      <div className="border-t border-[#c9c7e7] px-4 pb-5 pt-4">
        <CyclePhasePanel
          compact
          observations={phaseObservations}
          subjectLabel={item.subject}
          heading="Inferred cycle phase"
          reduceMotion={reduceMotion}
        />
      </div>
    </motion.div>
  );
}

function TodayDistribution({
  items,
  reduceMotion,
  replayKey,
  coverage,
}: {
  items: CompletedDemoItem[];
  reduceMotion: boolean;
  replayKey: number;
  coverage: { observed: number; total: number; percent: number; range: HistoryRange };
}) {
  const counts = useMemo(() => {
    const result: Record<ClassificationStage, number> = {
      Diestrus: 0,
      Proestrus: 0,
      Estrus: 0,
      Metestrus: 0,
    };
    items.forEach((item) => {
      const stage = item.finalStage ?? item.prediction;
      if (stage !== "Uncertain / transition") result[stage] += 1;
    });
    return result;
  }, [items]);
  const distribution = [{ name: "Today", ...counts }];

  return (
    <section aria-labelledby="today-distribution-title">
      <p id="today-distribution-title" className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#625f58]">
        At a glance
      </p>
      <h2 className="mt-1 font-serif text-2xl text-[#292b4c]">Today&apos;s saved stages</h2>
      <div className="mt-4 h-12" role="img" aria-label="Today's saved stage distribution">
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={1}
          initialDimension={{ width: 320, height: 48 }}
        >
          <BarChart
            key={replayKey}
            data={distribution}
            layout="vertical"
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            accessibilityLayer={false}
          >
            <XAxis type="number" hide domain={[0, 7]} />
            <YAxis type="category" dataKey="name" hide />
            {(Object.keys(STAGE_META) as ClassificationStage[]).map((stage) => (
              <Bar
                key={stage}
                dataKey={stage}
                stackId="stages"
                fill={STAGE_VISUAL[stage].color}
                isAnimationActive={!reduceMotion}
                animationDuration={900}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-4 space-y-2" aria-label="Saved stage counts">
        {(Object.keys(STAGE_META) as ClassificationStage[]).map((stage) => (
          <li key={stage} className="grid grid-cols-[14px_1fr_auto] items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STAGE_VISUAL[stage].color }} />
            <span className="text-[#625f58]">{stage}</span>
            <span className="font-semibold tabular-nums text-[#292b4c]">
              {counts[stage]}{" "}
              <span className="font-normal text-[#625f58]">
                ({((counts[stage] / items.length) * 100).toFixed(counts[stage] % 2 === 0 ? 0 : 1)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-5 text-[#625f58]">Seven exact stages · one uncertain transition retained separately.</p>
      <dl className="mt-4 grid grid-cols-[1fr_auto] border-t border-[#ded9cd] pt-4 text-xs">
        <dt className="text-[#625f58]">{coverage.range}-day history coverage</dt>
        <dd className="font-semibold tabular-nums text-[#292b4c]">{coverage.percent.toFixed(1)}%</dd>
        <dt className="mt-1 text-[10px] text-[#625f58]">Observed records</dt>
        <dd className="mt-1 text-[10px] tabular-nums text-[#625f58]">
          {coverage.observed} / {coverage.total}
        </dd>
      </dl>
    </section>
  );
}

export function DayComplete({
  items,
  onOpenRecords,
  onExport,
}: {
  items: CompletedDemoItem[];
  onOpenRecords: () => void;
  onExport: () => void;
}) {
  const reduceMotion = Boolean(useReducedMotion());
  const [range, setRange] = useState<HistoryRange>(14);
  const [selectedSubject, setSelectedSubject] = useState("N-225");
  const [replayKey, setReplayKey] = useState(0);
  const [replaying, setReplaying] = useState(false);

  const histories = useMemo(
    () =>
      Object.fromEntries(
        items.map((item, index) => [item.subject, historyFor(item, index)])
      ) as Record<string, HistoryPoint[]>,
    [items]
  );
  const corrections = items.filter(
    (item) =>
      item.finalStage &&
      item.finalStage !== "Uncertain / transition" &&
      item.finalStage !== item.prediction
  ).length;
  const uncertain = items.filter((item) => item.finalStage === "Uncertain / transition").length;
  const coverage = useMemo(() => {
    const visiblePoints = Object.values(histories).flatMap((points) => points.slice(-range));
    const observed = visiblePoints.filter((point) => point.stage !== null).length;
    return {
      observed,
      total: visiblePoints.length,
      percent: (observed / visiblePoints.length) * 100,
      range,
    };
  }, [histories, range]);

  function replay() {
    setReplayKey((value) => value + 1);
    setReplaying(true);
    window.setTimeout(() => setReplaying(false), reduceMotion ? 150 : 1500);
  }

  return (
    <motion.main
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.45 }}
      className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-12"
    >
      <div className="grid border-b border-[#d9d4c8] xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="pb-6 xl:border-r xl:border-[#ded9cd] xl:pr-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#625f58]">
            North colony · July 28, 2026
          </p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight text-[#292b4c] sm:text-5xl">
            Morning review complete
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#625f58]">
            All eight photographs were reviewed. AI proposals, exceptions, and scientist decisions are now part of the longitudinal record.
          </p>

          <dl className="mt-6 grid max-w-3xl grid-cols-2 border-y border-[#ded9cd] sm:grid-cols-4">
            {[
              ["Photographs reviewed", "8 / 8"],
              ["Correction made", String(corrections)],
              ["Uncertain transition", String(uncertain)],
              ["Records updated", "100%"],
            ].map(([label, value], index) => (
              <motion.div
                key={label}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduceMotion ? 0 : index * 0.08 }}
                className={cn(
                  "py-4 pr-4",
                  index % 2 === 1 && "border-l border-[#ded9cd] pl-4",
                  index > 1 && "border-t border-[#ded9cd] sm:border-t-0",
                  index > 0 && "sm:border-l sm:pl-4"
                )}
              >
                <dd className="font-serif text-2xl text-[#292b4c]">{value}</dd>
                <dt className="mt-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[#625f58]">{label}</dt>
              </motion.div>
            ))}
          </dl>
        </section>
        <aside
          aria-label="Completed review summary"
          className="border-t border-[#ded9cd] py-6 xl:border-t-0 xl:pl-8"
        >
          <TodayDistribution
            items={items}
            reduceMotion={reduceMotion}
            replayKey={replayKey}
            coverage={coverage}
          />
        </aside>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 py-6 xl:border-r xl:border-[#ded9cd] xl:pr-8" aria-labelledby="cycle-history-title">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#625f58]">Illustrative demo history</p>
              <h2 id="cycle-history-title" className="mt-1 font-serif text-3xl text-[#292b4c]">Cycle history</h2>
              <p className="mt-1 text-xs leading-5 text-[#625f58]">
                Gaps remain visible. Today&apos;s AI proposal is preserved separately from the saved decision.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex border border-[#a8a5c7]" aria-label="History range">
                {([7, 14, 28] as HistoryRange[]).map((days) => (
                  <button
                    key={days}
                    type="button"
                    aria-pressed={range === days}
                    onClick={() => setRange(days)}
                    className={cn(
                      "min-h-9 border-r border-[#a8a5c7] px-4 text-xs font-semibold last:border-r-0",
                      range === days ? "bg-[#292f68] text-white" : "bg-white text-[#454a9f] hover:bg-[#eeedf9]"
                    )}
                  >
                    {days} days
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={replay}
                className="inline-flex min-h-9 items-center gap-2 px-2 text-xs font-semibold text-[#454a9f] hover:text-[#292f68]"
              >
                {replaying ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {replaying ? "Replaying…" : "Replay cycle"}
              </button>
            </div>
          </div>

          <p className="sr-only" role="status" aria-live="polite">
            {replaying ? `Replaying the last ${range} days of observations.` : ""}
          </p>

          <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#625f58] lg:hidden">
            Swipe the timeline for earlier and later days
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </p>

          <div
            className="mt-3 overflow-x-auto border-y border-[#ded9cd] bg-white sm:mt-5"
            role="region"
            aria-label="Scrollable cycle histories"
            tabIndex={0}
          >
            <div className="min-w-[780px]">
              <div className="grid grid-cols-[150px_minmax(620px,1fr)] items-end border-b border-[#ded9cd] bg-[#fbfaf7] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.13em] text-[#625f58]">
                <span>Mouse</span>
                <div className="grid grid-cols-7 text-center">
                  {RANGE_LABEL_DAYS[range].map((day) => {
                    return <span key={day}>{day === 28 ? "Today 28" : `Jul ${day}`}</span>;
                  })}
                </div>
              </div>

              {items.map((item) => {
                const selected = item.subject === selectedSubject;
                const points = histories[item.subject].slice(-range);
                return (
                  <div key={item.subject}>
                    <button
                      type="button"
                      onClick={() => setSelectedSubject(item.subject)}
                      aria-expanded={selected}
                      aria-controls={`history-${item.subject}`}
                      className={cn(
                        "grid w-full grid-cols-[150px_minmax(620px,1fr)] items-center border-b border-[#ebe6dc] px-3 text-left last:border-b-0",
                        selected ? "bg-[#f0eff9]" : "bg-white hover:bg-[#fbfaf7]"
                      )}
                    >
                      <span className="flex items-center gap-3 py-2">
                        <span className="relative h-9 w-9 shrink-0 overflow-hidden border border-[#ded9cd] bg-[#e9e5dd]">
                          <Image src={item.image} alt="" fill sizes="36px" className="object-cover" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-[#292b4c]">{item.subject}</span>
                          <span className="block text-[10px] text-[#625f58]">
                            {item.finalStage ?? item.prediction}
                          </span>
                        </span>
                      </span>
                      <CycleStrip
                        key={`${item.subject}-${range}-${replayKey}`}
                        points={points}
                        label={`${item.subject} cycle history`}
                        reduceMotion={reduceMotion}
                        todayDay={28}
                        className="py-2"
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {selected && (
                        <div id={`history-${item.subject}`}>
                          <ExpandedHistory
                            item={item}
                            points={histories[item.subject]}
                            range={range}
                            replayKey={replayKey}
                            reduceMotion={reduceMotion}
                          />
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Cycle history legend">
            <CycleLegend />
            <span className="inline-flex items-center gap-1.5 text-xs text-[#625f58]">
              <CircleAlert className="h-3.5 w-3.5 text-[#454a9f]" />Uncertain transition
            </span>
          </div>
        </section>

        <aside
          aria-label="Review insights and actions"
          className="space-y-7 border-t border-[#ded9cd] py-6 xl:border-t-0 xl:pl-8"
        >
          <section className="border-t border-[#ded9cd] pt-6" aria-labelledby="key-insights-title">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#625f58]">Key insights</p>
            <h2 id="key-insights-title" className="sr-only">Key insights</h2>
            <div className="mt-4 space-y-5">
              <div className="grid grid-cols-[28px_1fr] gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e4efe1] text-[#4c7b43]">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <p className="text-sm leading-6 text-[#625f58]">
                  <strong className="font-semibold text-[#292b4c]">2 mice</strong> are expected to enter Estrus in the next 48 hours.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubject("N-225")}
                className="grid w-full grid-cols-[28px_1fr] gap-3 text-left"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eeedf9] text-[#454a9f]">
                  <Info className="h-4 w-4" />
                </span>
                <p className="text-sm leading-6 text-[#625f58]">
                  <strong className="font-semibold text-[#292b4c]">N-225 corrected</strong> from Estrus to Proestrus.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setSelectedSubject("N-227")}
                className="grid w-full grid-cols-[28px_1fr] gap-3 text-left"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e7eef7] text-[#527daf]">
                  <CalendarClock className="h-4 w-4" />
                </span>
                <p className="text-sm leading-6 text-[#625f58]">
                  <strong className="font-semibold text-[#292b4c]">N-227 is uncertain.</strong> Re-image tomorrow.
                </p>
              </button>
            </div>
          </section>

          <div className="space-y-2 border-t border-[#ded9cd] pt-6">
            <button
              type="button"
              onClick={onOpenRecords}
              className="inline-flex min-h-12 w-full items-center justify-between bg-[#292f68] px-5 text-sm font-semibold text-white hover:bg-[#202657]"
            >
              Open saved records <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onExport}
              className="inline-flex min-h-11 w-full items-center justify-between border border-[#8e91bd] bg-white px-5 text-sm font-semibold text-[#353a87] hover:bg-[#eeedf9]"
            >
              Export review receipt <Download className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-3 border-t border-[#ded9cd] pt-5 text-xs leading-5 text-[#625f58]">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#454a9f]" />
            <p>Replay animates the selected history and today&apos;s distribution. Reduced-motion preferences are respected.</p>
          </div>
        </aside>
      </div>

      <section className="border-t border-[#ded9cd] py-4 text-[10px] leading-5 text-[#625f58]" aria-label="Record provenance">
        <span className="font-bold uppercase tracking-[0.15em] text-[#45413c]">Provenance:</span>{" "}
        AI proposal · all four relative support scores · prepared crop · scientist decision · timestamp · reviewer retained.
        <span className="ml-2 font-semibold text-[#292b4c]">The scientist-saved decision is authoritative.</span>
      </section>
    </motion.main>
  );
}
