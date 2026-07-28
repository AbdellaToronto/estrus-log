"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Images,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScanSessionSummary } from "@/app/actions";

type Cohort = {
  id: string;
  name: string;
  description?: string | null;
};

const STAGE_LABELS: Record<string, string> = {
  Proestrus: "Proestrus",
  Estrus: "Estrus",
  Metestrus: "Metestrus",
  Diestrus: "Diestrus",
};

function formatCaptureDate(session: ScanSessionSummary) {
  const value = session.captureDate || session.created_at;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusPill({ session }: { session: ScanSessionSummary }) {
  const needsAction = session.actionCount > 0;

  if (session.workflowStatus === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800">
        <Check className="h-3 w-3" /> Saved
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff1dc] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9a4f35]">
      <AlertTriangle className="h-3 w-3" />
      {needsAction ? "Review needed" : "Preparing"}
    </span>
  );
}

function SessionRow({
  cohortId,
  session,
}: {
  cohortId: string;
  session: ScanSessionSummary;
}) {
  const needsAction = session.actionCount > 0;
  const destination = needsAction
    ? `/cohorts/${cohortId}/batch`
    : `/scans/${session.id}`;

  return (
    <article className="grid gap-5 px-5 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-2xl text-[#292b4c]">
            {session.name || "Untitled batch"}
          </h2>
          <StatusPill session={session} />
        </div>
        <p className="mt-1 text-sm text-[#625f58]">
          {formatCaptureDate(session)} · {session.itemCount} photo{session.itemCount === 1 ? "" : "s"}
        </p>

        {needsAction ? (
          <p className="mt-3 font-medium text-[#8d4834]">
            {session.actionCount} photo{session.actionCount === 1 ? "" : "s"} still need scientist review
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#625f58]">
            <span>{session.completedCount} saved record{session.completedCount === 1 ? "" : "s"}</span>
            {Object.entries(session.stageBreakdown).map(([stage, count]) => (
              <span key={stage}>
                {STAGE_LABELS[stage] || stage} {count}
              </span>
            ))}
          </div>
        )}
      </div>

      <Button
        asChild
        variant={needsAction ? "default" : "outline"}
        className={needsAction
          ? "w-full bg-[#454a9f] text-white hover:bg-[#383d86] md:w-auto"
          : "w-full border-[#b8b7e1] bg-white text-[#353a87] hover:bg-[#eeedf9] md:w-auto"}
      >
        <Link href={destination}>
          {needsAction ? "Resume review" : "View records"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </article>
  );
}

export function ScanHistoryClient({
  cohort,
  sessions,
}: {
  cohort: Cohort;
  sessions: ScanSessionSummary[];
}) {
  const orderedSessions = [...sessions].sort((a, b) => {
    if (a.actionCount > 0 && b.actionCount === 0) return -1;
    if (a.actionCount === 0 && b.actionCount > 0) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const totalPhotos = sessions.reduce((sum, session) => sum + session.itemCount, 0);
  const savedRecords = sessions.reduce((sum, session) => sum + session.completedCount, 0);
  const sessionsNeedingAction = sessions.filter((session) => session.actionCount > 0).length;

  return (
    <div className="page-shell space-y-6 pb-20">
      <header className="border-b border-[#d9d4c8] pb-6 pt-2">
        <Link
          href={`/cohorts/${cohort.id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#625f58] hover:text-[#353a87]"
        >
          <ArrowLeft className="h-4 w-4" /> {cohort.name}
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="page-eyebrow">Batch workflow</p>
            <h1 className="mt-2 font-serif text-4xl tracking-tight text-[#292b4c] sm:text-5xl">
              Batch history
            </h1>
            <p className="mt-2 text-sm text-[#625f58]">
              Resume unfinished reviews or open the records saved from a completed batch.
            </p>
          </div>
          <Button asChild className="w-fit bg-[#454a9f] text-white hover:bg-[#383d86]">
            <Link href={`/cohorts/${cohort.id}/batch`}>
              <Upload className="h-4 w-4" /> New batch
            </Link>
          </Button>
        </div>
      </header>

      {sessions.length === 0 ? (
        <section className="border border-dashed border-[#cfc9bc] bg-[#fbfaf7] px-6 py-14 text-center">
          <Images className="mx-auto h-8 w-8 text-[#85817a]" />
          <h2 className="mt-4 font-serif text-3xl text-[#292b4c]">No batches yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#625f58]">
            Start a batch when you have several external photos from the same collection date.
          </p>
          <Button asChild className="mt-6 bg-[#454a9f] text-white hover:bg-[#383d86]">
            <Link href={`/cohorts/${cohort.id}/batch`}>Start first batch</Link>
          </Button>
        </section>
      ) : (
        <>
          <section className="grid border border-[#ded9cd] bg-white sm:grid-cols-3" aria-label="Batch history summary">
            <div className="border-b border-[#ded9cd] p-5 sm:border-b-0 sm:border-r">
              <p className="text-3xl font-semibold text-[#292b4c]">{sessionsNeedingAction}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#77736c]">Need review</p>
            </div>
            <div className="border-b border-[#ded9cd] p-5 sm:border-b-0 sm:border-r">
              <p className="text-3xl font-semibold text-[#292b4c]">{savedRecords}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#77736c]">Saved records</p>
            </div>
            <div className="p-5">
              <p className="text-3xl font-semibold text-[#292b4c]">{totalPhotos}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#77736c]">Photos across batches</p>
            </div>
          </section>

          <section className="divide-y divide-[#ded9cd] border border-[#ded9cd] bg-white" aria-label="Batch sessions">
            {orderedSessions.map((session) => (
              <SessionRow key={session.id} cohortId={cohort.id} session={session} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}
