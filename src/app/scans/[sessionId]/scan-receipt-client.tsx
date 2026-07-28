"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ImageIcon,
  Microscope,
  Plus,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ScanSessionDetail } from "@/app/actions";

const STAGE_TONES: Record<string, string> = {
  Proestrus: "border-pink-200 bg-pink-50 text-pink-800",
  Estrus: "border-rose-200 bg-rose-50 text-rose-800",
  Metestrus: "border-violet-200 bg-violet-50 text-violet-800",
  Diestrus: "border-blue-200 bg-blue-50 text-blue-800",
};

function formatDate(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function modelLead(item: ScanSessionDetail["items"][number]) {
  const model = item.binaryModel;
  if (!model) return null;
  if (model.decisionStatus === "abstain") return "Model: no suggestion";

  const suggestion = model.suggestion?.toLowerCase() || "";
  // Check the late-stage names first: both "metestrus" and "diestrus"
  // contain the substring "estrus", so a broad estrus match would invert
  // the model lead shown in the batch receipt.
  if (suggestion.includes("metestrus") || suggestion.includes("diestrus") || suggestion.includes("late")) {
    return "Model lead: later-cycle";
  }
  if (suggestion.includes("proestrus") || suggestion === "estrus" || suggestion.includes("early")) {
    return "Model lead: earlier-cycle";
  }
  return "Model suggestion available";
}

function StageSummary({ breakdown }: { breakdown: Record<string, number> }) {
  const entries = Object.entries(breakdown).filter(([, count]) => count > 0);
  if (!entries.length) return null;

  return (
    <details className="border-t border-[#ded9cd] px-5 py-4">
      <summary className="cursor-pointer text-sm font-medium text-[#353a87]">
        Scientist-confirmed stage distribution
      </summary>
      <div className="mt-4 flex flex-wrap gap-2">
        {entries.map(([stage, count]) => (
          <span
            key={stage}
            className={`rounded-full border px-3 py-1 text-sm ${STAGE_TONES[stage] || "border-slate-200 bg-slate-50 text-slate-700"}`}
          >
            {stage} {count}
          </span>
        ))}
      </div>
    </details>
  );
}

function PhotoGrid({
  items,
  recordsAreSaved,
}: {
  items: ScanSessionDetail["items"];
  recordsAreSaved: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId) || null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => {
          const aid = modelLead(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className="group overflow-hidden border border-[#ded9cd] bg-white text-left transition-colors hover:border-[#9b9dcc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#454a9f] focus-visible:ring-offset-2"
              aria-label={`Open photo ${index + 1}${item.mouse_name ? ` for ${item.mouse_name}` : ""}`}
            >
              <div className="relative aspect-[4/3] bg-[#f1eee7]">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={`Batch photo ${index + 1}`}
                    fill
                    className="object-contain"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-[#aaa59b]" />
                  </div>
                )}
              </div>
              <div className="space-y-2 border-t border-[#ded9cd] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#292b4c]">
                      {item.mouse_name || `Photo ${index + 1}`}
                    </p>
                    <p className="mt-0.5 text-xs text-[#77736c]">
                      {recordsAreSaved ? "Saved observation" : "Awaiting scientist review"}
                    </p>
                  </div>
                  {recordsAreSaved && item.savedStage ? (
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${STAGE_TONES[item.savedStage] || "border-slate-200 bg-slate-50 text-slate-700"}`}>
                      {item.savedStage}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-[#fff1dc] px-2.5 py-1 text-xs font-medium text-[#8d4834]">
                      Review
                    </span>
                  )}
                </div>
                {aid && (
                  <p className="text-xs text-[#625f58]">{aid}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0">
          {selected && (
            <>
              <div className="relative aspect-[4/3] max-h-[68vh] w-full bg-[#171717]">
                {selected.image_url ? (
                  <Image
                    src={selected.image_url}
                    alt={selected.mouse_name ? `Observation for ${selected.mouse_name}` : "Batch observation"}
                    fill
                    className="object-contain"
                    sizes="90vw"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ImageIcon className="h-10 w-10 text-white/40" />
                  </div>
                )}
              </div>
              <div className="space-y-4 p-6">
                <DialogHeader>
                  <DialogTitle className="font-serif text-3xl text-[#292b4c]">
                    {selected.mouse_name || "Batch photo"}
                  </DialogTitle>
                  <DialogDescription>
                    {recordsAreSaved && selected.savedStage
                      ? `Scientist-confirmed stage: ${selected.savedStage}`
                      : "This photo still needs scientist review before it becomes a record."}
                  </DialogDescription>
                </DialogHeader>
                {selected.notes && (
                  <div className="border-l-2 border-[#b8b7e1] pl-4 text-sm text-[#625f58]">
                    {selected.notes}
                  </div>
                )}
                {selected.binaryModel && (
                  <details className="border border-[#ded9cd] bg-[#fbfaf7] p-4">
                    <summary className="cursor-pointer text-sm font-medium text-[#353a87]">
                      Binary model review aid
                    </summary>
                    <div className="mt-3 space-y-1 text-sm text-[#625f58]">
                      <p>{modelLead(selected)}</p>
                      {typeof selected.binaryModel.probabilityEarly === "number" && (
                        <p>
                          Earlier-cycle probability: {Math.round(selected.binaryModel.probabilityEarly * 100)}%
                        </p>
                      )}
                      {selected.binaryModel.modelVersion && <p>Model: {selected.binaryModel.modelVersion}</p>}
                      <p className="pt-1 text-xs">
                        This is supporting evidence only. It does not assign the four-stage record.
                      </p>
                    </div>
                  </details>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ScanReceiptClient({ session }: { session: ScanSessionDetail }) {
  const recordsAreSaved = session.workflowStatus === "saved";
  const captureDate = session.captureDate || session.created_at;
  const cohortId = session.cohort?.id;

  return (
    <div className="page-shell space-y-6 pb-20">
      <header className="border-b border-[#d9d4c8] pb-6 pt-2">
        {session.cohort && (
          <Link
            href={`/cohorts/${session.cohort.id}/scans`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#625f58] hover:text-[#353a87]"
          >
            <ArrowLeft className="h-4 w-4" /> Batch history
          </Link>
        )}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="page-eyebrow">{recordsAreSaved ? "Batch receipt" : "Batch session"}</p>
            <h1 className="mt-2 font-serif text-4xl tracking-tight text-[#292b4c] sm:text-5xl">
              {session.name || "Untitled batch"}
            </h1>
            <p className="mt-2 text-sm text-[#625f58]">
              {session.cohort?.name || "Cohort"} · Captured {formatDate(captureDate)}
            </p>
          </div>
          {cohortId && (
            <Button asChild className="w-fit bg-[#454a9f] text-white hover:bg-[#383d86]">
              <Link href={`/cohorts/${cohortId}/batch`}>
                {recordsAreSaved ? <Plus className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                {recordsAreSaved ? "New batch" : "Resume review"}
              </Link>
            </Button>
          )}
        </div>
      </header>

      <section className={`border ${recordsAreSaved ? "border-[#cddfd4] bg-[#f6fbf7]" : "border-[#dfc3a7] bg-[#fff8ed]"}`}>
        <div className="grid gap-5 p-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${recordsAreSaved ? "bg-emerald-100 text-emerald-800" : "bg-[#ffe7c4] text-[#8d4834]"}`}>
            {recordsAreSaved ? <Check className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#77736c]">
              {recordsAreSaved ? "Saved to the study record" : "Action needed"}
            </p>
            <h2 className="mt-1 font-serif text-3xl text-[#292b4c]">
              {recordsAreSaved
                ? `${session.completedCount} scientist-confirmed record${session.completedCount === 1 ? "" : "s"}`
                : `${session.actionCount} photo${session.actionCount === 1 ? "" : "s"} still need review`}
            </h2>
            <p className="mt-1 text-sm text-[#625f58]">
              {recordsAreSaved
                ? "These stages were saved by a scientist after review."
                : "Confirm each subject, stage, and note before saving the batch."}
            </p>
          </div>
          <div className="flex gap-6 md:text-right">
            <div>
              <p className="text-2xl font-semibold text-[#292b4c]">{session.itemCount}</p>
              <p className="text-xs text-[#77736c]">photos</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-[#292b4c]">{session.subjectsLogged.length}</p>
              <p className="text-xs text-[#77736c]">subjects</p>
            </div>
          </div>
        </div>
        {recordsAreSaved && <StageSummary breakdown={session.stageBreakdown} />}
      </section>

      {recordsAreSaved && session.subjectsLogged.length > 0 && (
        <section className="border border-[#ded9cd] bg-white p-5" aria-labelledby="subjects-heading">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-[#625f58]" />
            <h2 id="subjects-heading" className="text-sm font-semibold text-[#292b4c]">Subjects in this batch</h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {session.subjectsLogged.map((subject) => (
              <Link
                key={subject.id}
                href={`/subjects/${subject.id}`}
                className="rounded-full border border-[#d5d0c5] bg-[#fbfaf7] px-3 py-1.5 text-sm text-[#353a87] hover:border-[#9b9dcc]"
              >
                {subject.name} · {subject.logCount}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="batch-photos-heading">
        <div className="mb-4 flex items-end justify-between gap-4 border-b border-[#d9d4c8] pb-3">
          <div>
            <p className="page-eyebrow">Visual record</p>
            <h2 id="batch-photos-heading" className="mt-1 font-serif text-3xl text-[#292b4c]">
              {recordsAreSaved ? "Saved observations" : "Photos awaiting review"}
            </h2>
          </div>
          <Microscope className="h-5 w-5 text-[#77736c]" />
        </div>
        {session.items.length > 0 ? (
          <PhotoGrid items={session.items} recordsAreSaved={recordsAreSaved} />
        ) : (
          <div className="border border-dashed border-[#cfc9bc] bg-[#fbfaf7] p-10 text-center text-sm text-[#625f58]">
            No photos are attached to this session.
          </div>
        )}
      </section>
    </div>
  );
}
