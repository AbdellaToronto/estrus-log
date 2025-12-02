import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DiscoverClient } from "./discover-client";
import {
  searchOrganizations,
  getInstitutions,
  getMyJoinRequests,
} from "@/app/actions";

export default async function DiscoverPage() {
  const { userId } = await auth();

  // If user is not signed in, redirect to sign-in
  if (!userId) {
    redirect("/sign-in");
  }

  // Note: We DON'T redirect if user has an org
  // Users should be able to discover and join other labs

  // Fetch initial data
  const [organizations, institutions, myRequests] = await Promise.all([
    searchOrganizations(),
    getInstitutions(),
    getMyJoinRequests(),
  ]);

  return (
    <DiscoverClient
      initialOrganizations={organizations}
      institutions={institutions}
      myRequests={myRequests}
    />
  );
}

