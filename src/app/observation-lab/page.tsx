import { notFound } from "next/navigation";
import { ObservationLabClient } from "./observation-lab-client";

export default function ObservationLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.ESTRUS_WORKFLOW_LAB !== "true") notFound();
  return <ObservationLabClient />;
}
