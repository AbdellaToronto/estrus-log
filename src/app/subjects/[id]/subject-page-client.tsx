"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Loader2, Pencil, Search } from "lucide-react";
import { LogEntryModal } from "@/components/log-entry-modal";
import { EstrusIcon } from "@/components/estrus-icon";
import { StageDistribution } from "@/components/prediction/stage-distribution";
import { CyclePhasePanel } from "@/components/prediction/cycle-phase-panel";
import type { PhaseObservation } from "@/lib/cycle-phase";
import {
  ESTRUS_STAGES,
  isClassificationStage,
  normalizeConfidenceScores,
  type ClassificationEvidence,
  type ClassificationStage,
} from "@/lib/classification";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { motion, type HTMLMotionProps } from "framer-motion";
import { updateSubjectResearchMetadata } from "@/app/actions";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SUBJECT_COAT_COLOURS,
  SUBJECT_COAT_COLOUR_LABELS,
  isSubjectCoatColour,
  type SubjectCoatColour,
} from "@/lib/subject-metadata";

// Workaround for framer-motion + React 19 type incompatibility
const MotionDiv = motion.div as React.FC<
  HTMLMotionProps<"div"> & { children?: React.ReactNode }
>;

type ConfidenceShape = number | Record<string, number> | null;

type SubjectLog = {
  id: string;
  stage: string;
  confidence: ConfidenceShape;
  created_at: string;
  capture_date?: string | null;
  label_status?: string | null;
  image_url: string | null;
  reference_image_url?: string | null;
  reference_modality?: string | null;
  reference_sample_id?: string | null;
  notes?: string | null;
  data?: Record<string, unknown> | null;
  capture_metadata?: Record<string, unknown> | null;
};

type ExternalBinaryEvidence = NonNullable<ClassificationEvidence["external_binary"]>;
type ModelInputReference = {
  readable_image_url?: string | null;
  modality?: string;
  crop?: {
    zoom?: number;
    source_width?: number;
    source_height?: number;
    output_width?: number;
    output_height?: number;
    processor_field_fraction?: number;
  } | null;
};

type SubjectSummary = {
  id: string;
  name: string;
  coat_colour?: string | null;
  strain?: string | null;
  cohorts?: { name?: string | null } | null;
};

type TimelinePoint = {
  date: string;
  confidence: number;
};

type StageDistributionEntry = {
  name: string;
  value: number;
};

const STAGE_COLORS: Record<string, string> = {
  Proestrus: "#f472b6",
  Estrus: "#fb7185",
  Metestrus: "#38bdf8",
  Diestrus: "#34d399",
};

type ObservationContext = {
  modality?: string;
  capture_date?: string;
  label_status?: string;
  confirmation_source?: string;
};

const getObservationContext = (log: SubjectLog): ObservationContext | null => {
  const context = log.data?.observation_context;
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;
  return context as ObservationContext;
};

const formatModality = (modality?: string) => {
  if (modality === "external_photo") return "External genital photo";
  if (modality === "vaginal_cytology") return "Vaginal cytology / smear";
  return null;
};

const CAPTURE_METADATA_LABELS: Record<string, string> = {
  capture_session: "Session",
  imaging_device: "Camera / microscope",
  magnification: "Magnification",
  stain_or_preparation: "Stain / preparation",
};

const getCaptureMetadata = (log: SubjectLog): Record<string, string> => {
  const metadata = log.capture_metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return Object.entries(metadata).reduce<Record<string, string>>((result, [key, value]) => {
    if (typeof value === "string" && value.trim()) result[key] = value;
    return result;
  }, {});
};

const getExternalBinaryEvidence = (log: SubjectLog): ExternalBinaryEvidence | null => {
  const evidence = log.data?.evidence;
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return null;
  const binary = (evidence as Record<string, unknown>).external_binary;
  if (!binary || typeof binary !== "object" || Array.isArray(binary)) return null;
  return binary as ExternalBinaryEvidence;
};

const getModelInputReference = (log: SubjectLog): ModelInputReference | null => {
  const reference = log.data?.model_input_reference;
  if (!reference || typeof reference !== "object" || Array.isArray(reference)) return null;
  return reference as ModelInputReference;
};

const getStageScores = (
  log: SubjectLog | null
): Record<ClassificationStage, number> | null => {
  const raw = log?.data?.confidence_scores;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const scores = normalizeConfidenceScores(raw as Record<ClassificationStage, unknown>);
  return Object.values(scores).some((score) => score > 0) ? scores : null;
};

