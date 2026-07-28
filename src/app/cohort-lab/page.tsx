import { notFound } from "next/navigation";
import { CohortClient } from "@/app/cohorts/[id]/cohort-client";
import type { Cohort } from "@/lib/types";
import type { CohortInsights } from "@/app/actions";

const cohort: Cohort = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "North colony · Cycle study",
  description: "Daily external-photo review with paired cytology checkpoints.",
  type: "Estrus tracking",
  color: "#454a9f",
  created_at: "2026-06-02T14:00:00.000Z",
  user_id: "local-audit",
  org_id: null,
  log_config: null,
  subject_config: null,
};

const subjects = [
  { id: "00000000-0000-4000-8000-000000000101", name: "N-221", coat_colour: "black", strain: "C57BL/6J", status: "Active", created_at: "2026-06-02T14:00:00.000Z" },
  { id: "00000000-0000-4000-8000-000000000102", name: "N-222", coat_colour: "agouti", strain: "C57BL/6J", status: "Active", created_at: "2026-06-02T14:00:00.000Z" },
  { id: "00000000-0000-4000-8000-000000000103", name: "N-223", coat_colour: "white", strain: "BALB/c", status: "Active", created_at: "2026-06-02T14:00:00.000Z" },
  { id: "00000000-0000-4000-8000-000000000104", name: "N-224", coat_colour: null, strain: null, status: "Active", created_at: "2026-06-02T14:00:00.000Z" },
  { id: "00000000-0000-4000-8000-000000000105", name: "N-225", coat_colour: "black", strain: "C57BL/6J", status: "Active", created_at: "2026-06-02T14:00:00.000Z" },
  { id: "00000000-0000-4000-8000-000000000106", name: "N-226", coat_colour: "agouti", strain: "CD-1", status: "Active", created_at: "2026-06-02T14:00:00.000Z" },
];

const externalBinary = (
  group: "PROESTRUS_OR_ESTRUS" | "METESTRUS_OR_DIESTRUS",
  confirmationSource: "scientist_review" | "paired_cytology_review" = "scientist_review"
) => ({
  evidence: {
    external_binary: {
      decision_status: "reference_backed_suggestion",
      reference_backed_binary_suggestion: group,
      model_version: "s-biad2395-dinov2-robust-ensemble-20260719-v2",
    },
  },
  model_input_reference: {
    image_object_reference: "/assets/generated/observation-lab/public-prepared-roi.png",
    crop_confirmed: true,
  },
  observation_context: {
    modality: "external_photo",
    confirmation_source: confirmationSource,
  },
});

