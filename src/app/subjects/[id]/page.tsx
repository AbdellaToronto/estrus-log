import { getSubject, getSubjectLogs } from "@/app/actions";
import { SubjectPageClient } from "./subject-page-client";

export default async function SubjectPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;

  const [subject, logs] = await Promise.all([
    getSubject(id),
    getSubjectLogs(id)
  ]);

  return <SubjectPageClient subject={subject} initialLogs={logs} />;
}