const getProposedStage = (
  log: SubjectLog | null,
  scores: Record<ClassificationStage, number> | null
): ClassificationStage | null => {
  const stored = log?.data?.suggested_stage;
  if (isClassificationStage(stored)) return stored;
  if (!scores) return null;
  return [...ESTRUS_STAGES].sort((left, right) => scores[right] - scores[left])[0] ?? null;
};

export function SubjectPageClient({
  subject,
  initialLogs,
}: {
  subject: SubjectSummary;
  initialLogs: SubjectLog[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const logs = useMemo<SubjectLog[]>(
    () => (Array.isArray(initialLogs) ? initialLogs : []),
    [initialLogs]
  );
  const [selectedLog, setSelectedLog] = useState<SubjectLog | null>(
    logs[0] || null
  );
  const initialCoatColour = isSubjectCoatColour(subject.coat_colour)
    ? subject.coat_colour
    : null;
  const [coatColour, setCoatColour] = useState<SubjectCoatColour | null>(
    initialCoatColour
  );
  const [strain, setStrain] = useState(subject.strain || "");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [dialogsMounted, setDialogsMounted] = useState(false);
  const [trendsOpen, setTrendsOpen] = useState(false);

  // Radix generates dialog control IDs in render order. Deferring these two
  // portals until after hydration keeps direct `?new=1` record links from
  // producing different server and client IDs in React 19.
  useEffect(() => setDialogsMounted(true), []);

  const handleLogCreated = () => {
    // Remove the deep-link flag before refreshing. Leaving `?new=1` in place
    // caused a successful save to immediately reopen an empty capture dialog.
    router.replace(`/subjects/${subject.id}`);
    router.refresh();
  };

  const saveResearchMetadata = async () => {
    setProfileSaving(true);
    setProfileError(null);
    try {
      const updated = await updateSubjectResearchMetadata({
        subjectId: subject.id,
        coatColour,
        strain,
      });
      setCoatColour(isSubjectCoatColour(updated.coat_colour) ? updated.coat_colour : null);
      setStrain(updated.strain || "");
      setProfileOpen(false);
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Could not update subject metadata"
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const timelineData = useMemo<TimelinePoint[]>(
    () =>
      logs
        .slice()
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        .map((log) => ({
          date: format(new Date(log.created_at), "MMM d"),
          confidence: Math.min(
            1,
            Math.max(
              0,
              typeof log.confidence === "number" ? log.confidence : 0.95
            )
          ),
        })),
    [logs]
  );

  // One observation per log for the phase model. The capture date is the
  // scientific day; created_at is only a fallback for records saved before
  // capture dates were recorded, and it can sit a day off across midnight.
  const phaseObservations = useMemo<PhaseObservation[]>(
    () =>
      logs.map((log) => {
        const context = getObservationContext(log);
        const binary = getExternalBinaryEvidence(log);
        const date =
          context?.capture_date ||
          log.capture_date ||
          new Date(log.created_at).toISOString().slice(0, 10);
        const uncertain =
          context?.label_status === "uncertain_or_transition" ||
          log.label_status === "uncertain_or_transition";
        return {
          date,
          stage: isClassificationStage(log.stage) ? log.stage : null,
          uncertain,
          earlyGroupProbability:
            typeof binary?.probability_proestrus_or_estrus === "number"
              ? binary.probability_proestrus_or_estrus
              : null,
          earlyGroupReferenceBacked:
            binary?.decision_status === "reference_backed_suggestion",
        };
      }),
    [logs]
  );

  const distributionData = useMemo<StageDistributionEntry[]>(() => {
    const counts = logs.reduce<Record<string, number>>((acc, log) => {
      acc[log.stage] = (acc[log.stage] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [logs]);

  const mostFrequentStage = distributionData[0]?.name ?? "N/A";
  const mostFrequentColor =
    STAGE_COLORS[mostFrequentStage] || STAGE_COLORS.Uncertain;

  const selectedContext = selectedLog ? getObservationContext(selectedLog) : null;
  const selectedCaptureMetadata = selectedLog ? getCaptureMetadata(selectedLog) : {};
  const selectedScores = selectedLog?.data?.confidence_scores;
  const selectedStageScores = getStageScores(selectedLog);
  const selectedProposedStage = getProposedStage(selectedLog, selectedStageScores);
  const predictionAccepted = Boolean(
    selectedProposedStage && selectedProposedStage === selectedLog?.stage
  );
  const selectedExternalBinary = selectedLog ? getExternalBinaryEvidence(selectedLog) : null;
  const selectedModelInput = selectedLog ? getModelInputReference(selectedLog) : null;
  const hasModelScores = Boolean(
    selectedScores &&
      typeof selectedScores === "object" &&
      Object.values(selectedScores).some((value) => typeof value === "number")
  );
  const isManualReview = selectedContext?.confirmation_source === "scientist_review" && !hasModelScores;
  const isPairedCytology = selectedContext?.confirmation_source === "paired_cytology_review"
    || selectedLog?.reference_modality === "vaginal_cytology";

  return (
    <div className="page-shell flex flex-col gap-6 pb-20">
      <header className="border-b border-[#d9d4c8] pb-6 pt-2">
        <p className="page-eyebrow">Mouse record</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-4xl tracking-tight text-[#292b4c] sm:text-5xl">{subject.name}</h1>
            <p className="mt-2 text-sm text-[#625f58]">
              {subject.cohorts?.name || "Unassigned cohort"} · {logs.length} observation{logs.length === 1 ? "" : "s"}
            </p>
          </div>
          {dialogsMounted && <LogEntryModal
            subjectId={subject.id}
            onLogCreated={handleLogCreated}
            initialOpen={searchParams.get("new") === "1"}
          />}
        </div>
      </header>

      <section className="flex flex-col gap-3 border border-[#ded9cd] bg-[#fbfaf7] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#77736c]">
            Research identity
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-700">
            {coatColour ? (
              <Badge variant="outline" className="border-slate-200 bg-white">
                Coat: {SUBJECT_COAT_COLOUR_LABELS[coatColour]}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                Coat colour needed
              </Badge>
            )}
            <span>{strain ? `Strain: ${strain}` : "Strain not recorded"}</span>
          </div>
          <p className="mt-1 text-xs text-[#77736c]">
            Scientist-entered metadata; never inferred from an image.
          </p>
        </div>
        {dialogsMounted && <Dialog open={profileOpen} onOpenChange={(open) => {
          setProfileOpen(open);
          if (!open) setProfileError(null);
        }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0">
              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit metadata
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Subject research metadata</DialogTitle>
              <DialogDescription>
                Coat colour enables real subgroup validation. Record what the colony or animal record states rather than estimating it from this photograph.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="subject-coat-colour">Coat colour</Label>
                <Select
                  value={coatColour || "not_recorded"}
                  onValueChange={(value) =>
                    setCoatColour(isSubjectCoatColour(value) ? value : null)
                  }
                >
                  <SelectTrigger id="subject-coat-colour">
                    <SelectValue placeholder="Choose coat colour" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_recorded">Not recorded</SelectItem>
                    {SUBJECT_COAT_COLOURS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {SUBJECT_COAT_COLOUR_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subject-strain">Strain or stock</Label>
                <Input
                  id="subject-strain"
                  value={strain}
                  onChange={(event) => setStrain(event.target.value)}
                  maxLength={120}
                  placeholder="e.g. C57BL/6J or BALB/c"
                />
              </div>
              {profileError && (
                <p className="text-sm text-red-600" role="alert">{profileError}</p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={saveResearchMetadata} disabled={profileSaving}>
                {profileSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {profileSaving ? "Saving…" : "Save metadata"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>}
      </section>

      {logs.length === 0 ? (
        <section className="order-3 border border-[#ded9cd] bg-white px-6 py-14 text-center">
          <EstrusIcon name="camera" className="mx-auto h-16 w-16" />
          <h2 className="mt-4 font-serif text-3xl text-[#292b4c]">No observations yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#625f58]">
            Start this mouse&apos;s record from the action above. The capture date, image, scientist stage, and evidence will stay together.
          </p>
        </section>
      ) : (<>
      <CyclePhasePanel
        className="order-2"
        observations={phaseObservations}
        subjectLabel={subject.name}
      />

      {/* Secondary analytical summary */}
      <details
        className="group order-4 border border-[#ded9cd] bg-[#fbfaf7]"
        open={trendsOpen}
        onToggle={(event) => setTrendsOpen(event.currentTarget.open)}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold text-[#4f4b45]">
          <span>Cycle trends and summary</span>
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </summary>
        {trendsOpen && <div className="grid gap-4 border-t border-[#ded9cd] p-5 sm:grid-cols-2 lg:grid-cols-3">
        <MotionDiv
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between border border-white/40 shadow-sm bg-white/40 backdrop-blur-xl min-h-[160px] sm:min-h-[180px]"
        >
          <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
            Activity Trend
          </h3>
          <div className="flex-1 mt-2 min-h-0 h-24 sm:h-auto">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  itemStyle={{ color: "#1e293b" }}
                />
                <Area
                  type="monotone"
                  dataKey="confidence"
                  stroke="#8884d8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </MotionDiv>

        <MotionDiv
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between border border-white/40 shadow-sm bg-white/40 backdrop-blur-xl min-h-[160px] sm:min-h-[180px]"
        >
          <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
            Stage Distribution
          </h3>
          <div className="flex-1 mt-2 min-h-0 h-24 sm:h-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData}>
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {distributionData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={STAGE_COLORS[entry.name] || "#94a3b8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </MotionDiv>

        <MotionDiv
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col gap-2 justify-center items-start border border-white/40 shadow-sm bg-white/40 backdrop-blur-xl min-h-[160px] sm:min-h-[180px] sm:col-span-2 lg:col-span-1"
        >
          <div className="flex w-full gap-4 sm:flex-col sm:gap-2">
            <div className="flex-1 sm:flex-none">
              <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                Total Scans
              </div>
              <div className="text-3xl sm:text-5xl font-bold text-slate-800 tracking-tight">
                {logs.length}
              </div>
            </div>

            <div className="hidden sm:block w-full h-px bg-slate-200/50 my-2" />

            <div className="flex-1 sm:flex-none">
              <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                Most Frequent
              </div>
              <div
                className="text-xl sm:text-2xl font-semibold"
                style={{ color: mostFrequentColor }}
              >
                {mostFrequentStage}
              </div>
            </div>
          </div>
        </MotionDiv>
        </div>}
      </details>

      {/* Main Split View */}
      <div className="order-3 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] xl:items-start">
        {/* Supporting image stays secondary to the saved scientific record. */}
        <figure className="order-2 flex min-h-[360px] flex-col overflow-hidden border border-[#ded9cd] bg-[#f4f1e9] p-3 sm:min-h-[440px] xl:sticky xl:top-24 xl:min-h-[520px]">
          <figcaption className="px-1 pb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#77736c]">Observation image</figcaption>

          {/* Main Image Area */}
          <div className="relative flex flex-1 items-center justify-center overflow-hidden border border-[#ded9cd] bg-white">
            {selectedLog ? (
              <div className="absolute inset-0">
                {selectedLog.image_url ? (
                  <Image
                    src={selectedLog.image_url}
                    alt={`${selectedLog.stage} scan`}
                    fill
                    priority
                    sizes="(max-width: 768px) 95vw, (max-width: 1279px) 90vw, 420px"
                    className="object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    No preview available
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-400 flex flex-col items-center gap-2 p-4 text-center">
                <div className="bg-white p-3 sm:p-4 rounded-full shadow-sm">
                  <Search className="w-6 h-6 sm:w-8 sm:h-8 text-slate-300" />
                </div>
                <p className="text-sm sm:text-base">
                  Select a log to view details
                </p>
              </div>
            )}
          </div>
        </figure>

        {/* Data-first record summary */}
        <div className="order-1 flex flex-col">
          {/* Result Card */}
          {selectedLog ? (
            <article className="space-y-5 border border-[#ded9cd] bg-white p-5 sm:p-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#77736c]">Saved AI-assisted record</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-serif text-4xl tracking-tight text-[#292b4c]">{selectedLog.stage}</h2>
                  <Badge variant="outline" className="border-[#b8b7e1] bg-[#eeedf9] text-[#353a87]">
                    {isManualReview
                      ? "Scientist entered"
                      : predictionAccepted
                        ? "AI proposal accepted"
                        : selectedProposedStage
                          ? "Scientist corrected AI"
                          : "Scientist reviewed"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-[#625f58]">
                  {selectedContext?.capture_date
                    ? format(new Date(`${selectedContext.capture_date}T00:00:00`), "MMMM d, yyyy")
                    : format(new Date(selectedLog.created_at), "MMMM d, yyyy")}
                </p>
              </div>

              {selectedStageScores && selectedProposedStage && (
                <section className="border border-[#c9c7e7] bg-[#fbfaff] p-4 sm:p-5">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#595ea3]">AI proposal at review time</p>
                      <p className="mt-1 font-serif text-2xl text-[#292b4c]">{selectedProposedStage}</p>
                    </div>
                    <p className="text-xs font-semibold text-[#555a9d]">
                      {predictionAccepted ? "Accepted unchanged" : `Corrected to ${selectedLog.stage}`}
                    </p>
                  </div>
                  <StageDistribution
                    className="mt-4"
                    compact
                    scores={selectedStageScores}
                    predictedStage={selectedProposedStage}
                  />
                  <p className="mt-3 text-[10px] leading-4 text-[#77736c]">
                    Scores are relative model support, not calibrated probabilities. The saved stage above is the reviewed scientific record.
                  </p>
                </section>
              )}

              <section className="border-y border-[#ebe6dc] py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#77736c]">Scientist note</p>
                <p className="mt-2 text-sm leading-6 text-[#4f4b45]">
                  {selectedLog.notes || "No note was added to this observation."}
                </p>
              </section>

                {selectedExternalBinary && (
                  <details data-testid="saved-binary-crosscheck" className="border border-[#b8b7e1] bg-[#eeedf9] p-4 text-sm">
                    <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-[#30345f]">
                      <span>Model cross-check · {selectedExternalBinary.decision_status === "reference_backed_suggestion" ? "reference-backed lead" : "abstained safely"}</span>
                      <ChevronDown className="h-4 w-4" />
                    </summary>
                    <div className="mt-3 space-y-2 border-t border-[#d5d2e5] pt-3 text-xs leading-5 text-[#5e5d75]">
                      <p><span className="font-semibold text-[#30345f]">Group:</span> {selectedExternalBinary.reference_backed_binary_suggestion === "PROESTRUS_OR_ESTRUS" ? "Proestrus / estrus" : selectedExternalBinary.reference_backed_binary_suggestion === "METESTRUS_OR_DIESTRUS" ? "Metestrus / diestrus" : "No reference-backed group"}</p>
                      <p><span className="font-semibold text-[#30345f]">Raw early-group support:</span> {Math.round(selectedExternalBinary.probability_proestrus_or_estrus * 100)}%</p>
                      <p><span className="font-semibold text-[#30345f]">Model:</span> <span className="font-mono">{selectedExternalBinary.model_version}</span></p>
                      <p>This binary external-photo result is corroborating evidence only; it does not replace the saved four-stage decision or cytology.</p>
                      {selectedModelInput?.readable_image_url && (
                        <div className="border-t border-[#d5d2e5] pt-3">
                          <div className="flex items-center justify-between gap-3"><p className="font-semibold text-[#30345f]">Prepared model input</p><span>{selectedModelInput.crop?.output_width || 640} × {selectedModelInput.crop?.output_height || 640}</span></div>
                          <div className="relative mt-2 aspect-square overflow-hidden border border-[#b8b7e1] bg-white">
                            <Image src={selectedModelInput.readable_image_url} alt="Prepared external-photo model input" fill sizes="280px" className="object-contain" />
                            <div className="pointer-events-none absolute inset-[6.25%] border border-dashed border-white shadow-[0_0_0_999px_rgba(25,24,20,0.12)]" aria-hidden="true" />
                          </div>
                          <p className="mt-2">The original photo remains the observation image. This prepared ROI is the separate crop analyzed by the model.</p>
                        </div>
                      )}
                    </div>
                  </details>
                )}

                {selectedContext && (
                  <details className="border border-[#ded9cd] bg-[#fbfaf7] p-4 text-sm text-[#4f4b45]">
                    <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-[#4f4b45]">
                      <span>Evidence and provenance</span><ChevronDown className="h-4 w-4" />
                    </summary>
                    <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                      {formatModality(selectedContext.modality) && <><dt className="text-slate-500">Modality</dt><dd>{formatModality(selectedContext.modality)}</dd></>}
                      {selectedContext.capture_date && <><dt className="text-slate-500">Captured</dt><dd>{format(new Date(`${selectedContext.capture_date}T00:00:00`), "MMM d, yyyy")}</dd></>}
                      {selectedContext.label_status === "uncertain_or_transition" && <><dt className="text-slate-500">Label status</dt><dd>Uncertain / transition</dd></>}
                      {isPairedCytology && <><dt className="text-slate-500">Confirmation</dt><dd>Paired vaginal cytology</dd></>}
                      {selectedLog.reference_sample_id && <><dt className="text-slate-500">Reference sample</dt><dd>{selectedLog.reference_sample_id}</dd></>}
                      {Object.entries(selectedCaptureMetadata).map(([key, value]) => <><dt key={`${key}-label`} className="text-slate-500">{CAPTURE_METADATA_LABELS[key] || key}</dt><dd key={`${key}-value`}>{value}</dd></>)}
                    </dl>
                    {selectedLog.reference_image_url && (
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <p className="mb-2 text-xs font-medium text-slate-500">Paired cytology reference</p>
                        <div className="relative h-32 overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <Image src={selectedLog.reference_image_url} alt="Paired vaginal cytology reference" fill sizes="280px" className="object-contain" />
                        </div>
                      </div>
                    )}
                  </details>
                )}

                {/* Legacy Support: Fallback if data.confidence_scores is missing but confidence is an object */}
                {!selectedLog.data?.confidence_scores &&
                  selectedLog.confidence &&
                  typeof selectedLog.confidence === "object" &&
                  Object.keys(selectedLog.confidence).length > 1 && (
                    <details className="border border-[#ded9cd] bg-[#fbfaf7] p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-[#4f4b45]">Legacy four-stage scores</summary>
                      <div className="mt-3 space-y-2 border-t border-[#ded9cd] pt-3">
                      {Object.entries(selectedLog.confidence).map(
                        ([stage, score]) => {
                          if (stage === "score") return null; // Skip legacy field
                          const val = score as number;
                          return (
                            <div
                              key={stage}
                              className="flex items-center gap-2 text-xs"
                            >
                              <div className="w-20 font-medium text-slate-600">
                                {stage}
                              </div>
                              <div className="flex-1 h-1.5 bg-slate-50 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${val * 100}%`,
                                    backgroundColor:
                                      STAGE_COLORS[stage] || "#94a3b8",
                                    opacity:
                                      stage === selectedLog.stage ? 1 : 0.3,
                                  }}
                                />
                              </div>
                              <div className="w-10 text-right text-slate-500">
                                {Math.round(val * 100)}%
                              </div>
                            </div>
                          );
                        }
                      )}
                      </div>
                    </details>
                  )}
            </article>
          ) : (
            <div className="glass-panel rounded-2xl sm:rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center text-slate-400 border border-white/40 shadow-sm bg-white/60 backdrop-blur-xl min-h-[200px] lg:h-full">
              <p className="text-sm sm:text-base">No scan selected</p>
            </div>
          )}

        </div>
      </div>
      </>)}

      {/* Bottom: Data Library */}
      {logs.length > 0 && <section className="order-5 flex flex-col gap-4 border border-[#ded9cd] bg-white p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#77736c]">Saved record</p>
            <h2 className="mt-1 font-serif text-2xl text-[#292b4c]">
              All observations
            </h2>
          </div>
          <span className="text-sm font-semibold text-[#625f58]">{logs.length}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {logs.map((log) => (
            <button
              type="button"
              key={log.id}
              aria-pressed={selectedLog?.id === log.id}
              className={`group text-left transition ${
                selectedLog?.id === log.id
                  ? "text-[#353a87]"
                  : "text-[#625f58] hover:text-[#292b4c]"
              }`}
              onClick={() => setSelectedLog(log)}
            >
              <div
                className={`relative mb-2 aspect-video overflow-hidden border bg-[#f4f1e9] transition ${
                  selectedLog?.id === log.id
                    ? "border-[#454a9f] ring-2 ring-[#454a9f]/20"
                    : "border-[#ded9cd] group-hover:border-[#b8b7e1]"
                }`}
              >
                {log.image_url ? (
                  <Image
                    src={log.image_url}
                    alt={log.stage}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 15vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-[10px] sm:text-xs">
                    No preview
                  </div>
                )}
                <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2">
                  <Badge
                    className={`
                    text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 h-4 sm:h-5 backdrop-blur-md border-0 shadow-sm
                    ${
                      log.stage === "Proestrus"
                        ? "bg-pink-500/90 text-white"
                        : log.stage === "Estrus"
                        ? "bg-rose-500/90 text-white"
                        : log.stage === "Diestrus"
                        ? "bg-emerald-500/90 text-white"
                        : log.stage === "Metestrus"
                        ? "bg-sky-500/90 text-white"
                        : "bg-slate-500/90 text-white"
                    }
                  `}
                  >
                    {log.stage}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">
                  {format(new Date(log.created_at), "MMM d, yyyy")}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>}
    </div>
  );
}
