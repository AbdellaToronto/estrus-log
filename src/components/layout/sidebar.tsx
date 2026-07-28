"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarDays, FlaskConical, Settings, TestTube, Users } from "lucide-react";
import { UserButton, useOrganization } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

const ORG_NAV_ITEMS = [
  { label: "Today", href: "/dashboard", icon: CalendarDays },
  { label: "Cohorts", href: "/cohorts", icon: Users },
  { label: "Studies", href: "/experiments", icon: TestTube },
] as const;

const HIDDEN_PATHS = [
  "/sign-in",
  "/sign-up",
  "/onboarding",
  "/onboarding-flow-lab",
  "/workflow-lab",
  "/observation-lab",
  "/cohort-lab",
  "/dashboard-lab",
  "/experiments-lab",
  "/experiment-detail-lab",
];

/**
 * Kept under the historical Sidebar export to avoid touching the root layout,
 * but deliberately rendered as the quiet, persistent lab header used by the
 * Daily Brief and Batch Review designs.
 */
export function Sidebar() {
  const pathname = usePathname();
  const { organization } = useOrganization();
  const isLocalRehearsal = process.env.NEXT_PUBLIC_ESTRUS_LOCAL_TEST_IDENTITY === "true";
  const hasOrg = isLocalRehearsal || Boolean(organization);

  if (HIDDEN_PATHS.some((path) => pathname.startsWith(path))) return null;

  return (
    <header className="fixed inset-x-0 top-0 z-40 hidden h-16 border-b border-[#ded9cd] bg-[#fbfaf7]/95 backdrop-blur-lg lg:block">
      <div className="mx-auto flex h-full max-w-[1440px] items-center px-7">
        <Link href={hasOrg ? "/dashboard" : "/discover"} className="mr-12 flex items-center gap-2 text-[#292b4c]">
          <FlaskConical className="h-5 w-5" aria-hidden="true" />
          <span className="font-serif text-xl font-semibold tracking-tight">Estrus Log</span>
        </Link>

        <nav className="flex h-full items-center gap-1" aria-label="Primary navigation">
          {(hasOrg ? ORG_NAV_ITEMS : [{ label: "Find a lab", href: "/discover", icon: Building2 }]).map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full items-center gap-2 px-4 text-sm font-medium transition-colors",
                  active ? "text-[#292b4c]" : "text-[#68645d] hover:text-[#353a87]"
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-[#454a9f]" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {isLocalRehearsal && (
            <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800 xl:inline-flex">
              Local rehearsal
            </span>
          )}
          {hasOrg && (
            <Link href="/settings" aria-label="Settings" className="rounded-lg p-2 text-[#68645d] hover:bg-[#f0ede5] hover:text-[#353a87]">
              <Settings className="h-4 w-4" />
            </Link>
          )}
          {isLocalRehearsal ? (
            <div className="flex items-center gap-2 border-l border-[#ded9cd] pl-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8e7f5] text-xs font-bold text-[#353a87]">LS</div>
              <div className="hidden leading-tight xl:block">
                <p className="text-xs font-semibold text-[#292b4c]">Local Scientist</p>
                <p className="text-[10px] text-[#77736c]">Estrus Lab</p>
              </div>
            </div>
          ) : (
            <UserButton afterSignOutUrl="/" />
          )}
        </div>
      </div>
    </header>
  );
}
