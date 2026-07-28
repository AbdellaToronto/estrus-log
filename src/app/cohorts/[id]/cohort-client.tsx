"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  ChevronDown,
  Download,
  FlaskConical,
  History,
  Images,
  ListChecks,
  Loader2,
  ArrowRight,
  CalendarDays,
  UserPlus,
  UploadCloud,
  X,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CohortAnalysis } from "@/components/cohort-analysis";
import { CohortLibrary } from "@/components/cohort-library";
import { CohortEvaluation } from "@/components/cohort-evaluation";
import { CohortSubjects } from "@/components/cohort-subjects";
import { AddSubjectDialog } from "@/components/add-subject-dialog";
import { EstrusIcon } from "@/components/estrus-icon";
import type { Cohort } from "@/lib/types";
import { getCohortExportData, type CohortInsights } from "@/app/actions";

interface LogItem {
  id: string;
  mouse_id: string | null;
  stage: string;
  created_at: string;
  capture_date?: string | null;
  image_url?: string | null;
  modality?: string | null;
  label_status?: string | null;
  confirmation_source?: string | null;
  reference_modality?: string | null;
  reference_image_url?: string | null;
  reference_sample_id?: string | null;
  confidence?: unknown;
  features?: unknown;
  notes?: string | null;
  data?: Record<string, unknown> | null;
  mice?: { name: string } | null;
}

interface SubjectItem {
  id: string;
  name: string;
  status?: string | null;
  created_at: string;
  coat_colour?: string | null;
  strain?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface CohortClientProps {
  cohort: Cohort;
  initialLogs: LogItem[];
  initialInsights: CohortInsights;
  initialSubjects: SubjectItem[];
  todayKey?: string;
  demoMode?: boolean;
}

export function CohortClient({ cohort, initialLogs, initialInsights, initialSubjects, todayKey, demoMode = false }: CohortClientProps) {
  const [activeTab, setActiveTab] = useState("today");
  const [isExporting, setIsExporting] = useState(false);
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [selectedDemoSubjectId, setSelectedDemoSubjectId] = useState<string | null>(null);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);
  const selectedDemoSubject = demoMode ? initialSubjects.find((subject) => subject.id === selectedDemoSubjectId) : undefined;
  const selectedDemoLogs = selectedDemoSubject ? initialLogs.filter((log) => log.mouse_id === selectedDemoSubject.id) : [];

