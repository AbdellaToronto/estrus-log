import { notFound } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding";

export const metadata = { title: "Estrus first-cohort audit lab" };

export default function OnboardingFlowLabPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ESTRUS_WORKFLOW_LAB !== "true"
  ) {
    notFound();
  }

  return (
    <main>
      <OnboardingFlow labMode />
    </main>
  );
}
