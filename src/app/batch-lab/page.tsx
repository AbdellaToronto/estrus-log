import { notFound } from "next/navigation";
import { BatchLabClient } from "./batch-lab-client";

export const metadata = { title: "Estrus batch capture supervisor demo" };

export default function BatchLabPage() {
  if (process.env.ESTRUS_WORKFLOW_LAB !== "true") notFound();
  return <BatchLabClient />;
}
