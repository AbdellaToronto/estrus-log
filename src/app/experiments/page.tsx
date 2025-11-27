import { getExperiments } from "@/app/actions";
import { ExperimentsClient } from "./experiments-client";

export default async function ExperimentsPage() {
  const experiments = await getExperiments();
  return <ExperimentsClient initialExperiments={experiments} />;
}






