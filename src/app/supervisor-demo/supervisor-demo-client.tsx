"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  RotateCcw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EstrusIcon } from "@/components/estrus-icon";
import { cn } from "@/lib/utils";

type JourneyView = "brief" | "review" | "outcome";
type Stage = "Proestrus" | "Estrus" | "Metestrus" | "Diestrus" | "Uncertain / transition";
type Lead = "Early group" | "Late group" | "No model lead";

type ReviewItem = {
  id: string;
  subject: string;
  strain: string;
  age: string;
  image: string;
  filename: string;
  lead: Lead;
  leadConfidence?: number;
  lastStage: Stage;
  lastObserved: string;
  cycleDay: number;
  note: string;
  stage?: Stage;
  confirmed: boolean;
};

const STAGES: Stage[] = [
  "Proestrus",
  "Estrus",
  "Metestrus",
  "Diestrus",
  "Uncertain / transition",
];

const STARTING_ITEMS: ReviewItem[] = [
  {
    id: "demo-221",
    subject: "N-221",
    strain: "BALB/c",
    age: "14 weeks",
    image: "/assets/demo/s-biad2395/n-221.png",
    filename: "S-BIAD2395 · estrus (139)",
    lead: "Early group",
    leadConfidence: 0.91,
    lastStage: "Proestrus",
    lastObserved: "Yesterday · 09:08",
    cycleDay: 2,
    note: "No handling concerns recorded.",
    stage: "Estrus",
    confirmed: true,
  },
  {
    id: "demo-222",
    subject: "N-222",
    strain: "BALB/c",
    age: "14 weeks",
    image: "/assets/demo/s-biad2395/n-222.png",
    filename: "S-BIAD2395 · proestrus (118)",
    lead: "Early group",
    leadConfidence: 0.87,
    lastStage: "Diestrus",
    lastObserved: "Yesterday · 09:16",
    cycleDay: 1,
    note: "Paired cytology reference available.",
    stage: "Proestrus",
    confirmed: true,
  },
  {
    id: "demo-223",
    subject: "N-223",
    strain: "BALB/c",
    age: "15 weeks",
    image: "/assets/demo/s-biad2395/n-223.png",
    filename: "S-BIAD2395 · metestrus (106)",
    lead: "Late group",
    leadConfidence: 0.84,
    lastStage: "Estrus",
    lastObserved: "2 days ago · 09:24",
    cycleDay: 3,
    note: "Due first: two days since the last external observation.",
    confirmed: false,
  },
  {
    id: "demo-224",
    subject: "N-224",
    strain: "BALB/c",
    age: "15 weeks",
    image: "/assets/demo/s-biad2395/n-224.png",
    filename: "S-BIAD2395 · diestrus (135)",
    lead: "Late group",
    leadConfidence: 0.93,
    lastStage: "Metestrus",
    lastObserved: "Yesterday · 09:31",
    cycleDay: 4,
    note: "Weight and welfare checks are current.",
    confirmed: false,
  },
  {
    id: "demo-225",
    subject: "N-225",
    strain: "BALB/c",
    age: "14 weeks",
    image: "/assets/demo/s-biad2395/n-225.png",
    filename: "S-BIAD2395 · estrus (155)",
    lead: "No model lead",
    lastStage: "Proestrus",
    lastObserved: "Yesterday · 09:37",
    cycleDay: 2,
    note: "Image quality guardrail abstained; scientist review required.",
    confirmed: false,
  },
  {
    id: "demo-226",
    subject: "N-226",
    strain: "BALB/c",
    age: "14 weeks",
    image: "/assets/demo/s-biad2395/n-226.png",
    filename: "S-BIAD2395 · metestrus (145)",
    lead: "Late group",
    leadConfidence: 0.82,
    lastStage: "Estrus",
    lastObserved: "Yesterday · 09:43",
    cycleDay: 3,
    note: "No handling concerns recorded.",
    confirmed: false,
  },
  {
    id: "demo-227",
    subject: "N-227",
    strain: "C57BL/6J",
    age: "16 weeks",
    image: "/assets/demo/s-biad2395/n-227.png",
    filename: "S-BIAD2395 · proestrus (174)",
    lead: "Early group",
    leadConfidence: 0.79,
    lastStage: "Diestrus",
    lastObserved: "Yesterday · 09:51",
    cycleDay: 1,
    note: "Public white-mouse reference image; demo subject metadata is illustrative.",
    confirmed: false,
  },
  {
    id: "demo-228",
    subject: "N-228",
    strain: "C57BL/6J",
    age: "16 weeks",
    image: "/assets/demo/s-biad2395/n-228.png",
    filename: "S-BIAD2395 · diestrus (177)",
    lead: "Late group",
    leadConfidence: 0.89,
    lastStage: "Metestrus",
    lastObserved: "Yesterday · 10:02",
    cycleDay: 4,
    note: "Last subject in the prepared review queue.",
    confirmed: false,
  },
];

