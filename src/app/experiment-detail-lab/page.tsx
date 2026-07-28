import { notFound } from "next/navigation";
import { ExperimentDetailClient } from "@/app/experiments/[id]/experiment-detail-client";

const experiment = {
  id: "00000000-0000-4000-8000-000000000401",
  name: "Diet intervention · Cycle timing",
  description:
    "Compare daily cycle progression across control and intervention cohorts.",
  status: "active",
  start_date: "2026-07-01",
  end_date: "2026-08-12",
  experiment_cohorts: [
    {
      cohort_id: "00000000-0000-4000-8000-000000000001",
      cohorts: {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Control · North colony",
        description: "Standard diet and handling protocol.",
        color: "#4f46e5",
      },
    },
    {
      cohort_id: "00000000-0000-4000-8000-000000000002",
      cohorts: {
        id: "00000000-0000-4000-8000-000000000002",
        name: "Diet intervention",
        description: "Intervention diet begun after baseline collection.",
        color: "#b45309",
      },
    },
  ],
};

const allCohorts = [
  ...experiment.experiment_cohorts.map(({ cohorts }) => cohorts),
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Protocol pilot",
    description: "Acquisition protocol pilot subjects.",
    color: "#0f766e",
  },
];

const insights = {
  totalLogs: 23,
  totalSubjects: 6,
  observationDays: 4,
  dateRange: { start: "2026-07-14", end: "2026-07-17" },
  confirmedLogs: 21,
  uncertainLogs: 2,
  missingCaptureDates: 0,
  pairedCytologyLogs: 8,
  binarySuggestions: 13,
  binaryAbstentions: 4,
  subjectsMissingMetadata: 1,
  stageDistribution: [
    { stage: "Diestrus", value: 7 },
    { stage: "Estrus", value: 5 },
    { stage: "Proestrus", value: 4 },
    { stage: "Metestrus", value: 2 },
  ],
  timeline: [
    { date: "2026-07-14", value: 5 },
    { date: "2026-07-15", value: 6 },
    { date: "2026-07-16", value: 4 },
    { date: "2026-07-17", value: 3 },
  ],
  cohortStats: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Control · North colony",
      subjectCount: 3,
      logCount: 12,
      pairedCytologyCount: 5,
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      name: "Diet intervention",
      subjectCount: 3,
      logCount: 11,
      pairedCytologyCount: 3,
    },
  ],
};

const subjects = [
  ["c1-m1", "N01", "00000000-0000-4000-8000-000000000001"],
  ["c1-m2", "N02", "00000000-0000-4000-8000-000000000001"],
  ["c1-m3", "N03", "00000000-0000-4000-8000-000000000001"],
  ["c2-m1", "D01", "00000000-0000-4000-8000-000000000002"],
  ["c2-m2", "D02", "00000000-0000-4000-8000-000000000002"],
  ["c2-m3", "D03", "00000000-0000-4000-8000-000000000002"],
] as const;

const stageByDay = ["Proestrus", "Estrus", "Metestrus", "Diestrus"];
const logs = subjects.flatMap(([mouseId], subjectIndex) =>
  ["2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17"]
    .filter((_, dayIndex) => !(mouseId === "c2-m2" && dayIndex === 2))
    .map((date, dayIndex) => ({
      id: `${mouseId}-${date}`,
      mouse_id: mouseId,
      stage: stageByDay[(subjectIndex + dayIndex) % stageByDay.length],
      date,
      capture_date: date,
      modality: "external_photo",
      label_status: subjectIndex === 5 && dayIndex === 3 ? "uncertain_or_transition" : "confirmed",
      confirmation_source: dayIndex === 0 ? "paired_cytology_review" : "scientist_batch_review",
      reference_modality: dayIndex === 0 ? "vaginal_cytology" : null,
      binary_decision_status: dayIndex === 2 ? "abstain" : "reference_backed_suggestion",
      binary_group_suggestion: dayIndex < 2 ? "PROESTRUS_OR_ESTRUS" : "METESTRUS_OR_DIESTRUS",
    }))
);

const visualizationData = {
  cohorts: experiment.experiment_cohorts.map(({ cohorts }) => ({
    id: cohorts.id,
    name: cohorts.name,
    color: cohorts.color,
    mice: subjects
      .filter((subject) => subject[2] === cohorts.id)
      .map(([id, name]) => ({ id, name })),
  })),
  logs,
};

export const metadata = { title: "Estrus experiment detail audit lab" };

export default function ExperimentDetailLabPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ESTRUS_WORKFLOW_LAB !== "true"
  ) {
    notFound();
  }

  return (
    <ExperimentDetailClient
      experiment={experiment}
      allCohorts={allCohorts}
      insights={insights}
      visualizationData={visualizationData}
    />
  );
}
