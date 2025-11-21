import { getCohort, getCohortSubjects, getScanSession, getCohortInsights, getCohortLogs } from "@/app/actions";
import { CohortClient } from "./cohort-client";
import { notFound } from "next/navigation";

export default async function CohortPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  
  try {
    const [cohort, subjects, activeSession, insights, logs] = await Promise.all([
      getCohort(params.id),
      getCohortSubjects(params.id),
      getScanSession(params.id),
      getCohortInsights(params.id),
      getCohortLogs(params.id)
    ]);

    return <CohortClient cohort={cohort} initialSubjects={subjects} activeSession={activeSession} insights={insights} logs={logs} />;
  } catch (e) {
    console.error(e);
    notFound();
  }
}
