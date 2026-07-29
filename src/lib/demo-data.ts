import type { Cohort } from "@/lib/types";
import type { CohortInsights } from "@/app/actions";

export const DEMO_TODAY = "2026-07-19";
export const DEMO_IMAGE = "/assets/generated/observation-lab/public-prepared-roi.png";

export const DEMO_COHORT: Cohort = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "North colony · Cycle study",
  description: "Illustrative public-reference workflow with a white-fur mouse series.",
  type: "Estrus tracking",
  color: "#454a9f",
  created_at: "2026-06-02T14:00:00.000Z",
  user_id: "demo",
  org_id: null,
  log_config: null,
  subject_config: null,
};

const SUBJECT_SPECS = [
  ["N-221", "white", "BALB/c"], ["N-222", "white", "BALB/c"], ["N-223", "white", "BALB/c"],
  ["N-224", "white", "BALB/c"], ["N-225", "white", "BALB/c"], ["N-226", "white", "BALB/c"],
  ["N-227", "black", "C57BL/6J"], ["N-228", "black", "C57BL/6J"], ["N-229", "agouti", "CD-1"],
  ["N-230", "agouti", "CD-1"], ["N-231", "white", "BALB/c"], ["N-232", "white", "BALB/c"],
] as const;

export const DEMO_SUBJECTS = SUBJECT_SPECS.map(([name, coatColour, strain], index) => ({
  id: `00000000-0000-4000-8000-${String(index + 101).padStart(12, "0")}`,
  name,
  coat_colour: coatColour,
  strain,
  status: "Active",
  created_at: "2026-06-02T14:00:00.000Z",
}));

