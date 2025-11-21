import { getSubject, getSubjectLogs } from "@/app/actions";
import { SubjectPageClient } from "./subject-page-client";

export default async function SubjectPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [subject, logs] = await Promise.all([
    getSubject(params.id),
    getSubjectLogs(params.id)
  ]);

  return <SubjectPageClient subject={subject} initialLogs={logs} />;
}
