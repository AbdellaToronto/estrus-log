"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  MoreHorizontal,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EstrusIcon } from "@/components/estrus-icon";
import { createExperiment, deleteExperiment } from "@/app/actions";
import { cn } from "@/lib/utils";

type Experiment = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  experiment_cohorts?: { cohort_id: string }[];
};

const statusRank: Record<string, number> = { active: 0, planned: 1, completed: 2 };

function displayDate(value: string | null) {
  return value ? format(new Date(`${value}T12:00:00`), "MMM d, yyyy") : null;
}

export function ExperimentsClient({
  initialExperiments,
}: {
  initialExperiments: Experiment[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...initialExperiments].sort((left, right) => {
      const statusDifference = (statusRank[left.status || "planned"] ?? 3) - (statusRank[right.status || "planned"] ?? 3);
      if (statusDifference) return statusDifference;
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    }),
    [initialExperiments]
  );
  const current = sorted.filter((experiment) => experiment.status !== "completed");
  const completed = sorted.filter((experiment) => experiment.status === "completed");
  const attachedCohorts = initialExperiments.reduce(
    (sum, experiment) => sum + (experiment.experiment_cohorts?.length ?? 0),
    0
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    try {
      await createExperiment(new FormData(event.currentTarget));
      setOpen(false);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The experiment could not be created.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this experiment workspace? Source cohort records will remain unchanged.")) return;
    try {
      await deleteExperiment(id);
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("The experiment could not be deleted.");
    }
  };

  return (
    <div className="page-shell space-y-6 pb-20">
      <header className="border-b border-[#d9d4c8] pb-6 pt-2">
        <p className="page-eyebrow">Research organization</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-4xl tracking-tight text-[#292b4c] sm:text-5xl">Study workspaces</h1>
            <p className="mt-2 max-w-xl text-sm text-[#625f58]">Group cohorts for study-level review and reproducible export.</p>
          </div>
          <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) setFormError(null); }}>
            <DialogTrigger asChild>
              <Button className="w-fit bg-[#454a9f] text-white hover:bg-[#383d89]">
                <Plus className="h-4 w-4" />New experiment
              </Button>
            </DialogTrigger>
            <DialogContent className="border-[#ded9cd] bg-[#fbfaf7] sm:max-w-xl">
              <DialogHeader>
                <p className="page-eyebrow">New study workspace</p>
                <DialogTitle className="font-serif text-3xl text-[#292b4c]">Create an experiment</DialogTitle>
                <DialogDescription>Define the study window now. Attach the intended cohorts next.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="grid gap-5 pt-2">
                <div className="grid gap-2">
                  <Label htmlFor="name">Study name</Label>
                  <Input id="name" name="name" placeholder="Diet intervention · Cycle timing" required maxLength={160} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Study question or note <span className="font-normal text-[#77736c]">(optional)</span></Label>
                  <Textarea id="description" name="description" placeholder="What comparison or collection window does this workspace represent?" maxLength={1200} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="start_date">Start date <span className="font-normal text-[#77736c]">(optional)</span></Label>
                    <Input id="start_date" name="start_date" type="date" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="end_date">End date <span className="font-normal text-[#77736c]">(optional)</span></Label>
                    <Input id="end_date" name="end_date" type="date" />
                  </div>
                </div>
                {formError && <p role="alert" className="border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{formError}</p>}
                <div className="flex justify-end gap-2 border-t border-[#ded9cd] pt-4">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={loading} className="bg-[#454a9f] text-white hover:bg-[#383d89]">
                    {loading ? "Creating…" : "Create experiment"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Experiment summary">
        <Summary value={current.filter((experiment) => experiment.status === "active").length} label="active studies" />
        <Summary value={current.filter((experiment) => experiment.status !== "active").length} label="planned studies" />
        <Summary value={attachedCohorts} label="attached cohort slots" />
      </section>

      {current.length ? (
        <section aria-labelledby="current-studies-heading">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="page-eyebrow">Current work</p>
              <h2 id="current-studies-heading" className="mt-1 font-serif text-3xl text-[#292b4c]">Active and planned</h2>
            </div>
            <p className="text-xs text-[#625f58]">{current.length} {current.length === 1 ? "workspace" : "workspaces"}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {current.map((experiment) => (
              <ExperimentCard key={experiment.id} experiment={experiment} onDelete={handleDelete} />
            ))}
          </div>
        </section>
      ) : (
        <section className="border border-dashed border-[#cfc9bd] bg-[#fbfaf7] px-6 py-14 text-center">
          <EstrusIcon name="cycle" className="mx-auto h-16 w-16" />
          <h2 className="mt-4 font-serif text-2xl text-[#292b4c]">Create the first study workspace</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#625f58]">Experiments group existing cohorts without copying or changing their source records.</p>
          <Button onClick={() => setOpen(true)} className="mt-5 bg-[#454a9f] text-white hover:bg-[#383d89]">Create experiment</Button>
        </section>
      )}

      {completed.length > 0 && (
        <details className="group border border-[#ded9cd] bg-[#fbfaf7]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-[#4f4b45]">
            <span>Completed studies · {completed.length}</span>
            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
          </summary>
          <div className="grid gap-4 border-t border-[#ded9cd] p-5 lg:grid-cols-2">
            {completed.map((experiment) => (
              <ExperimentCard key={experiment.id} experiment={experiment} onDelete={handleDelete} compact />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Summary({ value, label }: { value: number; label: string }) {
  return (
    <div className="border border-[#ded9cd] bg-[#fbfaf7] px-4 py-3">
      <span className="font-serif text-2xl text-[#292b4c]">{value}</span>
      <span className="ml-2 text-xs text-[#625f58]">{label}</span>
    </div>
  );
}

function ExperimentCard({
  experiment,
  onDelete,
  compact = false,
}: {
  experiment: Experiment;
  onDelete: (id: string) => void;
  compact?: boolean;
}) {
  const start = displayDate(experiment.start_date);
  const end = displayDate(experiment.end_date);
  const cohortCount = experiment.experiment_cohorts?.length ?? 0;
  const status = experiment.status || "planned";

  return (
    <article className="relative border border-[#ded9cd] bg-white p-5 transition hover:border-[#b8b7e1]">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eeedf9]">
          <EstrusIcon name="cycle" className="h-10 w-10" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn(
              "capitalize",
              status === "active" && "border-emerald-200 bg-emerald-50 text-emerald-800",
              status === "planned" && "border-[#c9c7e7] bg-[#eeedf9] text-[#454a9f]",
              status === "completed" && "border-[#ded9cd] bg-[#f0ede5] text-[#625f58]"
            )}>{status}</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-[#625f58]"><Users className="h-3.5 w-3.5" />{cohortCount} {cohortCount === 1 ? "cohort" : "cohorts"}</span>
          </div>
          <h3 className="mt-3 font-serif text-2xl text-[#292b4c]">{experiment.name}</h3>
          {!compact && experiment.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#625f58]">{experiment.description}</p>}
        </div>
        <details className="group/actions relative">
          <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-[#77736c] hover:bg-[#f0ede5]" aria-label={`Actions for ${experiment.name}`}>
            <MoreHorizontal className="h-4 w-4" />
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-44 border border-[#ded9cd] bg-white p-1 shadow-xl">
            <button type="button" onClick={() => onDelete(experiment.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50">
              <Trash2 className="h-4 w-4" />Delete workspace
            </button>
          </div>
        </details>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-[#ded9cd] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-2 text-xs text-[#625f58]">
          <CalendarDays className="h-4 w-4" />
          {start ? `${start}${end ? ` – ${end}` : " – ongoing"}` : "Study window not set"}
        </p>
        <Button asChild variant="ghost" className="h-9 w-fit text-[#454a9f] hover:bg-[#eeedf9] hover:text-[#353a87]">
          <Link href={`/experiments/${experiment.id}`}>Open workspace <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </div>
    </article>
  );
}