const STAGES = ["Proestrus", "Estrus", "Metestrus", "Diestrus"] as const;
const dateForOffset = (offset: number) => {
  const date = new Date(`${DEMO_TODAY}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
};

const historicalDates = Array.from({ length: 20 }, (_, index) => dateForOffset(20 - index));

type DemoEvidence = {
  evidence?: { external_binary?: { decision_status: string; reference_backed_binary_suggestion?: string; model_version: string } };
  model_input_reference: { image_object_reference: string; crop_confirmed: boolean };
  observation_context: { modality: "external_photo"; confirmation_source: "scientist_review" | "paired_cytology_review" };
};

const evidenceFor = (subjectIndex: number, dayIndex: number): DemoEvidence => {
  const paired = (subjectIndex + dayIndex) % 3 === 0;
  const abstained = (subjectIndex * 2 + dayIndex) % 11 === 0;
  const early = (Math.floor(subjectIndex / 2) + dayIndex) % 2 === 0;
  return {
    evidence: abstained ? {
      external_binary: {
        decision_status: "abstained_acquisition_review",
        model_version: "s-biad2395-dinov2-robust-ensemble-20260719-v2",
      },
    } : {
      external_binary: {
        decision_status: "reference_backed_suggestion",
        reference_backed_binary_suggestion: early ? "PROESTRUS_OR_ESTRUS" : "METESTRUS_OR_DIESTRUS",
        model_version: "s-biad2395-dinov2-robust-ensemble-20260719-v2",
      },
    },
    model_input_reference: { image_object_reference: DEMO_IMAGE, crop_confirmed: true },
    observation_context: { modality: "external_photo", confirmation_source: paired ? "paired_cytology_review" : "scientist_review" },
  };
};

const buildLog = (subjectIndex: number, dayIndex: number, captureDate: string, recordIndex: number) => {
  const subject = DEMO_SUBJECTS[subjectIndex];
  const transition = (subjectIndex * 3 + dayIndex) % 19 === 0;
  const stage = transition ? "Uncertain / transition" : STAGES[(Math.floor(subjectIndex / 2) + dayIndex) % STAGES.length];
  const data = evidenceFor(subjectIndex, dayIndex);
  const paired = data.observation_context.confirmation_source === "paired_cytology_review";
  return {
    id: `demo-log-${recordIndex}`,
    mouse_id: subject.id,
    stage,
    created_at: `${captureDate}T${String(9 + (subjectIndex % 7)).padStart(2, "0")}:${String(8 + ((dayIndex * 7) % 45)).padStart(2, "0")}:00.000Z`,
    capture_date: captureDate,
    image_url: DEMO_IMAGE,
    modality: "external_photo",
    label_status: transition ? "uncertain_or_transition" : "confirmed",
    confirmation_source: data.observation_context.confirmation_source,
    reference_modality: paired ? "vaginal_cytology" : null,
    reference_image_url: paired ? DEMO_IMAGE : null,
    reference_sample_id: paired ? `CYT-${captureDate.replaceAll("-", "")}-${subject.name}` : null,
    confidence: Number((0.58 + ((subjectIndex + dayIndex) % 17) / 100).toFixed(2)),
    data,
    mice: { name: subject.name },
  };
};

let recordIndex = 1;
export const DEMO_LOGS = [
  ...historicalDates.flatMap((date, dayIndex) => DEMO_SUBJECTS
    .map((_, subjectIndex) => subjectIndex)
    .filter((subjectIndex) => (subjectIndex + dayIndex) % 2 === 0)
    .map((subjectIndex) => buildLog(subjectIndex, dayIndex, date, recordIndex++))),
  ...DEMO_SUBJECTS.slice(0, 7).map((_, subjectIndex) => buildLog(subjectIndex, historicalDates.length, DEMO_TODAY, recordIndex++)),
].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());

const stageDistribution = ["Proestrus", "Estrus", "Metestrus", "Diestrus", "Uncertain / transition"].map((stage) => ({
  stage,
  value: DEMO_LOGS.filter((log) => log.stage === stage).length,
}));

const binaryLogs = DEMO_LOGS.filter((log) => log.data.evidence?.external_binary);
const usableSuggestions = binaryLogs.filter((log) => log.data.evidence?.external_binary?.decision_status === "reference_backed_suggestion");
const timeline = [...historicalDates, DEMO_TODAY].map((date) => ({
  date,
  value: DEMO_LOGS.filter((log) => log.capture_date === date).length,
}));

export const DEMO_INSIGHTS: CohortInsights = {
  totalLogs: DEMO_LOGS.length,
  modelSupportedLogs: binaryLogs.length,
  binaryModelReviews: binaryLogs.length,
  binarySuggestions: usableSuggestions.length,
  binaryAbstentions: binaryLogs.length - usableSuggestions.length,
  binaryEarlyLeads: usableSuggestions.filter((log) => log.data.evidence?.external_binary?.reference_backed_binary_suggestion === "PROESTRUS_OR_ESTRUS").length,
  binaryLateLeads: usableSuggestions.filter((log) => log.data.evidence?.external_binary?.reference_backed_binary_suggestion === "METESTRUS_OR_DIESTRUS").length,
  stageDistribution,
  confidenceByStage: [
    { stage: "Proestrus", value: 0.63 }, { stage: "Estrus", value: 0.68 }, { stage: "Metestrus", value: 0.6 }, { stage: "Diestrus", value: 0.71 },
  ],
  timeline,
  featureBreakdown: {
    swelling: [{ label: "Moderate", value: 42 }, { label: "Pronounced", value: 31 }, { label: "Subtle", value: 18 }],
    color: [{ label: "Pink", value: 46 }, { label: "Pale", value: 28 }, { label: "Deep pink", value: 17 }],
    opening: [{ label: "Open", value: 38 }, { label: "Partially open", value: 33 }, { label: "Closed", value: 20 }],
    moistness: [{ label: "Moist", value: 49 }, { label: "Dry", value: 25 }, { label: "Mixed", value: 17 }],
  },
  recentLogs: DEMO_LOGS.slice(0, 12).map((log) => ({
    id: log.id,
    stage: log.stage,
    confidence: log.confidence,
    hasModelSupport: Boolean(log.data.evidence?.external_binary),
    created_at: log.created_at,
    subjectName: log.mice.name,
    imageUrl: log.image_url,
    binaryDecisionStatus: log.data.evidence?.external_binary?.decision_status ?? null,
    binaryGroup: log.data.evidence?.external_binary?.reference_backed_binary_suggestion ?? null,
  })),
};
