import { getSubject, getSubjectLogs } from "@/app/actions";
import { MousePageClient } from "./mouse-page-client";

export default async function MousePage({ params }: { params: { id: string } }) {
  const [subject, logs] = await Promise.all([
    getSubject(params.id),
    getSubjectLogs(params.id)
  ]);

  return <MousePageClient subject={subject} initialLogs={logs} />;
}
