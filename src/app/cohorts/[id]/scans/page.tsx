import { getCohort, getCohortScanSessions } from "@/app/actions";
import { ScanHistoryClient } from "./scan-history-client";
import { notFound } from "next/navigation";

export default async function ScanHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  const [cohort, sessions] = await Promise.all([
    getCohort(id),
    getCohortScanSessions(id),
  ]);

  if (!cohort) {
    notFound();
  }

  return (
    <ScanHistoryClient
      cohort={cohort}
      sessions={sessions}
    />
  );
}