const STAGE_STYLES: Record<Stage, string> = {
  Proestrus: "border-violet-300 bg-violet-50 text-violet-900",
  Estrus: "border-rose-300 bg-rose-50 text-rose-900",
  Metestrus: "border-amber-300 bg-amber-50 text-amber-950",
  Diestrus: "border-sky-300 bg-sky-50 text-sky-900",
  "Uncertain / transition": "border-slate-300 bg-slate-50 text-slate-700",
};

const STAGE_DOT_STYLES: Record<Stage, string> = {
  Proestrus: "bg-violet-500",
  Estrus: "bg-rose-500",
  Metestrus: "bg-amber-500",
  Diestrus: "bg-sky-500",
  "Uncertain / transition": "bg-slate-400",
};

const DISTRIBUTION = [
  { stage: "Proestrus", observations: 28, fill: "#8b5cf6" },
  { stage: "Estrus", observations: 31, fill: "#e85d75" },
  { stage: "Metestrus", observations: 25, fill: "#d99a2b" },
  { stage: "Diestrus", observations: 35, fill: "#3b9dc5" },
  { stage: "Transition", observations: 8, fill: "#8b909d" },
];

const ATLAS_SUBJECTS = [
  "N-221", "N-222", "N-223", "N-224", "N-225", "N-226",
  "N-227", "N-228", "N-229", "N-230", "N-231", "N-232",
];

const ATLAS_STAGES: Stage[] = ["Diestrus", "Proestrus", "Estrus", "Metestrus"];

function stageForCell(subjectIndex: number, dayIndex: number): Stage {
  if ((subjectIndex * 5 + dayIndex * 3) % 29 === 0) return "Uncertain / transition";
  return ATLAS_STAGES[(Math.floor(subjectIndex / 2) + Math.floor(dayIndex / 2)) % ATLAS_STAGES.length];
}

