"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

const PUBLIC_REHEARSAL_PATHS = [
  "/onboarding-flow-lab",
  "/workflow-lab",
  "/observation-lab",
  "/cohort-lab",
  "/dashboard-lab",
  "/experiments-lab",
  "/experiment-detail-lab",
  "/batch-lab",
  "/demo",
] as const;

/**
 * Public workflow rehearsals are self-contained and never read authenticated
 * records. Keeping Clerk outside those routes removes a third-party dependency
 * (and its development-instance limits) from the demonstration,
 * while the real application remains behind the normal Clerk provider.
 */
export function RouteAwareClerkProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPublicRehearsal = PUBLIC_REHEARSAL_PATHS.some((path) =>
    pathname.startsWith(path)
  );

  if (isPublicRehearsal) return children;

  return (
    <ClerkProvider
      afterSignOutUrl="/"
      signInFallbackRedirectUrl="/onboarding"
      signUpFallbackRedirectUrl="/onboarding"
    >
      {children}
    </ClerkProvider>
  );
}
