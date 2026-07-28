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
  UserPlus,
  UploadCloud,
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
}

export function CohortClient({ cohort, initialLogs, initialInsights, initialSubjects, todayKey }: CohortClientProps) {
  const [activeTab, setActiveTab] = useState("today");
  const [isExporting, setIsExporting] = useState(false);
  const [isAddingSubject, setIsAddingSubject] = useState(false);

  const downloadManifest = async () => {
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
              <p className="page-eyebrow">Daily cycle workspace</p>
              <Badge variant="outline" className="border-[#b8b7e1] bg-[#eeedf9] text-[#3d428e]">
                Binary model v2
              </Badge>
            </div>
            <h1 className="mt-2 font-serif text-4xl tracking-tight text-[#292b4c] sm:text-5xl">{cohort.name}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#625f58]">
              <span>{initialSubjects.length} mice</span>
              <span>{initialInsights.totalLogs} observations</span>
              <span>{initialInsights.binaryModelReviews} new-model reviews</span>
              {cohort.type && <span>{cohort.type}</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setIsAddingSubject(true)} variant="outline" className="h-10 border-[#b8b7e1] bg-white text-[#353a87] hover:bg-[#eeedf9]">
              <UserPlus className="mr-2 h-4 w-4" />
              Add mouse
            </Button>
            <Button onClick={() => setActiveTab("today")} disabled={initialSubjects.length === 0} variant="outline" className="h-10 border-[#b8b7e1] bg-white text-[#353a87] hover:bg-[#eeedf9]" data-tour="record-one">
              <ListChecks className="mr-2 h-4 w-4" />
              Record one
            </Button>
            <Button asChild className="h-10 bg-[#454a9f] text-white hover:bg-[#383d89]" data-tour="bulk-capture">
              <Link href={`/cohorts/${cohort.id}/batch`}>
                <UploadCloud className="mr-2 h-4 w-4" />
                Bulk capture
              </Link>
            </Button>
            <details className="group relative">
              <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#625f58] hover:bg-[#f0ede5]">
                Data &amp; history <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 z-40 mt-2 w-56 space-y-1 border border-[#ded9cd] bg-white p-2 shadow-xl">
                <Button asChild variant="ghost" className="w-full justify-start">
                  <Link href={`/cohorts/${cohort.id}/scans`}><History className="mr-2 h-4 w-4" />Batch history</Link>
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

      <details className="group border border-[#c9c7e7] bg-[#eeedf9]" aria-label="Model review policy">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-semibold text-[#353a87]">
          <EstrusIcon name="evidence" className="h-8 w-8" />
          Model assistance appears after a photo crop is confirmed
          <ChevronDown className="ml-auto h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <p className="border-t border-[#c9c7e7] px-4 py-3 text-xs leading-5 text-[#5e5d75]">The external-photo model gives an early-versus-late research lead or abstains. The scientist always chooses the saved four-stage label.</p>
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
    </div>
  );
}