function JourneyRail({
  view,
  complete,
  onNavigate,
}: {
  view: JourneyView;
  complete: boolean;
  onNavigate: (view: JourneyView) => void;
}) {
  const currentIndex = view === "brief" ? 0 : view === "review" ? 1 : 2;
  const steps = [
    { label: "Prepare", caption: "Daily brief", target: "brief" as JourneyView },
    { label: "Review", caption: "8 photographs", target: "review" as JourneyView },
    { label: "Outcome", caption: "Confirmed session receipt", target: "outcome" as JourneyView, disabled: !complete },
  ];

  return (
    <nav aria-label="Demo journey" className="border-y border-[#ded9cd] bg-[#fbfaf7]">
      <ol className="mx-auto grid max-w-[1500px] grid-cols-3 px-4 sm:px-8 lg:px-12">
        {steps.map((step, index) => {
          const active = view === step.target;
          const reached = index <= currentIndex;
          return (
            <li key={step.label} className="border-[#ded9cd] sm:border-r sm:last:border-r-0">
              <button
                type="button"
                onClick={() => onNavigate(step.target)}
                disabled={step.disabled}
                className={cn(
                  "flex w-full items-center gap-3 px-2 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55 sm:px-4",
                  active ? "bg-[#eeedf9]" : "hover:bg-[#f4f1ea]"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    reached ? "border-[#454a9f] bg-[#454a9f] text-white" : "border-[#cfc9bd] text-[#77736c]"
                  )}
                >
                  {index < currentIndex ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                </span>
                <span>
                  <span className="block text-xs font-semibold text-[#30345f]">{step.label}</span>
                  <span className="hidden text-[10px] text-[#77736c] lg:block">{step.caption}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function DemoHeader({ confirmedCount }: { confirmedCount: number }) {
  return (
    <header className="border-b border-[#ded9cd] bg-[#f7f4ed]">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <EstrusIcon name="cycle" className="h-10 w-10" />
          <div>
            <p className="font-serif text-xl font-semibold tracking-[-0.02em] text-[#30345f]">Estrus</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-[#77736c]">Supervisor demonstration</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-[#d7d2c6] bg-[#fbfaf7] px-3 py-1.5 font-medium text-[#625f58]">
            North Colony · 19 Jul 2026
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">
            {confirmedCount}/8 reviewed
          </span>
          <span className="rounded-full border border-[#c9c7e7] bg-[#eeedf9] px-3 py-1.5 font-semibold text-[#454a9f]">
            Public demo data
          </span>
        </div>
      </div>
    </header>
  );
}

function BriefView({
  items,
  onBegin,
}: {
  items: ReviewItem[];
  onBegin: () => void;
}) {
  const confirmed = items.filter((item) => item.confirmed).length;
  const remaining = items.length - confirmed;

  return (
    <main id="journey-panel" className="mx-auto max-w-[1500px] px-5 py-6 sm:px-8 lg:px-12 lg:py-8">
      <section className="grid gap-5 border-b border-[#ded9cd] pb-6 md:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] md:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#77736c]">Daily brief · session resumed</p>
          <h1 className="mt-3 max-w-4xl font-serif text-4xl leading-[0.98] tracking-[-0.05em] text-[#30345f] sm:text-5xl">
            A clear start to today&apos;s colony review.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#625f58]">
            The queue is already prepared, the evidence is attached, and two decisions are complete.
            Review the remaining six photographs, confirm the scientist&apos;s exact stage, then leave with a reproducible session receipt.
          </p>
        </div>
        <div className="grid grid-cols-3 border border-[#ded9cd] bg-[#fbfaf7]">
          {[
            [remaining, "Due now"],
            [confirmed, "Reviewed"],
            [127, "21-day records"],
          ].map(([value, label]) => (
            <div key={label} className="border-r border-[#ded9cd] p-4 text-center last:border-r-0">
              <p className="font-serif text-3xl text-[#30345f]">{value}</p>
              <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#77736c]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <section className="border border-[#ded9cd] bg-[#fbfaf7]">
          <div className="flex flex-col gap-3 border-b border-[#ded9cd] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#77736c]">Prepared review queue</p>
              <h2 className="mt-1 font-serif text-2xl text-[#30345f]">Eight observations, ordered by attention</h2>
            </div>
            <span className="text-xs text-[#77736c]">Estimated time · 4–6 min</span>
          </div>
          <div className="divide-y divide-[#e5e0d6]">
            {items.map((item, index) => (
              <div key={item.id} className="grid gap-3 px-5 py-3.5 sm:grid-cols-[44px_1fr_auto_auto] sm:items-center">
                <span className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                  item.confirmed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : index === confirmed ? "border-[#b8b7e1] bg-[#eeedf9] text-[#454a9f]" : "border-[#ded9cd] bg-white text-[#77736c]"
                )}>
                  {item.confirmed ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#292b4c]">{item.subject}</p>
                    <span className="text-[10px] text-[#77736c]">{item.strain} · {item.age}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#77736c]">{item.lastObserved}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8a867f]">Previous</p>
                  <p className="mt-1 text-xs font-semibold text-[#625f58]">{item.lastStage}</p>
                </div>
                <span className={cn(
                  "w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                  item.confirmed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : index === confirmed ? "border-amber-200 bg-amber-50 text-amber-900" : "border-[#ded9cd] bg-white text-[#625f58]"
                )}>
                  {item.confirmed ? item.stage : index === confirmed ? "Review first" : "Ready"}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-4 border-t border-[#ded9cd] bg-[#f4f1ea] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-xs leading-5 text-[#625f58]">
              The model supplies an optional early/late review lead. It never writes the exact stage; that remains the scientist&apos;s recorded decision.
            </p>
            <button
              type="button"
              onClick={onBegin}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[#454a9f] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#383d89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#454a9f] focus-visible:ring-offset-2"
            >
              Continue review · {remaining} left <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="border border-[#ded9cd] bg-[#fbfaf7] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#77736c]">Cycle coverage</p>
                <h2 className="mt-1 font-serif text-2xl text-[#30345f]">Balanced review history</h2>
              </div>
              <EstrusIcon name="evidence" className="h-10 w-10" />
            </div>
            <div className="mt-5 h-56 min-w-0" aria-label="Observation count by saved stage">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={1}
                minHeight={1}
                initialDimension={{ width: 360, height: 224 }}
              >
                <BarChart data={DISTRIBUTION} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#e5e0d6" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="stage" type="category" axisLine={false} tickLine={false} width={76} tick={{ fontSize: 10, fill: "#625f58" }} />
                  <Tooltip
                    cursor={{ fill: "#f4f1ea" }}
                    contentStyle={{ border: "1px solid #ded9cd", borderRadius: 6, fontSize: 12 }}
                    formatter={(value) => [`${value} observations`, "Saved"]}
                  />
                  <Bar dataKey="observations" radius={[0, 4, 4, 0]}>
                    {DISTRIBUTION.map((entry) => (
                      <Cell key={entry.stage} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="border-l-4 border-[#d8b28d] bg-[#fff4df] p-5 text-sm leading-6 text-[#64432d]">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                <strong>What is real here?</strong> The eight photographs come from the labeled public S-BIAD2395 dataset.
                Subject history and notes are illustrative. Nothing in this demo changes a real lab record.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function ReviewView({
  items,
  selectedIndex,
  onSelect,
  onChooseStage,
  onConfirm,
  onBack,
}: {
  items: ReviewItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onChooseStage: (stage: Stage) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const selected = items[selectedIndex];
  const confirmedCount = items.filter((item) => item.confirmed).length;
  const remaining = items.length - confirmedCount;
  const suggestionText = selected.lead === "Early group"
    ? "The review aid narrows this image to proestrus or estrus."
    : selected.lead === "Late group"
      ? "The review aid narrows this image to metestrus or diestrus."
      : "The image-quality guardrail abstained. Review without a model lead.";

  return (
    <main id="journey-panel" className="mx-auto max-w-[1500px] px-5 py-6 sm:px-8 lg:px-12 lg:py-8">
      <div className="flex flex-col gap-4 border-b border-[#ded9cd] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold text-[#625f58] hover:text-[#454a9f]">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to brief
          </button>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#77736c]">Batch review · scientist in control</p>
          <h1 className="mt-2 font-serif text-4xl tracking-[-0.045em] text-[#30345f] sm:text-5xl">
            Decide from context, then confirm.
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold text-[#30345f]">{confirmedCount} of {items.length} confirmed</p>
            <p className="mt-1 text-xs text-[#77736c]">{remaining} observations remain</p>
          </div>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-[#e4dfd4]" aria-hidden="true">
            <div className="h-full rounded-full bg-[#454a9f] transition-all" style={{ width: `${(confirmedCount / items.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <ol className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-8" aria-label="Batch subjects">
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              aria-current={selectedIndex === index ? "step" : undefined}
              className={cn(
                "w-full rounded-md border px-2 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#454a9f]",
                selectedIndex === index
                  ? "border-[#454a9f] bg-[#eeedf9]"
                  : item.confirmed
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-[#ded9cd] bg-[#fbfaf7] hover:border-[#b8b7e1]"
              )}
            >
              <span className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-[#30345f]">{item.subject}</span>
                {item.confirmed && <Check className="h-3 w-3 text-emerald-700" aria-hidden="true" />}
              </span>
              <span className="mt-1 block text-[9px] text-[#77736c]">{item.confirmed ? item.stage : `Cycle day ${item.cycleDay}`}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-5">
        <section className="border border-[#ded9cd] bg-[#fbfaf7]">
          <div className="grid border-b border-[#ded9cd] sm:grid-cols-[1fr_auto]">
            <div className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-[#77736c]">Observation {selectedIndex + 1} of {items.length}</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-serif text-4xl tracking-[-0.04em] text-[#30345f]">{selected.subject}</h2>
                <span className="text-xs text-[#77736c]">{selected.strain} · {selected.age}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 border-t border-[#ded9cd] sm:border-l sm:border-t-0">
              <div className="border-r border-[#ded9cd] px-5 py-4">
                <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[#8a867f]">Last saved</p>
                <p className="mt-2 text-sm font-semibold text-[#30345f]">{selected.lastStage}</p>
                <p className="mt-1 text-[10px] text-[#77736c]">{selected.lastObserved}</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[#8a867f]">Cycle position</p>
                <p className="mt-2 text-sm font-semibold text-[#30345f]">Day {selected.cycleDay}</p>
                <p className="mt-1 text-[10px] text-[#77736c]">Expected 4–5 days</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(250px,0.48fr)]">
            <div>
              <section>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#77736c]">Recent subject history</p>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[
                    ["16 Jul", "Diestrus"],
                    ["17 Jul", selected.lastStage],
                    ["18 Jul", selected.lastStage],
                    ["Today", selected.stage ?? "Review due"],
                  ].map(([date, stage], index) => (
                    <div key={`${date}-${index}`} className="border border-[#ded9cd] bg-white p-3">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8a867f]">{date}</p>
                      <p className="mt-2 truncate text-xs font-semibold text-[#30345f]">{stage}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-5 border border-[#c9c7e7] bg-[#eeedf9] p-4">
                <div className="flex items-start gap-3">
                  <EstrusIcon name={selected.lead === "No model lead" ? "review-needed" : "evidence"} className="h-9 w-9 shrink-0" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#353a87]">
                        {selected.lead === "No model lead" ? "No model lead" : `Optional lead · ${selected.lead}`}
                      </p>
                      {selected.leadConfidence && (
                        <span className="rounded-full border border-[#b8b7e1] bg-white/70 px-2 py-0.5 text-[9px] font-semibold text-[#454a9f]">
                          {Math.round(selected.leadConfidence * 100)}% binary score
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#4f527d]">{suggestionText}</p>
                    <p className="mt-2 text-[10px] leading-4 text-[#65678e]">
                      Replay of the promoted public binary model. This is not a live inference and does not supply an exact four-stage label.
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#77736c]">Scientist&apos;s saved stage</p>
                    <p className="mt-1 text-xs text-[#77736c]">Choose the exact stage supported by your review.</p>
                  </div>
                  {selected.confirmed && <span className="text-xs font-semibold text-emerald-700">Confirmed in this demo</span>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {STAGES.map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => onChooseStage(stage)}
                      aria-pressed={selected.stage === stage}
                      className={cn(
                        "min-h-14 rounded-md border px-3 py-2 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#454a9f]",
                        selected.stage === stage ? STAGE_STYLES[stage] : "border-[#ded9cd] bg-white text-[#625f58] hover:border-[#b8b7e1]",
                        stage === "Uncertain / transition" && "col-span-2 sm:col-span-4"
                      )}
                    >
                      {stage}
                    </button>
                  ))}
                </div>
              </section>

              <div className="mt-5 flex flex-col gap-3 border-t border-[#ded9cd] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-lg text-xs leading-5 text-[#77736c]">{selected.note}</p>
                <button
                  type="button"
                  disabled={!selected.stage}
                  onClick={onConfirm}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[#454a9f] px-5 text-sm font-semibold text-white transition hover:bg-[#383d89] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {selected.confirmed ? "Keep and continue" : "Confirm and continue"}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <aside className="border-l-0 border-[#ded9cd] md:border-l md:pl-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#77736c]">Supporting evidence</p>
              <figure className="mt-3 overflow-hidden rounded-md border border-[#ded9cd] bg-[#f0ede5] p-3">
                <img
                  src={selected.image}
                  alt={`External observation reference for ${selected.subject}`}
                  className="mx-auto h-[260px] w-full object-contain"
                />
                <figcaption className="mt-3 border-t border-[#ded9cd] pt-3 text-[10px] leading-4 text-[#77736c]">
                  {selected.filename}<br />
                  External observational image · original 83 × 128 px
                </figcaption>
              </figure>
              <div className="mt-4 border border-[#ded9cd] bg-white p-4">
                <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[#8a867f]">Acquisition checks</p>
                <ul className="mt-3 space-y-2 text-xs text-[#625f58]">
                  {["Subject centered", "Exposure accepted", "ROI confirmed"].map((label) => (
                    <li key={label} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function OutcomeView({
  items,
  onRestart,
  onReview,
}: {
  items: ReviewItem[];
  onRestart: () => void;
  onReview: () => void;
}) {
  const completed = items.filter((item) => item.confirmed).length;

  const exportCsv = () => {
    const header = "subject,stage,model_lead,model_score,source";
    const rows = items.map((item) => [
      item.subject,
      item.stage ?? "Unconfirmed",
      item.lead,
      item.leadConfidence ?? "",
      item.filename,
    ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "estrus-supervisor-demo-session.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main id="journey-panel" className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <section className="grid gap-6 border-b border-[#ded9cd] pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            <Check className="h-3.5 w-3.5" aria-hidden="true" /> Session complete
          </span>
          <h1 className="mt-4 max-w-4xl font-serif text-5xl leading-[0.98] tracking-[-0.055em] text-[#30345f] sm:text-6xl">
            Today&apos;s review is now a traceable result.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#625f58]">
            Every photograph has a scientist-confirmed stage, the optional model lead is preserved as supporting evidence,
            and the colony timeline updates without hiding uncertainty.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onReview} className="inline-flex h-11 items-center gap-2 rounded-md border border-[#b8b7e1] bg-[#fbfaf7] px-4 text-sm font-semibold text-[#454a9f] hover:bg-[#eeedf9]">
            Review decisions
          </button>
          <button type="button" onClick={exportCsv} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#454a9f] px-4 text-sm font-semibold text-white hover:bg-[#383d89]">
            <Download className="h-4 w-4" aria-hidden="true" /> Export receipt
          </button>
        </div>
      </section>

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(330px,0.6fr)]">
        <section className="overflow-hidden border border-[#ded9cd] bg-[#fbfaf7]">
          <div className="flex flex-col gap-3 border-b border-[#ded9cd] px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#77736c]">Living cycle atlas</p>
              <h2 className="mt-1 font-serif text-2xl text-[#30345f]">North Colony · 21-day record</h2>
            </div>
            <div className="flex flex-wrap gap-3 text-[9px] font-semibold text-[#625f58]">
              {(["Proestrus", "Estrus", "Metestrus", "Diestrus", "Uncertain / transition"] as Stage[]).map((stage) => (
                <span key={stage} className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", STAGE_DOT_STYLES[stage])} aria-hidden="true" />
                  {stage === "Uncertain / transition" ? "Uncertain" : stage}
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto p-5">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[64px_repeat(21,minmax(20px,1fr))] gap-1 text-center">
                <span />
                {Array.from({ length: 21 }, (_, index) => (
                  <span key={index} className="text-[8px] text-[#8a867f]">{index + 1}</span>
                ))}
                {ATLAS_SUBJECTS.flatMap((subject, subjectIndex) => [
                  <span key={`${subject}-label`} className="flex items-center text-[10px] font-semibold text-[#30345f]">{subject}</span>,
                  ...Array.from({ length: 21 }, (_, dayIndex) => {
                    const stage = stageForCell(subjectIndex, dayIndex);
                    const today = dayIndex === 20 && subjectIndex < 8;
                    return (
                      <span
                        key={`${subject}-${dayIndex}`}
                        title={`${subject} · Day ${dayIndex + 1} · ${stage}`}
                        className={cn(
                          "flex h-5 items-center justify-center rounded-sm border border-transparent",
                          today && "border-[#30345f] bg-white"
                        )}
                      >
                        <span className={cn("h-2.5 w-2.5 rounded-full", STAGE_DOT_STYLES[stage])} />
                      </span>
                    );
                  }),
                ])}
              </div>
            </div>
          </div>
          <p className="border-t border-[#ded9cd] px-5 py-3 text-[10px] leading-4 text-[#77736c]">
            Demo visualization: historical subject sequence is illustrative. The outlined final-day cells correspond to today&apos;s prepared review.
          </p>
        </section>

        <aside className="space-y-6">
          <section className="grid grid-cols-3 border border-[#ded9cd] bg-[#fbfaf7]">
            {[
              [completed, "Confirmed"],
              [items.filter((item) => item.lead === "No model lead").length, "Abstained"],
              [4, "Stages used"],
            ].map(([value, label]) => (
              <div key={label} className="border-r border-[#ded9cd] p-4 text-center last:border-r-0">
                <p className="font-serif text-3xl text-[#30345f]">{value}</p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#77736c]">{label}</p>
              </div>
            ))}
          </section>

          <section className="border border-[#ded9cd] bg-[#fbfaf7] p-5">
            <div className="flex items-start gap-3">
              <EstrusIcon name="confirm" className="h-10 w-10 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#77736c]">Provenance receipt</p>
                <h2 className="mt-1 font-serif text-2xl text-[#30345f]">What this session preserves</h2>
              </div>
            </div>
            <dl className="mt-5 divide-y divide-[#e5e0d6] text-xs">
              {[
                ["Source images", "BioStudies S-BIAD2395 · CC BY 4.0"],
                ["Review aid", "DINOv2 robust ensemble · v2"],
                ["Model role", "Binary early/late suggestion only"],
                ["Saved decision", "Exact stage chosen by scientist"],
                ["Guardrail", "1 of 8 images abstained"],
                ["Persistence", "Browser-only demonstration"],
              ].map(([term, detail]) => (
                <div key={term} className="grid grid-cols-[110px_1fr] gap-3 py-3 first:pt-0 last:pb-0">
                  <dt className="font-semibold text-[#77736c]">{term}</dt>
                  <dd className="text-[#30345f]">{detail}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="border-l-4 border-[#b8b7e1] bg-[#eeedf9] p-5 text-sm leading-6 text-[#454a9f]">
            <strong>The point of the workflow:</strong> the model can help a researcher focus, but the scientific record always shows who made the exact decision and what evidence they saw.
          </section>

          <button
            type="button"
            onClick={onRestart}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[#ded9cd] bg-[#fbfaf7] text-sm font-semibold text-[#625f58] hover:border-[#b8b7e1] hover:text-[#454a9f]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Restart the demonstration
          </button>
        </aside>
      </div>
    </main>
  );
}

export function SupervisorDemoClient() {
  const [view, setView] = useState<JourneyView>("brief");
  const [items, setItems] = useState<ReviewItem[]>(STARTING_ITEMS);
  const [selectedIndex, setSelectedIndex] = useState(2);
  const confirmedCount = useMemo(() => items.filter((item) => item.confirmed).length, [items]);

  const navigate = (next: JourneyView) => {
    if (next === "review") {
      const firstOpen = items.findIndex((item) => !item.confirmed);
      if (firstOpen >= 0) setSelectedIndex(firstOpen);
    }
    setView(next);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
  };

  const chooseStage = (stage: Stage) => {
    setItems((current) => current.map((item, index) => index === selectedIndex ? { ...item, stage, confirmed: false } : item));
  };

  const confirmAndContinue = () => {
    if (!items[selectedIndex]?.stage) return;
    const updated = items.map((item, index) => index === selectedIndex ? { ...item, confirmed: true } : item);
    setItems(updated);

    const nextOpen = updated.findIndex((item, index) => index > selectedIndex && !item.confirmed);
    const wrappedOpen = updated.findIndex((item) => !item.confirmed);
    if (nextOpen >= 0) {
      setSelectedIndex(nextOpen);
    } else if (wrappedOpen >= 0) {
      setSelectedIndex(wrappedOpen);
    } else {
      setView("outcome");
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
    }
  };

  const restart = () => {
    setItems(STARTING_ITEMS);
    setSelectedIndex(2);
    setView("brief");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
  };

  return (
    <div className="min-h-screen bg-[#f7f4ed] text-[#292b4c]">
      <DemoHeader confirmedCount={confirmedCount} />
      <JourneyRail view={view} complete={confirmedCount === items.length} onNavigate={navigate} />
      {view === "brief" && <BriefView items={items} onBegin={() => navigate("review")} />}
      {view === "review" && (
        <ReviewView
          items={items}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onChooseStage={chooseStage}
          onConfirm={confirmAndContinue}
          onBack={() => setView("brief")}
        />
      )}
      {view === "outcome" && (
        <OutcomeView
          items={items}
          onRestart={restart}
          onReview={() => setView("review")}
        />
      )}
      <footer className="border-t border-[#ded9cd] bg-[#f0ede5]">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-2 px-5 py-4 text-[10px] leading-4 text-[#77736c] sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <p>Estrus supervisor demo · public reference images · no production record is changed</p>
          <p>Model output is a review aid, never the saved scientific decision.</p>
        </div>
      </footer>
    </div>
  );
}
