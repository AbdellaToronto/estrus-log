"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  Check,
  ChevronDown,
  History,
  ListChecks,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StageTrendChart } from "@/components/dashboard/stage-trend-chart";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { OnboardingFlow } from "@/components/onboarding";
import { EstrusIcon } from "@/components/estrus-icon";
import { cn } from "@/lib/utils";
import { SUBJECT_COAT_COLOUR_LABELS } from "@/lib/subject-metadata";
import type { DashboardStats } from "@/app/actions";
import type { Cohort } from "@/lib/types";

export function DashboardClient({
  initialCohorts,
  stats,
  todayKey: todayKeyOverride,
  renderedAt,
}: {
  initialCohorts: Cohort[];
  stats: DashboardStats;
  todayKey?: string;
  renderedAt: string;
}) {
  const [showOnboarding, setShowOnboarding] = useState(() => initialCohorts.length === 0);
  const todayKey = todayKeyOverride || format(new Date(), "yyyy-MM-dd");
  const todayLabel = format(new Date(`${todayKey}T12:00:00`), "EEEE, MMMM d");

  const daily = useMemo(() => {
    const total = stats.cohortProgress.reduce((sum, cohort) => sum + cohort.totalSubjects, 0);
    const recorded = stats.cohortProgress.reduce((sum, cohort) => sum + cohort.recordedToday, 0);
    return {
      total,
      recorded,
      remaining: Math.max(0, total - recorded),
      percentage: total ? Math.round((recorded / total) * 100) : 0,
    };
  }, [stats.cohortProgress]);

  if (showOnboarding) {
    return (
      <OnboardingFlow
        onComplete={() => {
          setShowOnboarding(false);
          window.location.reload();
        }}
      />
    );
  }

  return (
    <div className="page-shell space-y-6 pb-20">
      <header className="border-b border-[#d9d4c8] pb-6 pt-2">
        <p className="page-eyebrow">{todayLabel}</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-serif text-4xl tracking-tight text-[#292b4c] sm:text-5xl">Daily lab briefing</h1>
            <p className="mt-2 text-sm text-[#625f58]">Finish today&apos;s mouse observations to keep each cohort&apos;s record continuous.</p>
          </div>
          <Button asChild variant="outline" className="w-fit border-[#b8b7e1] bg-white text-[#353a87] hover:bg-[#eeedf9]">
            <Link href="/cohorts">All cohorts <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]" aria-labelledby="daily-work-heading" data-tour="daily-brief">
        <div className="border border-[#ded9cd] bg-white">
          <div className="grid gap-5 border-b border-[#ded9cd] bg-[#fbfaf7] p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#66627a]">Daily observations</p>
              <h2 id="daily-work-heading" className="mt-1 font-serif text-3xl text-[#292b4c]">
                {daily.remaining ? `${daily.remaining} mice still need a record` : "Daily record complete"}
              </h2>
              <div className="mt-4 h-2 max-w-2xl overflow-hidden rounded-full bg-[#e7e2d7]">
                <div className="h-full rounded-full bg-[#454a9f]" style={{ width: `${daily.percentage}%` }} />
              </div>
              <p className="mt-2 text-sm text-[#625f58]">{daily.recorded} of {daily.total} active mice recorded</p>
            </div>
            <div className={cn(
              "min-w-32 border px-5 py-4 text-center",
              daily.remaining ? "border-[#d8b28d] bg-[#fff4df]" : "border-emerald-200 bg-emerald-50"
            )}>
              {daily.remaining ? (
                <p className="text-4xl font-semibold text-[#9a4f35]">{daily.remaining}</p>
              ) : (
                <Check className="mx-auto h-8 w-8 text-emerald-800" />
              )}
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#625f58]">
                {daily.remaining ? "remaining" : "complete"}
              </p>
            </div>
          </div>

          <div className="divide-y divide-[#ded9cd]">
            {stats.cohortProgress.map((cohort) => {
              const percentage = cohort.totalSubjects
                ? Math.round((cohort.recordedToday / cohort.totalSubjects) * 100)
                : 0;
              const hasActiveSubjects = cohort.totalSubjects > 0;
              const complete = hasActiveSubjects && cohort.remaining === 0;
              return (
                <article key={cohort.id}>
                  <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eeedf9]">
                        <EstrusIcon name="animal-subject" className="h-9 w-9" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-[#292b4c]">{cohort.name}</h3>
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                            complete ? "bg-emerald-50 text-emerald-800" : "bg-[#fff4df] text-[#8b4a32]"
                          )}>
                            {!hasActiveSubjects ? "No active mice" : complete ? "Complete" : `${cohort.remaining} due`}
                          </span>
                        </div>
                        <div className="mt-2 flex max-w-lg items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e7e2d7]">
                            <div className="h-full rounded-full bg-[#454a9f]" style={{ width: `${percentage}%` }} />
                          </div>
                          <span className="text-xs font-medium text-[#625f58]">{cohort.recordedToday}/{cohort.totalSubjects}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {hasActiveSubjects && (
                        <Button asChild variant="ghost" className="h-9 text-[#625f58] hover:bg-[#f0ede5]">
                          <Link href={`/cohorts/${cohort.id}/batch`}><UploadCloud className="h-4 w-4" />Bulk</Link>
                        </Button>
                      )}
                      <Button asChild className="h-9 bg-[#eeedf9] text-[#353a87] hover:bg-[#deddf3]">
                        <Link href={`/cohorts/${cohort.id}`}>
                          Open cohort<ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {cohort.dueSubjects.length > 0 && (
                    <div className="border-t border-[#ded9cd] bg-[#fffdf9]" data-tour="continue-cohort">
                      <div className="flex items-center justify-between px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#77736c]">
                        <span>Next to record</span>
                        <span>{cohort.dueSubjects.length} due</span>
                      </div>
                      <div className="divide-y divide-[#ebe6dc] border-t border-[#ebe6dc]">
                        {cohort.dueSubjects.map((subject, index) => {
                          const coatLabel = subject.coatColour
                            ? SUBJECT_COAT_COLOUR_LABELS[
                                subject.coatColour as keyof typeof SUBJECT_COAT_COLOUR_LABELS
                              ] || subject.coatColour
                            : null;
                          return (
                            <div key={subject.id} className="grid gap-3 px-5 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eeedf9] text-xs font-bold text-[#454a9f]">
                                {index + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="font-semibold text-[#292b4c]">{subject.name}</p>
                                <p className="mt-0.5 truncate text-xs text-[#77736c]">
                                  {[subject.strain, coatLabel].filter(Boolean).join(" · ") || "Research metadata not added"}
                                </p>
                              </div>
                              <Button asChild className="h-9 bg-[#454a9f] text-white hover:bg-[#383d89]">
                                <Link href={`/subjects/${subject.id}?new=1`}>
                                  Record<ArrowRight className="h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="border border-[#ded9cd] bg-[#fbfaf7] p-5">
            <div className="flex items-center gap-2 text-[#66627a]">
              <ListChecks className="h-4 w-4" />
              <p className="text-[10px] font-bold uppercase tracking-[0.18em]">Today&apos;s receipt</p>
            </div>
            <p className="mt-3 font-serif text-3xl text-[#292b4c]">{stats.todaysScans}</p>
            <p className="mt-1 text-sm text-[#625f58]">saved observations captured today</p>
          </section>

          <details className="group border border-[#c9c7e7] bg-[#eeedf9] p-5" data-tour="model-policy">
            <summary className="cursor-pointer list-none">
              <EstrusIcon name="evidence" className="h-10 w-10" />
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#555a9d]">After a crop is confirmed</p>
              <h2 className="mt-1 font-serif text-xl text-[#292b4c]">How model assistance works</h2>
            </summary>
            <p className="mt-3 border-t border-[#c9c7e7] pt-3 text-xs leading-5 text-[#5e5d75]">A confirmed external-photo crop may receive an early-or-late lead, or the model may abstain. It never fills the saved four-stage record.</p>
          </details>
        </aside>
      </section>

      <details className="group border border-[#ded9cd] bg-[#fbfaf7]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-[#4f4b45]">
          <span className="flex items-center gap-2"><History className="h-4 w-4" />Recent activity and 7-day stage mix</span>
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-5 border-t border-[#ded9cd] p-5 xl:grid-cols-2">
          <StageTrendChart data={stats.dailyTrend} />
          <RecentActivity activities={stats.recentActivity} renderedAt={renderedAt} />
        </div>
      </details>
    </div>
  );
}
