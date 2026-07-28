import { notFound } from "next/navigation";
import { WorkflowCanvas } from "./workflow-canvas";

export const metadata = {
  title: "Estrus workflow lab",
  description: "Local-only journey canvas and UI workflow test surface.",
};

export default function WorkflowLabPage() {
  if (process.env.ESTRUS_WORKFLOW_LAB !== "true") notFound();
  return <WorkflowCanvas />;
}
