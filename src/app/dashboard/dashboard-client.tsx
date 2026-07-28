"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  History,
  Images,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StageTrendChart } from "@/components/dashboard/stage-trend-chart";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { OnboardingFlow } from "@/components/onboarding";
import { StageDistribution } from "@/components/prediction/stage-distribution";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/app/actions";
import type { Cohort } from "@/lib/types";

function queueGroup(item: DashboardStats["predictionQueue"][number]) {
  if (item.abstained) return "abstained";
  if (item.reviewRequired || item.support < 0.6) return "attention";
  return "ready";
}

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
  const [selectedId, setSelectedId] = useState(stats.predictionQueue[0]?.id ?? null);
  const todayKey = todayKeyOverride || format(new Date(), "yyyy-MM-dd");
  const todayLabel = format(new Date(`${todayKey}T12:00:00`), "EEEE, MMMM d");

  const grouped = useMemo(() => {
    const ready = stats.predictionQueue.filter((item) => queueGroup(item) === "ready");
    const attention = stats.predictionQueue.filter((item) => queueGroup(item) === "attention");
    const abstained = stats.predictionQueue.filter((item) => queueGroup(item) === "abstained");
    return { ready, attention, abstained };
  }, [stats.predictionQueue]);
  const selected =
    stats.predictionQueue.find((item) => item.id === selectedId) ??
    stats.predictionQueue[0] ??
    null;

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
        <p className="page-eyebrow">{todayLabel} · AI review workspace</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-serif text-4xl tracking-tight text-[#292b4c] sm:text-5xl">
              Prediction inbox
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625f58]">
              The model has analyzed today&apos;s photographs. Accept strong predictions, inspect exceptions, and let Estrus Log build the record.
            </p>
          </div>
          <Button asChild className="w-fit bg-[#454a9f] text-white hover:bg-[#383d89]">
            <Link href={initialCohorts[0] ? `/cohorts/${initialCohorts[0].id}/batch` : "/cohorts"}>
              <UploadCloud className="h-4 w-4" />
              Analyze photographs
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid border border-[#ded9cd] bg-white sm:grid-cols-4" aria-label="Prediction queue summary">
        {[
          ["Analyzed", stats.predictionQueue.length, "Prepared by AI"],
          ["Ready", grouped.ready.length, "Strong proposals"],
          ["Need review", grouped.attention.length, "Close or flagged"],
          ["AI abstained", grouped.abstained.length, "Scientist decision"],
        ].map(([label, value, caption], index) => (
          <div
            key={String(label)}
            className={cn("p-4 sm:p-5", index > 0 && "border-t border-[#ded9cd] sm:border-l sm:border-t-0")}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#625f58]">{label}</p>
            <p className="mt-2 font-serif text-3xl text-[#292b4c]">{value}</p>
            <p className="mt-1 text-xs text-[#625f58]">{caption}</p>
          </div>
        ))}
      </section>

      {selected ? (
        <section className="grid min-h-[590px] border border-[#ded9cd] bg-white xl:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="order-2 border-t border-[#ded9cd] bg-[#fbfaf7] xl:order-1 xl:border-r xl:border-t-0">
            {([
              ["ready", "Ready to accept", grouped.ready],
              ["attention", "Needs attention", grouped.attention],
              ["abstained", "AI abstained", grouped.abstained],
            ] as const).map(([key, title, items]) => (
              <div key={key} className="border-b border-[#ded9cd] last:border-b-0">
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#625f58]">{title}</p>
                  <span className="text-xs font-semibold text-[#555a9d]">{items.length}</span>
                </div>
                {items.length > 0 ? (
                  <div className="divide-y divide-[#e8e3da] border-t border-[#e8e3da]">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={cn(
                          "grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition",
                          selected.id === item.id ? "bg-[#eeedf9]" : "hover:bg-white"
                        )}
                      >
                        <div className="relative h-11 w-11 overflow-hidden bg-[#eeeae2]">
                          {item.imageUrl ? (
                            <Image src={item.imageUrl} alt="" fill className="object-cover" sizes="44px" />
                          ) : (
                            <Images className="absolute inset-0 m-auto h-4 w-4 text-[#aaa59b]" />
                          )}
                        </div>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-[#292b4c]">{item.subjectName}</span>
                          <span className="mt-0.5 block truncate text-xs text-[#625f58]">{item.stage}</span>
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-[#555a9d]">
                          {Math.round(item.support * 100)}%
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="border-t border-[#e8e3da] px-4 py-4 text-xs text-[#625f58]">No predictions in this group.</p>
                )}
              </div>
            ))}
          </aside>

          <div className="order-1 grid min-w-0 lg:grid-cols-[minmax(0,1fr)_340px] xl:order-2">
            <div className="flex min-w-0 flex-col">
              <div className="border-b border-[#ded9cd] p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="page-eyebrow">{selected.subjectName} · {selected.cohortName}</p>
                    <h2 className="mt-2 font-serif text-3xl text-[#292b4c] sm:text-4xl">
                      AI predicts {selected.stage}
                    </h2>
                  </div>
                  <div className="border border-[#c9c7e7] bg-[#eeedf9] px-4 py-3 text-right">
                    <p className="text-2xl font-semibold text-[#353a87]">{Math.round(selected.support * 100)}%</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#454a9f]">model support</p>
                  </div>
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#625f58]">
                  Review the image and recent cycle context. Accept the proposed stage or correct it before the scientific record is saved.
                </p>
              </div>

              <div className="flex-1 p-5 sm:p-7">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#625f58]">All stage scores</p>
                  <span className="text-[10px] text-[#625f58]">relative model support</span>
                </div>
                <StageDistribution
                  className="mt-5 max-w-2xl"
                  scores={selected.scores}
                  predictedStage={selected.stage}
                />

                <div
                  className={cn(
                    "mt-7 flex gap-3 border p-4",
                    selected.abstained || selected.reviewRequired
                      ? "border-[#e2bf95] bg-[#fff7e9] text-[#7d4a2f]"
                      : "border-[#cddfd4] bg-[#f3faf5] text-[#356449]"
                  )}
                >
                  {selected.abstained || selected.reviewRequired ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {selected.abstained
                        ? "Independent guardrail abstained"
                        : selected.reviewRequired
                          ? "Prediction needs a closer look"
                          : "Independent cycle-family guardrail agrees"}
                    </p>
                    <p className="mt-1 text-xs leading-5 opacity-85">
                      {selected.abstained || selected.reviewRequired
                        ? "The four-stage proposal is still visible, but Estrus Log will not treat it as ready for quick acceptance."
                        : "The model's exact-stage proposal and the independently evaluated early/late check point in the same direction."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-[#ded9cd] p-4 sm:flex-row sm:justify-end">
                <Button asChild variant="outline" className="min-h-11 border-[#cbc6bb] bg-white text-[#45413c] hover:bg-[#f6f3ec]">
                  <Link href={`/cohorts/${selected.cohortId}/batch`}>Correct prediction</Link>
                </Button>
                <Button asChild className="min-h-11 bg-[#454a9f] text-white hover:bg-[#383d89]">
                  <Link href={`/cohorts/${selected.cohortId}/batch`}>
                    Review and accept {selected.stage}<ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <aside className="border-t border-[#ded9cd] bg-[#f7f4ed] p-5 lg:border-l lg:border-t-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#625f58]">Supporting photograph</p>
              <div className="relative mt-4 aspect-[3/4] overflow-hidden border border-[#d9d4c8] bg-[#e9e5dd]">
                {selected.imageUrl ? (
                  <Image src={selected.imageUrl} alt={`Prepared observation for ${selected.subjectName}`} fill className="object-contain" sizes="340px" />
                ) : (
                  <Images className="absolute inset-0 m-auto h-8 w-8 text-[#aaa59b]" />
                )}
              </div>
              <div className="mt-4 border-t border-[#d9d4c8] pt-4">
                <p className="text-sm font-semibold text-[#292b4c]">{selected.subjectName}</p>
                <p className="mt-1 text-xs text-[#625f58]">{selected.cohortName}</p>
                <p className="mt-3 text-xs leading-5 text-[#625f58]">
                  Prepared crop shown exactly as analyzed. Open the batch review to inspect or correct the crop.
                </p>
              </div>
            </aside>
          </div>
        </section>
      ) : (
        <section className="border border-[#cddfd4] bg-[#f6fbf7] p-7 sm:p-10">
          <Check className="h-6 w-6 text-emerald-700" />
          <h2 className="mt-4 font-serif text-3xl text-[#292b4c]">The prediction inbox is clear</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#625f58]">
            Upload today&apos;s photographs and Estrus Log will prepare stage proposals for review.
          </p>
          {initialCohorts[0] && (
            <Button asChild className="mt-5 bg-[#454a9f] text-white hover:bg-[#383d89]">
              <Link href={`/cohorts/${initialCohorts[0].id}/batch`}>
                <UploadCloud className="h-4 w-4" />Analyze a batch
              </Link>
            </Button>
          )}
        </section>
      )}

      <section className="border border-[#ded9cd] bg-[#fbfaf7] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="page-eyebrow">Daily coverage</p>
            <h2 className="mt-1 font-serif text-2xl text-[#292b4c]">
              {stats.todaysScans} confirmed records · {stats.totalSubjects} active mice
            </h2>
            <p className="mt-1 text-sm text-[#625f58]">Confirmed observations stay separate from pending AI proposals.</p>
          </div>
          <Button asChild variant="outline" className="w-fit border-[#b8b7e1] bg-white text-[#353a87] hover:bg-[#eeedf9]">
            <Link href="/cohorts">Open cohorts <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <details className="group border border-[#ded9cd] bg-[#fbfaf7]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-[#4f4b45]">
          <span className="flex items-center gap-2"><History className="h-4 w-4" />Confirmed history and 7-day stage mix</span>
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
