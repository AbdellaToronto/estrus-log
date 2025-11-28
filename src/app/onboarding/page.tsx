import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { OnboardingClient } from "./onboarding-client";
import {
  searchOrganizations,
  getInstitutions,
  getMyJoinRequests,
} from "@/app/actions";

export default async function OnboardingPage() {
  const { userId, orgId } = await auth();

  // If user is not signed in, redirect to sign-in
  if (!userId) {
    redirect("/sign-in");
  }

  // If user already has an org, redirect to dashboard
  if (orgId) {
    redirect("/dashboard");
  }

  // Fetch initial data
  const [organizations, institutions, myRequests] = await Promise.all([
    searchOrganizations(),
    getInstitutions(),
    getMyJoinRequests(),
  ]);

  return (
    <OnboardingClient
      initialOrganizations={organizations}
      institutions={institutions}
      myRequests={myRequests}
    />
  );
}

