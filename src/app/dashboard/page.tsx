import { getCohorts, getDashboardStats } from "@/app/actions";
import { format } from "date-fns";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const renderedAt = new Date();
  const [cohorts, stats] = await Promise.all([
    getCohorts(),
    getDashboardStats()
  ]);

  return (
    <DashboardClient 
      initialCohorts={cohorts} 
      stats={stats} 
      todayKey={format(renderedAt, "yyyy-MM-dd")}
      renderedAt={renderedAt.toISOString()}
    />
  );
}
