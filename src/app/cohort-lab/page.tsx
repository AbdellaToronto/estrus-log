import { notFound } from "next/navigation";
import { CohortClient } from "@/app/cohorts/[id]/cohort-client";
import { DEMO_COHORT, DEMO_INSIGHTS, DEMO_LOGS, DEMO_SUBJECTS, DEMO_TODAY } from "@/lib/supervisor-demo-data";

export const metadata = { title: "Estrus cohort supervisor demo" };

export default function CohortLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.ESTRUS_WORKFLOW_LAB !== "true") notFound();
  return <CohortClient cohort={DEMO_COHORT} initialLogs={DEMO_LOGS} initialInsights={DEMO_INSIGHTS} initialSubjects={DEMO_SUBJECTS} todayKey={DEMO_TODAY} demoMode />;
}
