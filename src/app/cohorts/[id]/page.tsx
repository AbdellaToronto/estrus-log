import { getCohort, getCohortLogs, getCohortInsights, getCohortSubjects } from "@/app/actions";
import { CohortClient } from "./cohort-client";
import { notFound } from "next/navigation";

export default async function CohortPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;

  try {
    const [cohort, logs, insights, subjects] = await Promise.all([
      getCohort(id),
      getCohortLogs(id),
      getCohortInsights(id),
      getCohortSubjects(id)
    ]);

    if (!cohort) return notFound();

    return (
      <CohortClient 
        cohort={cohort} 
        initialLogs={logs} 
        initialInsights={insights}
        initialSubjects={subjects}
      />
    );
  } catch (e) {
    console.error(e);
    return notFound();
  }
}
