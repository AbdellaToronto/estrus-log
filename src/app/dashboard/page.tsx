import { getCohorts, getSubjects } from "@/app/actions";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const [cohorts, subjects] = await Promise.all([
    getCohorts(),
    getSubjects()
  ]);

  return <DashboardClient initialCohorts={cohorts} initialSubjects={subjects} />;
}
