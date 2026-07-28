import { getCohorts, getDashboardStats } from "@/app/actions";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const [cohorts, stats] = await Promise.all([
    getCohorts(),
    getDashboardStats()
  ]);

  return (
    <DashboardClient 
      initialCohorts={cohorts} 
      stats={stats} 
    />
  );
}