  const downloadManifest = async () => {
    if (demoMode) {
      const columns = ["subject", "capture_date", "saved_stage", "confirmation_source", "model_decision"];
      const csv = [
        columns.join(","),
        ...initialLogs.map((log) => [
          log.mice?.name || "Unassigned",
          log.capture_date || log.created_at.slice(0, 10),
          log.stage,
          log.confirmation_source || "scientist_review",
          String((log.data as { evidence?: { external_binary?: { decision_status?: string } } } | null)?.evidence?.external_binary?.decision_status || "manual"),
        ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")),
      ].join("\n");
      const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = "estrus-supervisor-demo-manifest.csv";
      anchor.click();
      URL.revokeObjectURL(href);
      setDemoNotice("Illustrative manifest downloaded. It contains no live laboratory data.");
      return;
    }
    setIsExporting(true);
    try {
      const rows = await getCohortExportData(cohort.id);
      const columns = rows.length
        ? Object.keys(rows[0])
        : ["log_id", "subject_id", "subject_name", "saved_stage", "capture_date", "modality", "confirmation_source", "binary_model_version", "binary_decision_status", "binary_group_suggestion", "prepared_roi_object_reference", "notes", "created_at"];
      const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
      const csv = [
        columns.join(","),
        ...rows.map((row) => columns.map((column) => escape(row[column as keyof typeof row])).join(",")),
      ].join("\n");
      const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `${cohort.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "estrus-cohort"}-manifest.csv`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      console.error("Could not export cohort manifest", error);
      window.alert("The cohort manifest could not be exported. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="page-shell min-h-screen space-y-6 pb-20">
      <header className="border-b border-[#d9d4c8] pb-6 pt-2">
        <nav className="text-xs font-medium text-[#77736c]" aria-label="Breadcrumb">
          <Link href="/cohorts" className="hover:text-[#454a9f]">Cohorts</Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <span className="text-[#4f4b45]">{cohort.name}</span>
        </nav>

        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="page-eyebrow">AI-assisted cycle workspace</p>
              <Badge variant="outline" className="border-[#b8b7e1] bg-[#eeedf9] text-[#3d428e]">
                Four-stage predictions
              </Badge>
            </div>
            <h1 className="mt-2 font-serif text-4xl tracking-tight text-[#292b4c] sm:text-5xl">{cohort.name}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#625f58]">
              <span>{initialSubjects.length} mice</span>
              <span>{initialInsights.totalLogs} observations</span>
              <span>{initialInsights.modelSupportedLogs} AI-assisted records</span>
              {cohort.type && (
                <span>
                  {cohort.type === "estrus_tracking"
                    ? "Estrus cycle tracking"
                    : cohort.type.replaceAll("_", " ")}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => demoMode ? setDemoNotice("This is a fixed reference cohort. Use Batch capture to add your own local demo images.") : setIsAddingSubject(true)} variant="outline" className="h-10 border-[#b8b7e1] bg-white text-[#353a87] hover:bg-[#eeedf9]">
              <UserPlus className="mr-2 h-4 w-4" />
              Add mouse
            </Button>
            <Button onClick={() => setActiveTab("today")} disabled={initialSubjects.length === 0} variant="outline" className="h-10 border-[#b8b7e1] bg-white text-[#353a87] hover:bg-[#eeedf9]" data-tour="record-one">
              <ListChecks className="mr-2 h-4 w-4" />
              Analyze one
            </Button>
            <Button asChild className="h-10 bg-[#454a9f] text-white hover:bg-[#383d89]" data-tour="bulk-capture">
              <Link href={demoMode ? "/batch-lab" : `/cohorts/${cohort.id}/batch`}>
                <UploadCloud className="mr-2 h-4 w-4" />
                Analyze batch
              </Link>
            </Button>
            <details className="group relative">
              <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#625f58] hover:bg-[#f0ede5]">
                Data &amp; history <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 z-40 mt-2 w-56 space-y-1 border border-[#ded9cd] bg-white p-2 shadow-xl">
                <Button asChild variant="ghost" className="w-full justify-start">
                  <Link href={demoMode ? "/batch-lab" : `/cohorts/${cohort.id}/scans`}><History className="mr-2 h-4 w-4" />Batch history</Link>
                </Button>
                <Button variant="ghost" className="w-full justify-start" onClick={downloadManifest} disabled={isExporting}>
                  {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Export manifest
                </Button>
              </div>
            </details>
          </div>
        </div>
      </header>

      {demoNotice && (
        <div role="status" className="flex items-center justify-between gap-4 border border-[#b8b7e1] bg-[#eeedf9] px-4 py-3 text-sm text-[#353a87]">
          <span>{demoNotice}</span>
          <button type="button" onClick={() => setDemoNotice(null)} className="rounded p-1 hover:bg-white/60" aria-label="Dismiss notice"><X className="h-4 w-4" /></button>
        </div>
      )}

      <details className="group border border-[#c9c7e7] bg-[#eeedf9]" aria-label="Model review policy">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-semibold text-[#353a87]">
          <EstrusIcon name="evidence" className="h-8 w-8" />
          Exact-stage AI analysis starts after the crop is confirmed
          <ChevronDown className="ml-auto h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <p className="border-t border-[#c9c7e7] px-4 py-3 text-xs leading-5 text-[#5e5d75]">Estrus Log proposes one of four stages and shows support for every stage. An independent early-versus-late model acts as a guardrail. Accepting or correcting the proposal creates the reviewed record.</p>
      </details>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <div className="overflow-x-auto border-b border-[#d9d4c8]">
          <TabsList className="h-auto min-w-max gap-6 bg-transparent p-0">
            {[
              { value: "today", label: "Today", icon: ListChecks },
              { value: "records", label: "Records", icon: Images },
              { value: "trends", label: "Trends", icon: BarChart3 },
              { value: "evaluation", label: "Evaluation", icon: FlaskConical },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-2 text-[#77736c] shadow-none data-[state=active]:border-[#454a9f] data-[state=active]:bg-transparent data-[state=active]:text-[#292b4c] data-[state=active]:shadow-none"
              >
                <Icon className="mr-2 h-4 w-4" />{label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div>
            <TabsContent value="today" className="mt-0 focus-visible:ring-0">
              <CohortSubjects
                subjects={initialSubjects}
                logs={initialLogs}
                todayKey={todayKey}
                onAddSubject={() => setIsAddingSubject(true)}
                onSubjectOpen={demoMode ? (subject) => setSelectedDemoSubjectId(subject.id) : undefined}
              />
            </TabsContent>
            <TabsContent value="records" className="mt-0 focus-visible:ring-0">
              <CohortLibrary logs={initialLogs as Parameters<typeof CohortLibrary>[0]["logs"]} subjects={initialSubjects as Parameters<typeof CohortLibrary>[0]["subjects"]} />
            </TabsContent>
            <TabsContent value="trends" className="mt-0 focus-visible:ring-0">
              <CohortAnalysis insights={initialInsights} />
            </TabsContent>
            <TabsContent value="evaluation" className="mt-0 focus-visible:ring-0">
              <CohortEvaluation
                logs={initialLogs as Parameters<typeof CohortEvaluation>[0]["logs"]}
                subjects={initialSubjects}
                onExport={downloadManifest}
                onReviewRecords={() => setActiveTab("records")}
                isExporting={isExporting}
              />
            </TabsContent>
        </div>
      </Tabs>
      {isAddingSubject && (
        <AddSubjectDialog
          cohortId={cohort.id}
          open
          onOpenChange={setIsAddingSubject}
        />
      )}
      {selectedDemoSubject && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#292b4c]/35 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`${selectedDemoSubject.name} profile`}>
          <section className="flex h-full w-full max-w-xl flex-col overflow-y-auto border border-[#ded9cd] bg-[#fbfaf7] shadow-2xl">
            <header className="border-b border-[#ded9cd] px-6 py-5">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="page-eyebrow">Demo subject profile</p>
                  <h2 className="mt-2 font-serif text-4xl text-[#292b4c]">{selectedDemoSubject.name}</h2>
                  <p className="mt-2 text-sm text-[#625f58]">{selectedDemoSubject.coat_colour || "Coat colour not recorded"} · {selectedDemoSubject.strain || "strain not recorded"}</p>
                </div>
                <button type="button" onClick={() => setSelectedDemoSubjectId(null)} aria-label="Close subject profile" className="rounded-lg p-2 text-[#625f58] hover:bg-[#f0ede5]"><X className="h-5 w-5" /></button>
              </div>
            </header>
            <div className="space-y-6 p-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="border border-[#ded9cd] bg-white p-3"><p className="text-2xl font-semibold text-[#292b4c]">{selectedDemoLogs.length}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#77736c]">observations</p></div>
                <div className="border border-[#ded9cd] bg-white p-3"><p className="text-2xl font-semibold text-[#292b4c]">{selectedDemoLogs.filter((log) => log.confirmation_source === "paired_cytology_review").length}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#77736c]">paired checks</p></div>
                <div className="border border-[#ded9cd] bg-white p-3"><p className="text-2xl font-semibold text-[#292b4c]">{selectedDemoLogs[0]?.stage || "—"}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#77736c]">latest stage</p></div>
              </div>
              <div className="border border-[#ded9cd] bg-white p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#77736c]">Recent cycle trace</p>
                <div className="mt-3 flex flex-wrap gap-2">{selectedDemoLogs.slice(0, 8).map((log) => <span key={log.id} className="border border-[#ded9cd] bg-[#f7f4ed] px-2 py-1 text-xs font-semibold text-[#4f4b45]">{log.capture_date?.slice(5)} · {log.stage}</span>)}</div>
              </div>
              <div className="border border-[#c9c7e7] bg-[#eeedf9] p-4 text-sm leading-6 text-[#454a9f]">
                <div className="flex gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" /><p>The next review is deliberately still open in this demo. Start a single review, or include this mouse in the batch session.</p></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button asChild className="bg-[#454a9f] text-white hover:bg-[#383d89]"><Link href={`/observation-lab?subject=${encodeURIComponent(selectedDemoSubject.name)}`}><ListChecks className="mr-2 h-4 w-4" />Analyze one</Link></Button>
                <Button asChild variant="outline" className="border-[#b8b7e1] text-[#353a87]"><Link href="/batch-lab">Open batch capture <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
