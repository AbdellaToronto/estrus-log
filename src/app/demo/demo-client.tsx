"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Download,
  Images,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { DayComplete } from "./day-complete";
import { LiveAnalysis } from "./live-analysis";
import { BulkEvaluation } from "./bulk-evaluation";
import { StageDistribution } from "@/components/prediction/stage-distribution";
import {
  EXTERNAL_ROI_REFERENCE_HEIGHT,
  EXTERNAL_ROI_REFERENCE_WIDTH,
} from "@/components/prepared-roi-cropper";
import { ESTRUS_STAGES, type ClassificationStage } from "@/lib/classification";
import { cn } from "@/lib/utils";

type ReviewState = "ready" | "attention" | "abstained";
type DemoView = "review" | "receipt" | "complete" | "live" | "batch" | "method";

type DemoPrediction = {
  id: string;
  subject: string;
  strain: string;
  age: string;
  image: string;
  filename: string;
  prediction: ClassificationStage;
  scores: Record<ClassificationStage, number>;
  state: ReviewState;
  previousStage: ClassificationStage;
  cycleDay: number;
  guardrail: string;
  finalStage?: ClassificationStage | "Uncertain / transition";
};

const STARTING_ITEMS: DemoPrediction[] = [
  {
    id: "demo-221",
    subject: "N-221",
    strain: "BALB/c",
    age: "14 weeks",
    image: "/assets/demo/s-biad2395/n-221.png",
    filename: "S-BIAD2395 · external photograph 139",
    prediction: "Estrus",
    scores: { Proestrus: 0.06, Estrus: 0.82, Metestrus: 0.08, Diestrus: 0.04 },
    state: "ready",
    previousStage: "Proestrus",
    cycleDay: 2,
    guardrail: "Early-cycle guardrail agrees",
  },
  {
    id: "demo-222",
    subject: "N-222",
    strain: "BALB/c",
    age: "14 weeks",
    image: "/assets/demo/s-biad2395/n-222.png",
    filename: "S-BIAD2395 · external photograph 118",
    prediction: "Proestrus",
    scores: { Proestrus: 0.76, Estrus: 0.13, Metestrus: 0.07, Diestrus: 0.04 },
    state: "ready",
    previousStage: "Diestrus",
    cycleDay: 1,
    guardrail: "Early-cycle guardrail agrees",
  },
  {
    id: "demo-223",
    subject: "N-223",
    strain: "BALB/c",
    age: "15 weeks",
    image: "/assets/demo/s-biad2395/n-223.png",
    filename: "S-BIAD2395 · external photograph 106",
    prediction: "Metestrus",
    scores: { Proestrus: 0.05, Estrus: 0.1, Metestrus: 0.68, Diestrus: 0.17 },
    state: "ready",
    previousStage: "Estrus",
    cycleDay: 3,
    guardrail: "Late-cycle guardrail agrees",
  },
  {
    id: "demo-224",
    subject: "N-224",
    strain: "BALB/c",
    age: "15 weeks",
    image: "/assets/demo/s-biad2395/n-224.png",
    filename: "S-BIAD2395 · external photograph 135",
    prediction: "Diestrus",
    scores: { Proestrus: 0.03, Estrus: 0.05, Metestrus: 0.12, Diestrus: 0.8 },
    state: "ready",
    previousStage: "Metestrus",
    cycleDay: 4,
    guardrail: "Late-cycle guardrail agrees",
  },
  {
    id: "demo-225",
    subject: "N-225",
    strain: "BALB/c",
    age: "14 weeks",
    image: "/assets/demo/s-biad2395/n-225.png",
    filename: "S-BIAD2395 · external photograph 155",
    prediction: "Estrus",
    scores: { Proestrus: 0.27, Estrus: 0.43, Metestrus: 0.19, Diestrus: 0.11 },
    state: "attention",
    previousStage: "Proestrus",
    cycleDay: 2,
    guardrail: "Close stage scores · inspect before accepting",
  },
  {
    id: "demo-226",
    subject: "N-226",
    strain: "BALB/c",
    age: "14 weeks",
    image: "/assets/demo/s-biad2395/n-226.png",
    filename: "S-BIAD2395 · external photograph 145",
    prediction: "Metestrus",
    scores: { Proestrus: 0.08, Estrus: 0.15, Metestrus: 0.52, Diestrus: 0.25 },
    state: "attention",
    previousStage: "Estrus",
    cycleDay: 3,
    guardrail: "Late-cycle guardrail agrees · low margin",
  },
  {
    id: "demo-227",
    subject: "N-227",
    strain: "C57BL/6J",
    age: "16 weeks",
    image: "/assets/demo/s-biad2395/n-227.png",
    filename: "S-BIAD2395 · external photograph 174",
    prediction: "Proestrus",
    scores: { Proestrus: 0.39, Estrus: 0.31, Metestrus: 0.18, Diestrus: 0.12 },
    state: "abstained",
    previousStage: "Diestrus",
    cycleDay: 1,
    guardrail: "Acquisition guardrail abstained",
  },
  {
    id: "demo-228",
    subject: "N-228",
    strain: "C57BL/6J",
    age: "16 weeks",
    image: "/assets/demo/s-biad2395/n-228.png",
    filename: "S-BIAD2395 · external photograph 177",
    prediction: "Diestrus",
    scores: { Proestrus: 0.04, Estrus: 0.06, Metestrus: 0.19, Diestrus: 0.71 },
    state: "ready",
    previousStage: "Metestrus",
    cycleDay: 4,
    guardrail: "Late-cycle guardrail agrees",
  },
];

