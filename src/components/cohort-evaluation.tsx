"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Download,
  FlaskConical,
  Images,
  Loader2,
  Minus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstrusIcon } from "@/components/estrus-icon";
import { cn } from "@/lib/utils";

interface EvaluationLog {
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
  data?: Record<string, unknown> | null;
  mice?: { name: string } | null;
}

interface EvaluationSubject {
  id: string;
  name: string;
  status?: string | null;
  coat_colour?: string | null;
  strain?: string | null;
}

type BinaryEvidence = {
  decisionStatus: string | null;
  group: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function nestedRecord(value: unknown, key: string) {
  return isRecord(value) && isRecord(value[key]) ? value[key] as Record<string, unknown> : null;
}

function observationField(log: EvaluationLog, key: string) {
  const context = nestedRecord(log.data, "observation_context");
  const value = context?.[key];
  return typeof value === "string" ? value : null;
}

function binaryEvidence(log: EvaluationLog): BinaryEvidence | null {
  const evidence = nestedRecord(log.data, "evidence");
  const binary = nestedRecord(evidence, "external_binary");
  if (!binary) return null;
  return {
    decisionStatus: typeof binary.decision_status === "string" ? binary.decision_status : null,
    group: typeof binary.reference_backed_binary_suggestion === "string"
      ? binary.reference_backed_binary_suggestion
      : null,
  };
}

function hasPreparedModelInput(log: EvaluationLog) {
  return Boolean(nestedRecord(log.data, "model_input_reference"));
}

function isPairedCytologyRecord(log: EvaluationLog) {
  const modality = log.modality || observationField(log, "modality");
  const confirmation = log.confirmation_source || observationField(log, "confirmation_source");
  const labelStatus = log.label_status || observationField(log, "label_status");
  return (
    modality === "external_photo" &&
    labelStatus === "confirmed" &&
    confirmation === "paired_cytology_review" &&
    log.reference_modality === "vaginal_cytology" &&
    Boolean(log.reference_image_url)
  );
}

function binaryGroupForStage(stage: string) {
  if (stage === "Proestrus" || stage === "Estrus") return "early";
  if (stage === "Metestrus" || stage === "Diestrus") return "late";
  return null;
}

export function CohortEvaluation({
  logs,
  subjects,
  onExport,
  onReviewRecords,
  isExporting = false,
}: {
  logs: EvaluationLog[];
  subjects: EvaluationSubject[];
  onExport?: () => void;
  onReviewRecords?: () => void;
  isExporting?: boolean;
}) {
  const evaluation = useMemo(() => {
    const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
    const paired = logs.filter(isPairedCytologyRecord);
    const exactStagePaired = paired.filter((log) => Boolean(binaryGroupForStage(log.stage)));
    const pairedSubjectIds = new Set(exactStagePaired.flatMap((log) => log.mouse_id ? [log.mouse_id] : []));
    const early = exactStagePaired.filter((log) => binaryGroupForStage(log.stage) === "early").length;
    const late = exactStagePaired.filter((log) => binaryGroupForStage(log.stage) === "late").length;
    const pairedWithModel = exactStagePaired.filter((log) => binaryEvidence(log)).length;
    const pairedAbstentions = exactStagePaired.filter((log) => {
      const evidence = binaryEvidence(log);
      return evidence && evidence.decisionStatus !== "reference_backed_suggestion";
    }).length;
    const pairedWithPreparedInput = exactStagePaired.filter(hasPreparedModelInput).length;
    const missingMetadata = Array.from(pairedSubjectIds).filter((subjectId) => {
      const subject = subjectById.get(subjectId);
      return !subject?.coat_colour || !subject?.strain;
    });
    const missingCaptureDates = exactStagePaired.filter((log) => !log.capture_date).length;
    const duplicatePairKeys = new Set<string>();
    const seenPairKeys = new Set<string>();
    exactStagePaired.forEach((log) => {
      const pairKey = log.reference_sample_id || log.reference_image_url;
      if (!pairKey) return;
      if (seenPairKeys.has(pairKey)) duplicatePairKeys.add(pairKey);
      seenPairKeys.add(pairKey);
    });

    const checks = [
      {
        id: "pairings",
        pass: exactStagePaired.length > 0,
        title: "Cytology-grounded labels",
        detail: exactStagePaired.length
          ? `${exactStagePaired.length} external photos have an exact stage confirmed from a paired cytology record.`
          : "No exact-stage external-photo records have paired cytology evidence yet.",
      },
      {
        id: "subjects",
        pass: pairedSubjectIds.size >= 2,
        title: "Grouped subject split",
        detail: pairedSubjectIds.size >= 2
          ? `${pairedSubjectIds.size} mice can be kept intact when the preflight freezes train and test groups.`
          : "At least two independently paired mice are needed before a grouped split can be formed.",
      },
      {
        id: "groups",
        pass: early > 0 && late > 0,
        title: "Both binary groups represented",
        detail: `${early} early-group and ${late} late-group cytology-confirmed records.`,
      },
      {
        id: "metadata",
        pass: missingMetadata.length === 0,
        title: "Coat colour and strain recorded",
        detail: missingMetadata.length
          ? `${missingMetadata.length} paired ${missingMetadata.length === 1 ? "mouse is" : "mice are"} missing evaluation metadata.`
          : "Every paired mouse has coat colour and strain metadata.",
      },
      {
        id: "provenance",
        pass: missingCaptureDates === 0 && duplicatePairKeys.size === 0,
        title: "Pairing provenance is one-to-one",
        detail: missingCaptureDates || duplicatePairKeys.size
          ? `${missingCaptureDates} missing capture dates · ${duplicatePairKeys.size} repeated cytology references.`
          : "Capture dates and cytology references are complete and non-repeating.",
      },
    ];

    const blockers = checks.filter((check) => !check.pass);
    const subjectRows = subjects
      .map((subject) => {
        const subjectLogs = logs.filter((log) => log.mouse_id === subject.id);
        const pairedLogs = exactStagePaired.filter((log) => log.mouse_id === subject.id);
        return { subject, total: subjectLogs.length, paired: pairedLogs.length };
      })
      .filter((row) => row.total > 0)
      .sort((left, right) => right.paired - left.paired || left.subject.name.localeCompare(right.subject.name));

    return {
      paired: exactStagePaired,
      pairedSubjects: pairedSubjectIds.size,
      early,
      late,
      pairedWithModel,
      pairedAbstentions,
      pairedWithPreparedInput,
      visualOnly: Math.max(0, logs.length - paired.length),
      transitionPairs: paired.length - exactStagePaired.length,
      checks,
      blockers,
      subjectRows,
    };
  }, [logs, subjects]);

  const structurallyReady = evaluation.blockers.length === 0;

  return (
    <section className="space-y-5" aria-labelledby="evaluation-readiness-heading">
      <div className={cn(
        "grid gap-5 border p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center",
        structurallyReady ? "border-emerald-200 bg-emerald-50" : "border-[#d8b28d] bg-[#fff4df]"
      )}>
        <div className="flex min-w-0 items-start gap-4">
          <EstrusIcon name={structurallyReady ? "confirm" : "review-needed"} className="h-14 w-14 shrink-0" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#66627a]">Evaluation readiness</p>
            <h2 id="evaluation-readiness-heading" className="mt-1 font-serif text-3xl text-[#292b4c]">
              {structurallyReady ? "Ready for grouped preflight" : `${evaluation.blockers.length} collection ${evaluation.blockers.length === 1 ? "gap" : "gaps"} to resolve`}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625f58]">
              This checks whether the cohort can produce a reproducible held-out manifest. It does not claim that the model is accurate or ready for promotion.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button variant="outline" onClick={onReviewRecords} className="border-[#b8b7e1] bg-white text-[#353a87] hover:bg-[#eeedf9]">
            <Images className="h-4 w-4" />Review records
          </Button>
          <Button onClick={onExport} disabled={!structurallyReady || isExporting} className="bg-[#454a9f] text-white hover:bg-[#383d89]">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export preflight manifest
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <EvidenceMetric value={evaluation.paired.length} label="paired exact-stage records" tone="indigo" />
        <EvidenceMetric value={evaluation.pairedSubjects} label="cytology-grounded mice" tone="green" />
        <EvidenceMetric value={`${evaluation.early} / ${evaluation.late}`} label="early / late labels" tone="rust" />
        <EvidenceMetric value={`${evaluation.pairedWithModel}/${evaluation.paired.length}`} label="existing binary reviews" tone="neutral" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <section className="border border-[#ded9cd] bg-white" aria-labelledby="readiness-checks-heading">
          <div className="border-b border-[#ded9cd] px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#66627a]">Structural checks</p>
            <h3 id="readiness-checks-heading" className="mt-1 font-serif text-2xl text-[#292b4c]">Before any accuracy number</h3>
          </div>
          <ol className="divide-y divide-[#ded9cd]">
            {evaluation.checks.map((check) => (
              <li key={check.id} className="flex gap-3 px-5 py-4">
                <span className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  check.pass ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                )}>
                  {check.pass ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#292b4c]">{check.title}</p>
                  <p className="mt-1 text-xs leading-5 text-[#625f58]">{check.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="border border-[#ded9cd] bg-[#fbfaf7] p-5" aria-labelledby="model-coverage-heading">
          <EstrusIcon name="evidence" className="h-12 w-12" />
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#66627a]">Current model evidence</p>
          <h3 id="model-coverage-heading" className="mt-1 font-serif text-2xl text-[#292b4c]">Binary reviews stay separate</h3>
          <dl className="mt-4 divide-y divide-[#ded9cd] border-y border-[#ded9cd] text-sm">
            <div className="flex items-center justify-between gap-4 py-3"><dt className="text-[#625f58]">Prepared model crops</dt><dd className="font-semibold text-[#292b4c]">{evaluation.pairedWithPreparedInput}/{evaluation.paired.length}</dd></div>
            <div className="flex items-center justify-between gap-4 py-3"><dt className="text-[#625f58]">Binary reviews present</dt><dd className="font-semibold text-[#292b4c]">{evaluation.pairedWithModel}/{evaluation.paired.length}</dd></div>
            <div className="flex items-center justify-between gap-4 py-3"><dt className="text-[#625f58]">Model abstentions</dt><dd className="font-semibold text-[#292b4c]">{evaluation.pairedAbstentions}</dd></div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-[#625f58]">The held-out runner regenerates predictions from the frozen confirmed crop. Cytology images and labels are never model inputs.</p>
        </section>
      </div>

      <section className="border border-[#ded9cd] bg-white" aria-labelledby="subject-coverage-heading">
        <div className="flex flex-col gap-2 border-b border-[#ded9cd] px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#66627a]">Subject coverage</p>
            <h3 id="subject-coverage-heading" className="mt-1 font-serif text-2xl text-[#292b4c]">Which mice can enter the split</h3>
          </div>
          <p className="text-xs text-[#625f58]">{evaluation.visualOnly} visual-only records excluded · {evaluation.transitionPairs} transition pairs held out</p>
        </div>
        <div className="divide-y divide-[#ded9cd]">
          {evaluation.subjectRows.map(({ subject, total, paired }) => {
            const metadataComplete = Boolean(subject.coat_colour && subject.strain);
            return (
              <article key={subject.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                <div>
                  <p className="font-semibold text-[#292b4c]">{subject.name}</p>
                  <p className="mt-1 text-xs text-[#625f58]">{total} records · {paired} paired exact-stage</p>
                </div>
                <Badge variant="outline" className={cn(
                  "w-fit",
                  metadataComplete ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
                )}>
                  {metadataComplete ? `${subject.coat_colour} · ${subject.strain}` : "Metadata needed"}
                </Badge>
                <span className={cn(
                  "inline-flex w-fit items-center gap-1 text-xs font-semibold",
                  paired ? "text-emerald-800" : "text-[#77736c]"
                )}>
                  {paired ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                  {paired ? "Eligible" : "Not paired"}
                </span>
              </article>
            );
          })}
        </div>
      </section>

      <details className="group border border-[#ded9cd] bg-[#fbfaf7]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-[#4f4b45]">
          <span className="flex items-center gap-2"><FlaskConical className="h-4 w-4" />Legacy filename import QA</span>
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-[#ded9cd] px-5 py-4 text-sm leading-6 text-[#625f58]">
          Filename labels can help detect import mistakes, but they are not independent ground truth and are never reported as model accuracy.
        </div>
      </details>
    </section>
  );
}

function EvidenceMetric({
  value,
  label,
  tone,
}: {
  value: string | number;
  label: string;
  tone: "indigo" | "green" | "rust" | "neutral";
}) {
  const tones = {
    indigo: "border-[#c9c7e7] bg-[#eeedf9] text-[#292b4c]",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rust: "border-[#d8b28d] bg-[#fff4df] text-[#8b4a32]",
    neutral: "border-[#ded9cd] bg-[#fbfaf7] text-[#292b4c]",
  };
  return (
    <div className={cn("border p-4", tones[tone])}>
      <p className="font-serif text-3xl">{value}</p>
      <p className="mt-1 text-xs">{label}</p>
    </div>
  );
}
