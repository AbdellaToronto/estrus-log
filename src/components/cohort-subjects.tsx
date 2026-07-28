"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EstrusIcon } from "@/components/estrus-icon";
import { CalendarDays, Check, ChevronDown, Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUBJECT_COAT_COLOUR_LABELS } from "@/lib/subject-metadata";

interface Subject {
  id: string;
  name: string;
  coat_colour?: string | null;
  strain?: string | null;
  status?: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

interface Log {
  id: string;
  mouse_id: string | null;
  stage: string;
  created_at: string;
  capture_date?: string | null;
  image_url?: string | null;
}

type SubjectWithStats = Subject & {
  logs: Log[];
  lastLog?: Log;
  todayLog?: Log;
  stageBreakdown: Record<string, number>;
  recentStages: string[];
};

type ReviewFilter = "needs-observation" | "all" | "recorded";

const STAGE_CLASSES: Record<string, string> = {
  Proestrus: "stage-proestrus",
  Estrus: "stage-estrus",
  Metestrus: "stage-metestrus",
  Diestrus: "stage-diestrus",
  "Uncertain / transition": "stage-unknown",
};

const dateKey = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : format(date, "yyyy-MM-dd");
};

export function CohortSubjects({
  subjects,
  logs,
  todayKey: todayKeyOverride,
  onAddSubject,
  onSubjectOpen,
}: {
  subjects: Subject[];
  logs: Log[];
  todayKey?: string;
  onAddSubject?: () => void;
  onSubjectOpen?: (subject: SubjectWithStats) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("needs-observation");
  const todayKey = todayKeyOverride || format(new Date(), "yyyy-MM-dd");
  const todayLabel = format(new Date(`${todayKey}T12:00:00`), "EEEE, MMMM d");

  const subjectsWithStats = useMemo<SubjectWithStats[]>(() => {
    const logsBySubject = new Map<string, Log[]>();
    logs.forEach((log) => {
      if (!log.mouse_id) return;
      const existing = logsBySubject.get(log.mouse_id) ?? [];
      existing.push(log);
      logsBySubject.set(log.mouse_id, existing);
    });

    return subjects
      .map((subject) => {
        const subjectLogs = [...(logsBySubject.get(subject.id) ?? [])].sort(
          (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
        );
        const stageBreakdown = subjectLogs.reduce<Record<string, number>>((counts, log) => {
          counts[log.stage] = (counts[log.stage] ?? 0) + 1;
          return counts;
        }, {});
        return {
          ...subject,
          logs: subjectLogs,
          lastLog: subjectLogs[0],
          todayLog: subjectLogs.find((log) => dateKey(log.capture_date || log.created_at) === todayKey),
          stageBreakdown,
          recentStages: subjectLogs.slice(0, 5).map((log) => log.stage),
        };
      })
      .sort((left, right) => {
        if (Boolean(left.todayLog) !== Boolean(right.todayLog)) return left.todayLog ? 1 : -1;
        return left.name.localeCompare(right.name, undefined, { numeric: true });
      });
  }, [logs, subjects, todayKey]);

  const recordedToday = subjectsWithStats.filter((subject) => subject.todayLog).length;
  const remaining = Math.max(0, subjects.length - recordedToday);
  const progress = subjects.length ? Math.round((recordedToday / subjects.length) * 100) : 0;
  const filteredSubjects = subjectsWithStats.filter((subject) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !query ||
      subject.name.toLowerCase().includes(query) ||
      subject.strain?.toLowerCase().includes(query) ||
      (subject.coat_colour &&
        SUBJECT_COAT_COLOUR_LABELS[
          subject.coat_colour as keyof typeof SUBJECT_COAT_COLOUR_LABELS
        ]?.toLowerCase().includes(query));
    const matchesReview =
      reviewFilter === "all" ||
      (reviewFilter === "recorded" ? Boolean(subject.todayLog) : !subject.todayLog);
    return matchesSearch && matchesReview;
  });

  if (subjects.length === 0) {
    return (
      <div className="border border-[#ded9cd] bg-[#fbfaf7] px-6 py-14 text-center">
        <EstrusIcon name="animal-subject" className="mx-auto h-16 w-16" />
        <h2 className="mt-4 font-serif text-2xl text-[#292b4c]">Add the first mouse</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#625f58]">
          A subject is required before an observation can become part of the lab record.
        </p>
        {onAddSubject && (
          <Button onClick={onAddSubject} className="mt-6 bg-[#454a9f] text-white hover:bg-[#383d89]">
            <UserPlus className="mr-2 h-4 w-4" />
            Add first mouse
          </Button>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-5" aria-labelledby="today-review-heading">
      <div className="grid gap-4 border border-[#ded9cd] bg-[#fbfaf7] p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#66627a]">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            {todayLabel}
          </div>
          <h2 id="today-review-heading" className="mt-2 font-serif text-3xl text-[#292b4c]">
            Today&apos;s observations
          </h2>
          <div className="mt-4 h-2 max-w-xl overflow-hidden rounded-full bg-[#e7e2d7]">
            <div className="h-full rounded-full bg-[#454a9f] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm text-[#625f58]">
            {recordedToday} of {subjects.length} recorded
          </p>
        </div>
        <div className={cn(
          "min-w-32 border px-4 py-3 text-center",
          remaining ? "border-[#d8b28d] bg-[#fff4df]" : "border-emerald-200 bg-emerald-50"
        )}>
          <p className={cn("text-3xl font-semibold", remaining ? "text-[#9a4f35]" : "text-emerald-800")}>
            {remaining || <Check className="mx-auto h-7 w-7" />}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#625f58]">
            {remaining ? "remaining" : "complete"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex w-fit rounded-xl border border-[#ded9cd] bg-[#f0ede5] p-1" aria-label="Filter daily observations">
          {([
            ["needs-observation", `Needs observation · ${remaining}`],
            ["recorded", `Recorded · ${recordedToday}`],
            ["all", `All · ${subjects.length}`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={reviewFilter === value}
              onClick={() => setReviewFilter(value)}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-semibold transition",
                reviewFilter === value ? "bg-white text-[#292b4c] shadow-sm" : "text-[#6a675f] hover:text-[#292b4c]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#77736c]" aria-hidden="true" />
          <Input
            aria-label="Search mice"
            placeholder="Find a mouse"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="border-[#ded9cd] bg-white pl-9"
          />
        </div>
      </div>

      <div className="divide-y divide-[#ded9cd] border border-[#ded9cd] bg-white">
        {filteredSubjects.map((subject) => {
          const metadataMissing = !subject.coat_colour || !subject.strain;
          return (
            <article key={subject.id} className="grid gap-4 p-4 transition hover:bg-[#fbfaf7] md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5">
              <div
                onClick={() => onSubjectOpen?.(subject)}
                onKeyDown={(event) => {
                  if (onSubjectOpen && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    onSubjectOpen(subject);
                  }
                }}
                role={onSubjectOpen ? "button" : undefined}
                tabIndex={onSubjectOpen ? 0 : undefined}
                className={cn("flex min-w-0 items-start gap-3 text-left", onSubjectOpen && "group cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#454a9f] focus-visible:ring-offset-2")}
                aria-label={onSubjectOpen ? `Open ${subject.name} profile` : undefined}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eeedf9]">
                  <EstrusIcon name="animal-subject" className="h-9 w-9" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={cn("font-semibold text-[#292b4c]", onSubjectOpen && "group-hover:text-[#454a9f]")}>{subject.name}</h3>
                    {subject.todayLog ? (
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
                        Recorded · {subject.todayLog.stage}
                      </Badge>
                    ) : (
                      <Badge className="border-[#d8b28d] bg-[#fff4df] text-[#8b4a32] hover:bg-[#fff4df]">Due today</Badge>
                    )}
                    {metadataMissing && (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Metadata needed</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#77736c]">
                    <span>{subject.logs.length} observations</span>
                    {subject.lastLog && <span>Last {format(new Date(subject.lastLog.created_at), "MMM d")}</span>}
                    {subject.coat_colour && (
                      <span>{SUBJECT_COAT_COLOUR_LABELS[subject.coat_colour as keyof typeof SUBJECT_COAT_COLOUR_LABELS] || subject.coat_colour}</span>
                    )}
                    {subject.strain && <span>{subject.strain}</span>}
                  </div>
                  {subject.recentStages.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5" aria-label={`Recent stages: ${subject.recentStages.join(", ")}`}>
                      {subject.recentStages.map((stage, index) => (
                        <span key={`${stage}-${index}`} className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STAGE_CLASSES[stage] || "stage-unknown")}>
                          {stage}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 md:justify-end">
                <details className="group relative">
                  <summary className="flex h-9 cursor-pointer list-none items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[#625f58] hover:bg-[#f0ede5]">
                    History <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
                  </summary>
                  <div className="absolute right-0 z-20 mt-2 w-56 border border-[#ded9cd] bg-white p-3 shadow-xl">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#77736c]">Saved stages</p>
                    <div className="mt-2 space-y-1.5">
                      {Object.entries(subject.stageBreakdown).length ? Object.entries(subject.stageBreakdown).map(([stage, count]) => (
                        <div key={stage} className="flex items-center justify-between text-xs text-[#4f4b45]"><span>{stage}</span><span className="font-semibold">{count}</span></div>
                      )) : <p className="text-xs text-[#77736c]">No observations yet.</p>}
                    </div>
                  </div>
                </details>
                {onSubjectOpen ? (
                  <Button onClick={() => onSubjectOpen(subject)} className={cn("h-9", subject.todayLog ? "bg-[#eeedf9] text-[#353a87] hover:bg-[#deddf3]" : "bg-[#454a9f] text-white hover:bg-[#383d89]")}>
                    {subject.todayLog ? "View profile" : "Review today"}
                  </Button>
                ) : (
                  <Button asChild className={cn("h-9", subject.todayLog ? "bg-[#eeedf9] text-[#353a87] hover:bg-[#deddf3]" : "bg-[#454a9f] text-white hover:bg-[#383d89]")}>
                    <Link href={subject.todayLog ? `/subjects/${subject.id}` : `/subjects/${subject.id}?new=1`}>
                      {subject.todayLog ? "View record" : "Record observation"}
                    </Link>
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {filteredSubjects.length === 0 && (
        <div className="border border-dashed border-[#cfc9bd] bg-[#fbfaf7] py-10 text-center text-sm text-[#625f58]">
          No mice match this view.
        </div>
      )}
    </section>
  );
}