const COMPLETED_DECISIONS: Record<
  string,
  ClassificationStage | "Uncertain / transition"
> = {
  "N-221": "Estrus",
  "N-222": "Proestrus",
  "N-223": "Metestrus",
  "N-224": "Diestrus",
  "N-225": "Proestrus",
  "N-226": "Metestrus",
  "N-227": "Uncertain / transition",
  "N-228": "Diestrus",
};

const COMPLETED_ITEMS: DemoPrediction[] = STARTING_ITEMS.map((item) => ({
  ...item,
  finalStage: COMPLETED_DECISIONS[item.subject],
}));

function DemoHeader({
  view,
  confirmedCount,
  onNavigate,
}: {
  view: DemoView;
  confirmedCount: number;
  onNavigate: (view: DemoView) => void;
}) {
  return (
      <header className="border-b border-[#ded9cd] bg-[#f7f4ed]">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-5 py-3 sm:px-8 lg:flex-row lg:items-center lg:px-12">
          <div>
            <p className="font-serif text-xl font-semibold text-[#30345f]">Estrus</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#625f58]">Demonstration</p>
          </div>
          {/* Five tabs no longer fit a phone in one row. Wrapping keeps every
              tab reachable without the header forcing the page sideways. */}
          <nav className="flex flex-wrap lg:ml-10 lg:flex-nowrap" aria-label="Demo pages">
            {[
              ["review", "Prediction inbox"],
              ["receipt", "Review receipt"],
              ["complete", "Day complete"],
              ["live", "Analyze a photo"],
              ["batch", "Batch evaluation"],
            ].map(([target, label]) => (
              <button
                key={target}
                type="button"
                aria-current={view === target ? "page" : undefined}
                onClick={() => onNavigate(target as DemoView)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-2 text-sm font-semibold",
                  view === target ? "text-[#292b4c]" : "text-[#625f58] hover:text-[#454a9f]"
                )}
              >
                {label}
                {/* The views backed by real inference rather than replayed data. */}
                {(target === "live" || target === "batch") && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[#c76f87]"
                    aria-label="live inference"
                  />
                )}
                {view === target && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-[#454a9f]" />}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-4 lg:ml-auto">
            <p className="text-xs text-[#625f58]"><span className="font-semibold text-[#292b4c]">{confirmedCount} of 8</span> reviewed</p>
            <div
              className="h-1.5 w-32 overflow-hidden rounded-full bg-[#e4dfd5]"
              role="progressbar"
              aria-label="Review progress"
              aria-valuemin={0}
              aria-valuemax={8}
              aria-valuenow={confirmedCount}
            >
              <div
                className="h-full rounded-full bg-[#454a9f] transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${(confirmedCount / 8) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>
  );
}

function PredictionInbox({
  items,
  selectedId,
  editing,
  onSelect,
  onAccept,
  onCorrect,
  onChooseCorrection,
}: {
  items: DemoPrediction[];
  selectedId: string;
  editing: boolean;
  onSelect: (id: string) => void;
  onAccept: () => void;
  onCorrect: () => void;
  onChooseCorrection: (stage: ClassificationStage | "Uncertain / transition") => void;
}) {
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const grouped = {
    ready: items.filter((item) => item.state === "ready" && !item.finalStage),
    attention: items.filter((item) => item.state === "attention" && !item.finalStage),
    abstained: items.filter((item) => item.state === "abstained" && !item.finalStage),
  };
  const reviewed = items.filter((item) => item.finalStage).length;
  const support = Math.round(selected.scores[selected.prediction] * 100);

  return (
    <main className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-12">
      <div className="border-b border-[#d9d4c8] pb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#68645d]">North colony · 8 photographs analyzed</p>
        <div className="mt-2 grid gap-5 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-end">
          <div>
            <h1 className="font-serif text-4xl tracking-tight text-[#292b4c] sm:text-5xl">Prediction inbox</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625f58]">AI has proposed an exact stage for every photograph. Review exceptions, accept strong predictions, and let the record build itself.</p>
          </div>
          <div className="grid grid-cols-4 border border-[#ded9cd] bg-white">
            {[
              ["Analyzed", 8],
              ["Ready", items.filter((item) => item.state === "ready" && !item.finalStage).length],
              ["Review", items.filter((item) => item.state === "attention" && !item.finalStage).length],
              ["Abstained", items.filter((item) => item.state === "abstained" && !item.finalStage).length],
            ].map(([label, value], index) => (
              <div key={String(label)} className={cn("p-3", index > 0 && "border-l border-[#ded9cd]")}>
                <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#68645d]">{label}</p>
                <p className="mt-1 font-serif text-2xl text-[#292b4c]">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="mt-5 grid min-h-[580px] border border-[#ded9cd] bg-white xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="order-2 border-t border-[#ded9cd] bg-[#fbfaf7] xl:order-1 xl:border-r xl:border-t-0">
          {([
            ["ready", "Ready to accept", grouped.ready],
            ["attention", "Needs attention", grouped.attention],
            ["abstained", "AI abstained", grouped.abstained],
          ] as const).map(([key, label, group]) => (
            <div key={key} className="border-b border-[#ded9cd]">
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#68645d]">{label}</p>
                <span className="text-xs font-semibold text-[#555a9d]">{group.length}</span>
              </div>
              {group.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "grid w-full grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 border-t border-[#e8e3da] px-4 py-3 text-left",
                    selected.id === item.id ? "bg-[#eeedf9]" : "hover:bg-white"
                  )}
                >
                  {/* Portrait thumbnail matching the 83:128 source. A square
                      crop cut away the top and bottom of every photograph. */}
                  <div className="relative mx-auto h-[52px] w-[34px] overflow-hidden bg-[#ece8df]">
                    <Image src={item.image} alt="" fill sizes="34px" className="object-cover" />
                  </div>
                  <span>
                    <span className="block text-sm font-semibold text-[#292b4c]">{item.subject}</span>
                    <span className="block text-xs text-[#68645d]">{item.prediction}</span>
                  </span>
                  <span className="text-xs font-semibold text-[#555a9d]">{Math.round(item.scores[item.prediction] * 100)}%</span>
                </button>
              ))}
              {group.length === 0 && <p className="border-t border-[#e8e3da] px-4 py-4 text-xs text-[#625f58]">Group clear.</p>}
            </div>
          ))}
          {reviewed > 0 && (
            <div className="px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#68645d]">Reviewed</p>
              <p className="mt-1 text-sm font-semibold text-[#356449]">{reviewed} record{reviewed === 1 ? "" : "s"} ready</p>
            </div>
          )}
        </aside>

        <div className="order-1 grid lg:grid-cols-[minmax(0,1fr)_330px] xl:order-2">
          <div className="flex min-w-0 flex-col">
            <div className="border-b border-[#ded9cd] p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#68645d]">{selected.subject} · {selected.strain} · {selected.age}</p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-serif text-4xl text-[#292b4c]">AI predicts {selected.prediction}</h2>
                  <p className="mt-1 text-sm font-semibold text-[#555a9d]">{support}% model support</p>
                </div>
              </div>
            </div>

            <div className="flex-1 p-6">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#68645d]">All stage scores</p>
                <span className="text-[10px] text-[#625f58]">relative model support</span>
              </div>
              <StageDistribution className="mt-5 max-w-2xl" scores={selected.scores} predictedStage={selected.prediction} />
              <div className={cn(
                "mt-6 flex items-center gap-2 border px-4 py-3 text-sm font-semibold",
                selected.state === "ready"
                  ? "border-[#cddfd4] bg-[#f3faf5] text-[#356449]"
                  : "border-[#e2bf95] bg-[#fff7e9] text-[#7d4a2f]"
              )}>
                {selected.state === "ready" ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {selected.guardrail}
              </div>

              {editing && (
                <section className="mt-5 border border-[#454a9f] bg-[#fbfaf7] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#454a9f]">Correct the prediction</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[...ESTRUS_STAGES, "Uncertain / transition" as const].map((stage) => (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => onChooseCorrection(stage)}
                        className="min-h-11 border border-[#ded9cd] bg-white px-3 text-left text-sm font-semibold text-[#4f4b45] hover:border-[#9b9dcc] hover:bg-[#eeedf9]"
                      >
                        {stage}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-[#ded9cd] p-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={onCorrect} className="min-h-11 border border-[#cbc6bb] bg-white px-5 text-sm font-semibold text-[#45413c] hover:bg-[#f6f3ec]">Correct prediction</button>
              <button type="button" onClick={onAccept} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#454a9f] px-6 text-sm font-semibold text-white hover:bg-[#383d89]">
                <Check className="h-4 w-4" />Accept {selected.prediction}
              </button>
            </div>
          </div>

          <aside className="border-t border-[#ded9cd] bg-[#f4f1e9] p-5 lg:border-l lg:border-t-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#68645d]">Supporting photograph</p>
            {/* The public benchmark crops are natively 83x128. Filling a 390px
                box upscaled them almost 3x and turned the most important
                evidence on the page into mush. The frame hugs the photograph at
                2x instead, so it reads as a deliberate contact print rather
                than a stretched thumbnail. */}
            <figure className="mt-4 flex justify-center">
              <Image
                src={selected.image}
                alt={`Prepared external photograph for ${selected.subject}`}
                width={EXTERNAL_ROI_REFERENCE_WIDTH * 2}
                height={EXTERNAL_ROI_REFERENCE_HEIGHT * 2}
                className="border border-[#d9d4c8] bg-[#e7e2d9]"
                priority
              />
            </figure>
            <div className="mt-4 border-t border-[#d9d4c8] pt-4 text-xs leading-5 text-[#68645d]">
              <p className="font-semibold text-[#292b4c]">{selected.filename}</p>
              <p className="mt-1">
                Prepared crop shown exactly as analyzed, at its native {EXTERNAL_ROI_REFERENCE_WIDTH}&times;
                {EXTERNAL_ROI_REFERENCE_HEIGHT} capture resolution.
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#d9d4c8] pt-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-[#68645d]">Previous</p>
                <p className="mt-1 text-sm font-semibold text-[#292b4c]">{selected.previousStage}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-[#68645d]">Cycle</p>
                <p className="mt-1 text-sm font-semibold text-[#292b4c]">Day {selected.cycleDay}</p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Receipt({
  items,
  onBack,
  onRestart,
  onExport,
}: {
  items: DemoPrediction[];
  onBack: () => void;
  onRestart: () => void;
  onExport: () => void;
}) {
  const finalized = items.filter((item) => item.finalStage);
  const accepted = finalized.filter((item) => item.finalStage === item.prediction).length;
  const corrected = finalized.filter(
    (item) =>
      item.finalStage !== item.prediction &&
      item.finalStage !== "Uncertain / transition"
  ).length;
  const uncertain = finalized.filter(
    (item) => item.finalStage === "Uncertain / transition"
  ).length;
  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 sm:px-8 lg:px-12">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-[#625f58] hover:text-[#353a87]"><ChevronLeft className="h-4 w-4" />Back to predictions</button>
      <div className="mt-6 border-b border-[#d9d4c8] pb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#68645d]">Review receipt · North colony</p>
        <h1 className="mt-2 font-serif text-4xl text-[#292b4c] sm:text-5xl">{finalized.length === items.length ? "Review complete" : "Partial review saved"}</h1>
        <p className="mt-2 text-sm text-[#625f58]">The receipt keeps the AI proposal and scientist&apos;s final decision side by side.</p>
      </div>

      <section
        className="mt-6 grid border border-[#ded9cd] bg-white sm:grid-cols-5"
        data-testid="receipt-summary"
      >
        {[
          ["Analyzed", items.length],
          ["Reviewed", finalized.length],
          ["Accepted", accepted],
          ["Corrected", corrected],
          ["Uncertain", uncertain],
        ].map(([label, value], index) => (
          <div
            key={String(label)}
            data-testid={`receipt-stat-${String(label).toLowerCase()}`}
            className={cn("p-5", index > 0 && "border-t border-[#ded9cd] sm:border-l sm:border-t-0")}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#68645d]">{label}</p>
            <p className="mt-2 font-serif text-3xl text-[#292b4c]">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-5 border border-[#ded9cd] bg-white">
        <div className="grid grid-cols-[1fr_120px_120px] border-b border-[#ded9cd] bg-[#fbfaf7] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#68645d] sm:grid-cols-[1fr_180px_180px]">
          <span>Subject</span><span>AI proposal</span><span>Saved decision</span>
        </div>
        {items.map((item) => (
          <div
            key={item.id}
            data-testid={`receipt-row-${item.id}`}
            className="grid grid-cols-[1fr_120px_120px] items-center border-b border-[#ebe6dc] px-4 py-4 text-sm last:border-b-0 sm:grid-cols-[1fr_180px_180px]"
          >
            <div>
              <p className="font-semibold text-[#292b4c]">{item.subject}</p>
              <p className="mt-0.5 text-xs text-[#68645d]">{item.strain}</p>
            </div>
            <span className="text-[#555a9d]">{item.prediction}</span>
            <span className={cn("font-semibold", item.finalStage ? "text-[#292b4c]" : "text-[#a25a3f]")}>{item.finalStage || "Pending"}</span>
          </div>
        ))}
      </section>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onRestart} className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#cbc6bb] bg-white px-5 text-sm font-semibold text-[#45413c]"><RotateCcw className="h-4 w-4" />Restart demo</button>
        <button type="button" onClick={onExport} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#454a9f] px-5 text-sm font-semibold text-white"><Download className="h-4 w-4" />Export receipt</button>
      </div>
    </main>
  );
}

function Method() {
  return (
    <main className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 lg:px-12">
      <div className="border-b border-[#d9d4c8] pb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#68645d]">The product model</p>
        <h1 className="mt-2 font-serif text-4xl text-[#292b4c] sm:text-5xl">AI proposes. Scientists supervise.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#625f58]">Estrus Log is not a blank data-entry form. It turns external photographs into reviewable stage proposals, then builds a traceable record from the scientist&apos;s decisions.</p>
      </div>
      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          [Images, "1. Analyze photographs", "Upload a single image or a daily batch. Estrus Log prepares consistent crops and exact-stage proposals."],
          [ShieldCheck, "2. Review intelligently", "Strong predictions are quick to accept. Close calls, domain warnings, and abstentions are separated for attention."],
          [Check, "3. Build the record", "Every saved observation keeps the AI proposal, all four scores, the final decision, image, and provenance together."],
        ].map(([Icon, title, body]) => {
          const MethodIcon = Icon as typeof Images;
          return (
            <article key={String(title)} className="border border-[#ded9cd] bg-white p-5">
              <MethodIcon className="h-5 w-5 text-[#454a9f]" />
              <h2 className="mt-4 font-serif text-2xl text-[#292b4c]">{String(title)}</h2>
              <p className="mt-2 text-sm leading-6 text-[#625f58]">{String(body)}</p>
            </article>
          );
        })}
      </section>
      <section className="mt-5 flex gap-3 border border-[#e2bf95] bg-[#fff7e9] p-5 text-[#7d4a2f]">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Research honesty is visible in the interface</p>
          <p className="mt-1 text-sm leading-6">The displayed percentages are relative model support, not calibrated probabilities. The separately evaluated early/late model is a guardrail, and the scientist&apos;s reviewed decision remains the saved record.</p>
        </div>
      </section>
    </main>
  );
}

export function DemoClient() {
  const [view, setView] = useState<DemoView>("review");
  const [items, setItems] = useState(STARTING_ITEMS);
  const [selectedId, setSelectedId] = useState("demo-223");
  const [editing, setEditing] = useState(false);
  const confirmedCount = useMemo(() => items.filter((item) => item.finalStage).length, [items]);
  const dayCompleteItems = useMemo(
    () => (items.every((item) => item.finalStage) ? items : COMPLETED_ITEMS),
    [items]
  );
  const receiptItems = useMemo(
    () => (view === "receipt" && confirmedCount === 0 ? COMPLETED_ITEMS : items),
    [confirmedCount, items, view]
  );

  const reviewNext = (updated: DemoPrediction[]) => {
    const next = updated.find((item) => !item.finalStage);
    if (next) setSelectedId(next.id);
    else setView("complete");
  };
  const saveDecision = (stage: ClassificationStage | "Uncertain / transition") => {
    const updated = items.map((item) =>
      item.id === selectedId ? { ...item, finalStage: stage } : item
    );
    setItems(updated);
    setEditing(false);
    reviewNext(updated);
  };
  const restart = () => {
    setItems(STARTING_ITEMS);
    setSelectedId("demo-223");
    setEditing(false);
    setView("review");
  };
  const openCompleteRecords = () => {
    setItems(dayCompleteItems);
    setView("receipt");
  };
  const exportReceipt = (sourceItems: DemoPrediction[]) => {
    const header = [
      "record_scope",
      "subject",
      "strain",
      "age",
      "image_reference",
      "ai_proposal",
      "proestrus_relative_support",
      "estrus_relative_support",
      "metestrus_relative_support",
      "diestrus_relative_support",
      "saved_decision",
      "review_outcome",
      "guardrail",
      "score_semantics",
      "inference_mode",
      "reviewed_at",
    ];
    const rows = sourceItems.map((item, index) => {
      const savedDecision = item.finalStage ?? "";
      const reviewOutcome =
        !savedDecision
          ? "pending"
          : savedDecision === "Uncertain / transition"
          ? "uncertain"
          : savedDecision === item.prediction
            ? "accepted"
            : "corrected";

      return [
        "illustrative_demo",
        item.subject,
        item.strain,
        item.age,
        item.filename,
        item.prediction,
        String(item.scores.Proestrus),
        String(item.scores.Estrus),
        String(item.scores.Metestrus),
        String(item.scores.Diestrus),
        savedDecision,
        reviewOutcome,
        item.guardrail,
        "relative_support_not_calibrated_probability",
        "illustrative_not_live_inference",
        savedDecision
          ? `2026-07-28T09:${String(24 + index).padStart(2, "0")}:00-04:00`
          : "",
      ];
    });
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "north-colony-review-receipt-2026-07-28.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  const displayedCount =
    view === "complete" || (view === "receipt" && confirmedCount === 0)
      ? 8
      : confirmedCount;

  return (
    <div className="min-h-screen bg-[#f7f4ed] text-[#292b4c]">
      <DemoHeader view={view} confirmedCount={displayedCount} onNavigate={setView} />
      {view === "review" && (
        <PredictionInbox
          items={items}
          selectedId={selectedId}
          editing={editing}
          onSelect={(id) => { setSelectedId(id); setEditing(false); }}
          onAccept={() => {
            const selected = items.find((item) => item.id === selectedId);
            if (selected) saveDecision(selected.prediction);
          }}
          onCorrect={() => setEditing(true)}
          onChooseCorrection={saveDecision}
        />
      )}
      {view === "receipt" && (
        <Receipt
          items={receiptItems}
          onBack={() => setView("review")}
          onRestart={restart}
          onExport={() => exportReceipt(receiptItems)}
        />
      )}
      {view === "complete" && (
        <DayComplete
          items={dayCompleteItems}
          onOpenRecords={openCompleteRecords}
          onExport={() => exportReceipt(dayCompleteItems)}
        />
      )}
      {view === "live" && <LiveAnalysis />}
      {view === "batch" && (
        <main className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-12">
          <BulkEvaluation />
        </main>
      )}
      {view === "method" && <Method />}
      <footer className="mt-8 border-t border-[#ded9cd] bg-[#f0ede5]">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-5 py-4 text-[10px] leading-4 text-[#625f58] sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <div>
            <p>Estrus demo · public reference photographs · no production record is changed</p>
            {/* The live and batch views are where numbers come from a real
                encoder call, so they must not carry the "illustrative" caption. */}
            <p className="mt-1">
              {view === "live" || view === "batch"
                ? "This view runs live inference against the deployed encoder. Scores are relative model support, not calibrated probabilities, and nothing is saved."
                : "Historical observations are illustrative demo data. Scores are relative model support, not live calibrated inference."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setView("method")}
            className="w-fit text-xs font-semibold text-[#454a9f] underline decoration-[#b8b7e1] underline-offset-4 hover:text-[#292f68]"
          >
            How it works
          </button>
        </div>
      </footer>
    </div>
  );
}
