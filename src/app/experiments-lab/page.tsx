import { notFound } from "next/navigation";
import { ExperimentsClient } from "@/app/experiments/experiments-client";

const experiments = [
  {
    id: "00000000-0000-4000-8000-000000000401",
    name: "Diet intervention · Cycle timing",
    description: "Compare daily cycle progression across control and intervention cohorts.",
    status: "active",
    start_date: "2026-07-01",
    end_date: "2026-08-12",
    created_at: "2026-06-25T14:00:00.000Z",
    experiment_cohorts: [{ cohort_id: "00000000-0000-4000-8000-000000000001" }, { cohort_id: "00000000-0000-4000-8000-000000000002" }],
  },
  {
    id: "00000000-0000-4000-8000-000000000402",
    name: "North colony baseline",
    description: "Paired-cytology baseline collection before the intervention window.",
    status: "planned",
    start_date: "2026-08-15",
    end_date: null,
    created_at: "2026-07-15T14:00:00.000Z",
    experiment_cohorts: [{ cohort_id: "00000000-0000-4000-8000-000000000001" }],
  },
  {
    id: "00000000-0000-4000-8000-000000000403",
    name: "Imaging protocol pilot",
    description: "Completed acquisition and framing pilot.",
    status: "completed",
    start_date: "2026-05-10",
    end_date: "2026-05-24",
    created_at: "2026-05-04T14:00:00.000Z",
    experiment_cohorts: [],
  },
];

export const metadata = { title: "Estrus experiments audit lab" };

export default function ExperimentsLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.ESTRUS_WORKFLOW_LAB !== "true") notFound();
  return <ExperimentsClient initialExperiments={experiments} />;
}
