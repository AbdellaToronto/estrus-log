import { getCohorts, getSubjects, getDashboardStats } from "@/app/actions";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const [cohorts, subjects, stats] = await Promise.all([
    getCohorts(),
    getSubjects(),
    getDashboardStats()
  ]);

  return (
    <DashboardClient 
      initialCohorts={cohorts} 
      initialSubjects={subjects} 
      stats={stats} 
    />
  );
}
