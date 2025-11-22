import { getCohorts } from "@/app/actions";
import { CohortsPageClient } from "./cohorts-page-client";

export default async function CohortsPage() {
  const cohorts = await getCohorts();

  return <CohortsPageClient initialCohorts={cohorts} />;
}