const logs = [
  { id: "l1", mouse_id: subjects[1].id, stage: "Estrus", created_at: "2026-07-19T12:15:00.000Z", capture_date: "2026-07-19", image_url: "/assets/generated/observation-lab/public-prepared-roi.png", modality: "external_photo", label_status: "confirmed", confirmation_source: "paired_cytology_review", reference_modality: "vaginal_cytology", reference_image_url: "/assets/generated/observation-lab/public-prepared-roi.png", reference_sample_id: "CYT-2026-0719-222", confidence: 0.66, data: externalBinary("PROESTRUS_OR_ESTRUS", "paired_cytology_review"), mice: { name: subjects[1].name } },
  { id: "l2", mouse_id: subjects[4].id, stage: "Diestrus", created_at: "2026-07-19T11:42:00.000Z", capture_date: "2026-07-19", image_url: "/assets/generated/observation-lab/public-prepared-roi.png", modality: "external_photo", label_status: "confirmed", confirmation_source: "paired_cytology_review", reference_modality: "vaginal_cytology", reference_image_url: "/assets/generated/observation-lab/public-prepared-roi.png", reference_sample_id: "CYT-2026-0719-225", confidence: 0.71, data: externalBinary("METESTRUS_OR_DIESTRUS", "paired_cytology_review"), mice: { name: subjects[4].name } },
  { id: "l3", mouse_id: subjects[0].id, stage: "Proestrus", created_at: "2026-07-18T12:02:00.000Z", capture_date: "2026-07-18", image_url: "/assets/generated/observation-lab/public-prepared-roi.png", modality: "external_photo", label_status: "confirmed", confirmation_source: "paired_cytology_review", reference_modality: "vaginal_cytology", reference_image_url: "/assets/generated/observation-lab/public-prepared-roi.png", reference_sample_id: "CYT-2026-0718-221", confidence: 0.62, data: externalBinary("PROESTRUS_OR_ESTRUS", "paired_cytology_review"), mice: { name: subjects[0].name } },
  { id: "l4", mouse_id: subjects[2].id, stage: "Metestrus", created_at: "2026-07-18T11:20:00.000Z", capture_date: "2026-07-18", image_url: "/assets/generated/observation-lab/public-prepared-roi.png", modality: "external_photo", label_status: "confirmed", confirmation_source: "paired_cytology_review", reference_modality: "vaginal_cytology", reference_image_url: "/assets/generated/observation-lab/public-prepared-roi.png", reference_sample_id: "CYT-2026-0718-223", confidence: 0.69, data: externalBinary("METESTRUS_OR_DIESTRUS", "paired_cytology_review"), mice: { name: subjects[2].name } },
  { id: "l5", mouse_id: subjects[3].id, stage: "Uncertain / transition", created_at: "2026-07-17T10:05:00.000Z", capture_date: "2026-07-17", image_url: "/assets/generated/observation-lab/public-prepared-roi.png", modality: "external_photo", label_status: "uncertain_or_transition", confirmation_source: "scientist_review", reference_modality: null, reference_image_url: null, reference_sample_id: null, confidence: 0, data: { observation_context: { modality: "external_photo", confirmation_source: "scientist_review" } }, mice: { name: subjects[3].name } },
  { id: "l6", mouse_id: subjects[5].id, stage: "Diestrus", created_at: "2026-07-17T09:48:00.000Z", capture_date: "2026-07-17", image_url: "/assets/generated/observation-lab/public-prepared-roi.png", modality: "external_photo", label_status: "confirmed", confirmation_source: "scientist_review", reference_modality: null, reference_image_url: null, reference_sample_id: null, confidence: 0.74, data: externalBinary("METESTRUS_OR_DIESTRUS"), mice: { name: subjects[5].name } },
];

const insights: CohortInsights = {
  totalLogs: 42,
  modelSupportedLogs: 31,
  binaryModelReviews: 18,
  binarySuggestions: 15,
  binaryAbstentions: 3,
  binaryEarlyLeads: 7,
  binaryLateLeads: 8,
  stageDistribution: [
    { stage: "Proestrus", value: 9 },
    { stage: "Estrus", value: 11 },
    { stage: "Metestrus", value: 8 },
    { stage: "Diestrus", value: 12 },
    { stage: "Uncertain / transition", value: 2 },
  ],
  confidenceByStage: [
    { stage: "Proestrus", value: 0.61 },
    { stage: "Estrus", value: 0.67 },
    { stage: "Metestrus", value: 0.58 },
    { stage: "Diestrus", value: 0.7 },
  ],
  timeline: [
    { date: "2026-07-14", value: 5 },
    { date: "2026-07-15", value: 6 },
    { date: "2026-07-16", value: 6 },
    { date: "2026-07-17", value: 6 },
    { date: "2026-07-18", value: 6 },
    { date: "2026-07-19", value: 2 },
  ],
  featureBreakdown: { swelling: [], color: [], opening: [], moistness: [] },
  recentLogs: logs.slice(0, 6).map((log) => {
    const binary = (log.data as { evidence?: { external_binary?: { decision_status?: string; reference_backed_binary_suggestion?: string } } }).evidence?.external_binary;
    return {
      id: log.id,
      stage: log.stage,
      confidence: typeof log.confidence === "number" ? log.confidence : 0,
      hasModelSupport: Boolean(binary),
      created_at: log.created_at,
      subjectName: log.mice.name,
      imageUrl: log.image_url,
      binaryDecisionStatus: binary?.decision_status ?? null,
      binaryGroup: binary?.reference_backed_binary_suggestion ?? null,
    };
  }),
};

export const metadata = { title: "Estrus cohort audit lab" };

export default function CohortLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.ESTRUS_WORKFLOW_LAB !== "true") notFound();
  return <CohortClient cohort={cohort} initialLogs={logs} initialInsights={insights} initialSubjects={subjects} todayKey="2026-07-19" />;
}
