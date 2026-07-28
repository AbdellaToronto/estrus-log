import { getCohort, getCohortLogs, getCohortInsights, getCohortSubjects } from "@/app/actions";
import { CohortClient } from "./cohort-client";
import { notFound } from "next/navigation";

export default async function CohortPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;

  const cohortData = await Promise.all([
    getCohort(id),
    getCohortLogs(id),
    getCohortInsights(id),
    getCohortSubjects(id),
  ]).catch((error) => {
    console.error(error);
    return null;
  });

  if (!cohortData) notFound();

  const [cohort, logs, insights, subjects] = cohortData;
  if (!cohort) notFound();

  return (
    <CohortClient
      cohort={cohort}
      initialLogs={logs}
      initialInsights={insights}
      initialSubjects={subjects}
    />
  );
}
