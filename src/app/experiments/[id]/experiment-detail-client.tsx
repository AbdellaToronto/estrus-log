"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Download,
  FolderCog,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import {
  addCohortToExperiment,
  deleteExperiment,
  getExperimentExportData,
  removeCohortFromExperiment,
  type ExperimentInsights,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Cohort = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
};

type Experiment = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  experiment_cohorts: {
    cohort_id: string;
    cohorts: Cohort | null;
  }[];
};

type VisualizationLog = {
  id: string;
  mouse_id: string | null;
  cohort_id?: string | null;
  stage: string;
  date: string;
  capture_date?: string | null;
  modality?: string | null;
  label_status?: string | null;
  confirmation_source?: string | null;
  reference_modality?: string | null;
  binary_decision_status?: string | null;
  binary_group_suggestion?: string | null;
};

type VisualizationData = {
  cohorts: {
    id: string;
    name: string;
    color: string;
    mice: { id: string; name: string }[];
  }[];
  logs: VisualizationLog[];
};

const STAGE_STYLES: Record<string, string> = {
  Proestrus: "stage-proestrus",
  Estrus: "stage-estrus",
  Metestrus: "stage-metestrus",
  Diestrus: "stage-diestrus",
};

const STAGE_CELL_STYLES: Record<string, string> = {
  Proestrus: "bg-violet-200 text-violet-950 ring-violet-300",
  Estrus: "bg-rose-200 text-rose-950 ring-rose-300",
  Metestrus: "bg-amber-200 text-amber-950 ring-amber-300",
  Diestrus: "bg-sky-200 text-sky-950 ring-sky-300",
};

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function enumerateDates(start: string, end: string) {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function readableSource(source?: string | null) {
  if (source === "paired_cytology_review") return "Paired cytology";
  if (source === "scientist_batch_review") return "Scientist · batch";
  if (source === "scientist_review") return "Scientist · single";
  return "Legacy / unspecified";
}

function readableBinaryReview(log: VisualizationLog) {
  if (log.binary_decision_status === "abstain") return "Abstained";
  if (log.binary_decision_status === "reference_backed_suggestion") {
    return log.binary_group_suggestion === "PROESTRUS_OR_ESTRUS"
      ? "Early-group suggestion"
      : "Late-group suggestion";
  }
  return "Not run";
}

function downloadCsv(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header] == null ? "" : String(row[header]);
          return /[",\n]/.test(value)
            ? `"${value.replaceAll('"', '""')}"`
            : value;
        })
        .join(",")
    ),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ExperimentDetailClient({
  experiment,
  allCohorts,
  insights,
  visualizationData,
}: {
  experiment: Experiment;
  allCohorts: Cohort[];
  insights: ExperimentInsights;
  visualizationData: VisualizationData;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("summary");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [busy, setBusy] = useState(false);

  const existingCohortIds = useMemo(
    () => new Set(experiment.experiment_cohorts.map((item) => item.cohort_id)),
    [experiment.experiment_cohorts]
  );
  const availableCohorts = allCohorts.filter(
    (cohort) => !existingCohortIds.has(cohort.id)
  );

  const mouseLookup = useMemo(() => {
    const lookup = new Map<string, { name: string; cohortName: string }>();
    visualizationData.cohorts.forEach((cohort) => {
      cohort.mice.forEach((mouse) =>
        lookup.set(mouse.id, { name: mouse.name, cohortName: cohort.name })
      );
    });
    return lookup;
  }, [visualizationData.cohorts]);

  const atlasDates = useMemo(() => {
    if (insights.dateRange) {
      return enumerateDates(insights.dateRange.start, insights.dateRange.end);
    }
    return Array.from(new Set(visualizationData.logs.map((log) => log.date))).sort();
  }, [insights.dateRange, visualizationData.logs]);

  const atlasRows = useMemo(() => {
    const logMap = new Map(
      visualizationData.logs.map((log) => [`${log.mouse_id}|${log.date}`, log])
    );
    return visualizationData.cohorts.map((cohort) => ({
      ...cohort,
      mice: cohort.mice.map((mouse) => ({
        ...mouse,
        cells: atlasDates.map((date) => ({
          date,
          log: logMap.get(`${mouse.id}|${date}`),
        })),
      })),
    }));
  }, [atlasDates, visualizationData]);

  const expectedRecords = Math.max(insights.totalSubjects * atlasDates.length, 0);
  const coverage = expectedRecords
    ? Math.round((insights.totalLogs / expectedRecords) * 100)
    : 0;
  const reviewedByBinary = insights.binarySuggestions + insights.binaryAbstentions;

  async function addCohort() {
    if (!selectedCohortId) return;
    setBusy(true);
    try {
      await addCohortToExperiment(experiment.id, selectedCohortId);
      setSelectedCohortId("");
      setScopeOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeCohort(cohortId: string) {
    if (
      !window.confirm(
        "Remove this cohort from the study workspace? Its subjects and observations remain unchanged in the cohort record."
      )
    ) {
      return;
    }
    await removeCohortFromExperiment(experiment.id, cohortId);
    router.refresh();
  }

  async function exportManifest() {
    setBusy(true);
    try {
      const rows = await getExperimentExportData(experiment.id);
      downloadCsv(
        rows,
        `${experiment.name.replace(/\s+/g, "_")}_provenance_${new Date()
          .toISOString()
          .slice(0, 10)}.csv`
      );
      setExportOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function removeExperiment() {
    if (
      !window.confirm(
        "Delete this study workspace? Attached cohorts, subjects, images, and observations will not be deleted."
      )
    ) {
      return;
    }
    setBusy(true);
    await deleteExperiment(experiment.id);
    router.push("/experiments");
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(247,244,237,0.92))]">
      <div className="page-shell space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Link
          href="/experiments"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Study workspaces
        </Link>

        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="page-eyebrow">Experiment workspace</p>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.12em]",
                    experiment.status === "active" &&
                      "border-emerald-200 bg-emerald-50 text-emerald-800"
                  )}
                >
                  {experiment.status || "planned"}
                </Badge>
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {experiment.name}
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                  {experiment.description || "No study question has been recorded yet."}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {formatDate(experiment.start_date)} – {formatDate(experiment.end_date)}
                </span>
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {experiment.experiment_cohorts.length} cohorts · {insights.totalSubjects} subjects
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setActiveTab("atlas")}>
                Review cycle atlas <ChevronRight className="ml-2 h-4 w-4" />
              </Button>

              <Dialog open={exportOpen} onOpenChange={setExportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={insights.totalLogs === 0}>
                    <Download className="mr-2 h-4 w-4" /> Export manifest
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Export this study’s provenance manifest</DialogTitle>
                    <DialogDescription>
                      One CSV row per observation, scoped to the attached cohorts. Image and
                      paired-cytology references remain object references rather than public links.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-3 gap-3 rounded-2xl bg-muted/60 p-4 text-sm">
                    <div><strong className="block text-lg">{insights.totalLogs}</strong>records</div>
                    <div><strong className="block text-lg">{insights.totalSubjects}</strong>subjects</div>
                    <div><strong className="block text-lg">{experiment.experiment_cohorts.length}</strong>cohorts</div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Includes saved stage, capture date, modality, confirmation source, reviewer,
                    paired reference, prepared ROI, and model-review fields.
                  </p>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setExportOpen(false)}>Cancel</Button>
                    <Button onClick={exportManifest} disabled={busy}>
                      {busy ? "Preparing…" : "Download provenance CSV"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={scopeOpen} onOpenChange={setScopeOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <FolderCog className="mr-2 h-4 w-4" /> Manage scope
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Manage study scope</DialogTitle>
                    <DialogDescription>
                      Attach an existing cohort. This changes the study view and export scope; it
                      does not copy or alter source observations.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 py-2">
                    <Label htmlFor="study-cohort">Cohort to attach</Label>
                    <Select value={selectedCohortId} onValueChange={setSelectedCohortId}>
                      <SelectTrigger id="study-cohort">
                        <SelectValue placeholder="Choose a cohort" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCohorts.map((cohort) => (
                          <SelectItem key={cohort.id} value={cohort.id}>{cohort.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {availableCohorts.length === 0 && (
                      <p className="text-sm text-muted-foreground">Every available cohort is already attached.</p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setScopeOpen(false)}>Cancel</Button>
                    <Button onClick={addCohort} disabled={!selectedCohortId || busy}>
                      <Plus className="mr-2 h-4 w-4" /> Attach cohort
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </section>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border bg-white/80 p-1.5 sm:w-fit">
            <TabsTrigger value="summary" className="rounded-xl px-4 py-2">Study summary</TabsTrigger>
            <TabsTrigger value="atlas" className="rounded-xl px-4 py-2">Cycle atlas</TabsTrigger>
            <TabsTrigger value="cohorts" className="rounded-xl px-4 py-2">Cohorts</TabsTrigger>
            <TabsTrigger value="records" className="rounded-xl px-4 py-2">Records</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>Collection integrity</CardTitle>
                      <CardDescription>What is actually available for this study window.</CardDescription>
                    </div>
                    {insights.missingCaptureDates === 0 ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <CircleAlert className="h-5 w-5 text-amber-700" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Metric value={insights.totalLogs} label="records" />
                    <Metric value={insights.observationDays} label="capture days" />
                    <Metric value={`${coverage}%`} label="observed slots" />
                    <Metric value={insights.pairedCytologyLogs} label="cytology-paired" />
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${coverage}% of subject-day slots have observations`}>
                    <div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.min(coverage, 100)}%` }} />
                  </div>
                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                    <IntegrityItem
                      label="Capture-date range"
                      value={insights.dateRange ? `${formatShortDate(insights.dateRange.start)} – ${formatShortDate(insights.dateRange.end)}` : "No dated records"}
                      warning={!insights.dateRange}
                    />
                    <IntegrityItem
                      label="Scientist review"
                      value={`${insights.confirmedLogs} confirmed · ${insights.uncertainLogs} uncertain`}
                      warning={insights.uncertainLogs > 0}
                    />
                    <IntegrityItem
                      label="Required metadata"
                      value={insights.subjectsMissingMetadata === 0 ? "Coat and strain complete" : `${insights.subjectsMissingMetadata} ${insights.subjectsMissingMetadata === 1 ? "subject" : "subjects"} incomplete`}
                      warning={insights.subjectsMissingMetadata > 0}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-indigo-200 bg-indigo-50/55">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-indigo-100 p-2 text-indigo-800"><ShieldCheck className="h-5 w-5" /></div>
                    <div>
                      <CardTitle>Photo-model review</CardTitle>
                      <CardDescription>Binary group evidence, never the saved stage.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <Metric value={reviewedByBinary} label="reviewed" compact />
                    <Metric value={insights.binarySuggestions} label="suggestions" compact />
                    <Metric value={insights.binaryAbstentions} label="abstentions" compact />
                  </div>
                  <p className="rounded-xl border border-indigo-200 bg-white/70 p-3 text-sm leading-6 text-indigo-950">
                    The validated photo model can suggest early- versus late-cycle groups. Exact
                    stage remains scientist-controlled and abstentions stay visible.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Scientist stage mix</CardTitle>
                  <CardDescription>Saved labels only; model suggestions are excluded.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {insights.stageDistribution.map((entry) => (
                    <div key={entry.stage} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2.5">
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", STAGE_STYLES[entry.stage] || "stage-unknown")}>{entry.stage}</span>
                      <strong>{entry.value}</strong>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Attached cohorts</CardTitle>
                  <CardDescription>Scope, subject count, and paired-ground-truth coverage.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {insights.cohortStats.map((cohort) => (
                    <div key={cohort.id} className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                      <div>
                        <p className="font-semibold">{cohort.name}</p>
                        <p className="text-sm text-muted-foreground">{cohort.subjectCount} subjects</p>
                      </div>
                      <span className="text-sm"><strong>{cohort.logCount}</strong> records</span>
                      <span className="text-sm"><strong>{cohort.pairedCytologyCount}</strong> paired</span>
                      <Link href={`/cohorts/${cohort.id}`} className="text-sm font-medium text-primary hover:underline">Open cohort</Link>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="atlas">
            <Card>
              <CardHeader className="gap-4 border-b">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle>Cycle atlas</CardTitle>
                    <CardDescription>One row per subject. Blank cells are missing observations, not inferred stages.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {Object.keys(STAGE_STYLES).map((stage) => (
                      <span key={stage} className={cn("rounded-full px-2.5 py-1 font-medium", STAGE_STYLES[stage])}>{stage}</span>
                    ))}
                    <span className="rounded-full border border-dashed bg-white px-2.5 py-1 text-muted-foreground">Missing</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>{insights.totalSubjects} subjects</span>
                  <span>{atlasDates.length} calendar days</span>
                  <span>{coverage}% subject-day coverage</span>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <div className="min-w-max p-5">
                  <div className="grid grid-cols-[10rem_repeat(var(--atlas-days),3.25rem)] gap-1" style={{ "--atlas-days": atlasDates.length } as CSSProperties}>
                    <div className="sticky left-0 z-20 bg-card px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subject</div>
                    {atlasDates.map((date) => (
                      <div key={date} className="px-1 py-2 text-center text-[11px] font-medium text-muted-foreground">{formatShortDate(date)}</div>
                    ))}
                    {atlasRows.flatMap((cohort) => [
                      <div key={`${cohort.id}-heading`} className="sticky left-0 z-20 col-span-1 mt-3 bg-card px-2 py-2 text-xs font-semibold text-foreground">{cohort.name}</div>,
                      ...atlasDates.map((date) => <div key={`${cohort.id}-${date}-spacer`} className="mt-3 border-t" />),
                      ...cohort.mice.flatMap((mouse) => [
                        <div key={`${mouse.id}-name`} className="sticky left-0 z-20 bg-card px-2 py-2 text-sm font-medium">{mouse.name}</div>,
                        ...mouse.cells.map(({ date, log }) => (
                          <div
                            key={`${mouse.id}-${date}`}
                            title={`${mouse.name} · ${date} · ${log?.stage || "Missing"}`}
                            className={cn(
                              "flex h-9 items-center justify-center rounded-md text-xs font-bold ring-1 ring-inset",
                              log ? STAGE_CELL_STYLES[log.stage] || "bg-slate-200 text-slate-800 ring-slate-300" : "border border-dashed border-slate-300 bg-white text-slate-400"
                            )}
                          >
                            {log ? log.stage.slice(0, 1) : "—"}
                            <span className="sr-only">{log?.stage || "Missing observation"}</span>
                          </div>
                        )),
                      ]),
                    ])}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cohorts">
            <div className="grid gap-4 lg:grid-cols-2">
              {experiment.experiment_cohorts.map(({ cohorts: cohort }) => {
                if (!cohort) return null;
                const stats = insights.cohortStats.find((item) => item.id === cohort.id);
                return (
                  <Card key={cohort.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle>{cohort.name}</CardTitle>
                          <CardDescription className="mt-2">{cohort.description || "No cohort note."}</CardDescription>
                        </div>
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cohort.color || "#4f46e5" }} aria-hidden="true" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <Metric value={stats?.subjectCount || 0} label="subjects" compact />
                        <Metric value={stats?.logCount || 0} label="records" compact />
                        <Metric value={stats?.pairedCytologyCount || 0} label="paired" compact />
                      </div>
                      <div className="flex items-center justify-between border-t pt-4">
                        <Button asChild variant="outline" size="sm"><Link href={`/cohorts/${cohort.id}`}>Open cohort</Link></Button>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => removeCohort(cohort.id)}>
                          Remove from study
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="records">
            <Card>
              <CardHeader>
                <CardTitle>Observation records</CardTitle>
                <CardDescription>Scientist labels, provenance, and binary review status remain separate.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="border-y bg-muted/45 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Capture date</th>
                      <th className="px-5 py-3 font-semibold">Subject</th>
                      <th className="px-5 py-3 font-semibold">Cohort</th>
                      <th className="px-5 py-3 font-semibold">Scientist stage</th>
                      <th className="px-5 py-3 font-semibold">Provenance</th>
                      <th className="px-5 py-3 font-semibold">Binary review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visualizationData.logs.map((log) => {
                      const mouse = log.mouse_id ? mouseLookup.get(log.mouse_id) : undefined;
                      return (
                        <tr key={log.id} className="hover:bg-muted/30">
                          <td className="px-5 py-3 font-medium">{log.capture_date || log.date}</td>
                          <td className="px-5 py-3">{mouse?.name || "Unknown"}</td>
                          <td className="px-5 py-3 text-muted-foreground">{mouse?.cohortName || "Unknown"}</td>
                          <td className="px-5 py-3"><span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", STAGE_STYLES[log.stage] || "stage-unknown")}>{log.stage}</span></td>
                          <td className="px-5 py-3">
                            <span className="font-medium">{readableSource(log.confirmation_source)}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">{log.label_status === "confirmed" ? "Confirmed" : "Uncertain / legacy"}</span>
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">{readableBinaryReview(log)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <details className="rounded-2xl border border-slate-200 bg-white/70 px-5 py-4 text-sm">
          <summary className="cursor-pointer font-medium text-muted-foreground">Study workspace settings</summary>
          <div className="mt-4 flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-foreground">Delete workspace</p>
              <p className="mt-1 text-muted-foreground">Source cohorts, subjects, images, and observations are not deleted.</p>
            </div>
            <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/5" onClick={removeExperiment} disabled={busy}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete workspace
            </Button>
          </div>
        </details>
      </div>
    </div>
  );
}

function Metric({ value, label, compact = false }: { value: string | number; label: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-2xl border bg-white/80", compact ? "p-3" : "p-4")}>
      <strong className={cn("block tracking-tight", compact ? "text-xl" : "text-2xl")}>{value}</strong>
      <span className="mt-1 block text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function IntegrityItem({ label, value, warning }: { label: string; value: string; warning: boolean }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <p className={cn("mt-1 font-medium", warning && "text-amber-800")}>{value}</p>
    </div>
  );
}
