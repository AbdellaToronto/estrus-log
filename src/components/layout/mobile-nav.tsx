"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Users,
  Settings,
  FlaskConical,
  TestTube,
  Search,
  Building2,
  Menu,
  ChevronRight,
} from "lucide-react";
import {
  UserButton,
  useUser,
  useOrganization,
  useOrganizationList,
} from "@clerk/nextjs";
import { useHydrated } from "@/hooks/use-hydrated";
import { Badge } from "@/components/ui/badge";

// Navigation items when user HAS an organization
const ORG_NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Cohorts", href: "/cohorts", icon: Users },
  { label: "Experiments", href: "/experiments", icon: TestTube },
  { label: "Settings", href: "/settings", icon: Settings },
];

// Navigation items when user has NO organization (exploring)
const EXPLORE_NAV_ITEMS = [
  { label: "Find a Lab", href: "/discover", icon: Search },
];

const HIDDEN_PATHS = ["/sign-in", "/sign-up", "/onboarding", "/onboarding-flow-lab", "/workflow-lab", "/observation-lab", "/cohort-lab", "/dashboard-lab", "/experiments-lab", "/experiment-detail-lab", "/batch-lab", "/supervisor-demo"];

export function MobileNav() {
  const pathname = usePathname();

  if (HIDDEN_PATHS.some((path) => pathname.startsWith(path))) {
    return null;
  }

  return <MobileNavContent pathname={pathname} />;
}

function MobileNavContent({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const { user } = useUser();
  const { organization } = useOrganization();
  const { userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const hydrated = useHydrated();
  const isLocalRehearsal =
    process.env.NEXT_PUBLIC_ESTRUS_LOCAL_TEST_IDENTITY === "true";

  const hasOrg = isLocalRehearsal || (hydrated && !!organization);
  const navItems = hasOrg ? ORG_NAV_ITEMS : EXPLORE_NAV_ITEMS;

  const handleSwitchOrg = async (orgId: string) => {
    if (orgId === organization?.id || isSwitching || !setActive) return;

    setIsSwitching(true);
    try {
      await setActive({ organization: orgId });
      setOpen(false);
      // Refresh the page to load the newly selected lab's data.
      window.location.assign("/dashboard");
    } catch (error) {
      console.error("Failed to switch organization:", error);
      alert("Failed to switch lab. Please try again.");
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FlaskConical className="w-5 h-5" />
          </div>
          <span className="font-bold text-base">Estrus Log</span>
        </Link>

        {/* Right side: User + Menu */}
        <div className="flex items-center gap-2">
          {isLocalRehearsal ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
              LS
            </div>
          ) : (
            <UserButton afterSignOutUrl="/" />
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] p-0 glass-panel">
              <SheetHeader className="p-4 border-b border-white/10">
                <SheetTitle className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-primary" />
                  Navigation
                </SheetTitle>
              </SheetHeader>

              <div className="flex flex-col h-full">
                {/* Organization Section */}
                {isLocalRehearsal ? (
                  <div className="border-b border-white/10 p-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <div className="flex items-center gap-2 text-emerald-800">
                        <Building2 className="h-4 w-4" />
                        <span className="text-sm font-semibold">Estrus Lab</span>
                      </div>
                      <p className="mt-1 text-xs text-emerald-700">
                        Local rehearsal · isolated data
                      </p>
                    </div>
                  </div>
                ) : hasOrg ? (
                  <div className="p-4 border-b border-white/10 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
                      Your Labs
                    </p>

                    {/* List all orgs the user is in */}
                    {userMemberships?.data?.map((membership) => {
                      const isActive =
                        membership.organization.id === organization?.id;
                      return (
                        <button
                          key={membership.organization.id}
                          onClick={() =>
                            handleSwitchOrg(membership.organization.id)
                          }
                          disabled={isSwitching}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left",
                            isActive
                              ? "bg-primary/10 border border-primary/20"
                              : "hover:bg-white/5 border border-transparent"
                          )}
                        >
                          <div
                            className={cn(
                              "w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm",
                              isActive
                                ? "bg-primary"
                                : "bg-linear-to-br from-slate-500 to-slate-600"
                            )}
                          >
                            {membership.organization.name?.[0] || "L"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "font-medium text-sm truncate",
                                isActive && "text-primary"
                              )}
                            >
                              {membership.organization.name}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {membership.role.replace("org:", "")}
                            </p>
                          </div>
                          {isActive && (
                            <Badge className="bg-primary/20 text-primary text-[10px] px-1.5">
                              Active
                            </Badge>
                          )}
                        </button>
                      );
                    })}

                    {/* Link to discover more labs */}
                    <Link
                      href="/discover"
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between p-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors mt-2"
                    >
                      <span className="flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        Discover & Join Labs
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="p-4 border-b border-white/10">
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-2 text-amber-600 mb-1">
                        <Building2 className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          No Lab Selected
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Join or create a lab to access all features
                      </p>
                    </div>
                    <Link
                      href="/onboarding"
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-center gap-2 mt-3 p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                    >
                      <Search className="w-4 h-4" />
                      Find a Lab
                    </Link>
                  </div>
                )}

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                  <div className="pb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {hasOrg ? "Lab Tools" : "Explore"}
                    </span>
                  </div>

                  {navItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/" && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "w-5 h-5",
                            isActive
                              ? "text-primary-foreground"
                              : "text-muted-foreground"
                          )}
                        />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}

                  {/* Secondary nav for users with orgs */}
                  {hasOrg && (
                    <>
                      <div className="my-4 border-t border-white/10" />
                      <div className="pb-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Community
                        </span>
                      </div>
                      <Link
                        href="/discover"
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
                          pathname === "/discover"
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                        )}
                      >
                        <Search className="w-5 h-5" />
                        <span className="font-medium">Discover Labs</span>
                      </Link>
                    </>
                  )}
                </nav>

                {/* User info at bottom */}
                <div className="p-4 border-t border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {isLocalRehearsal
                          ? "Local Scientist"
                          : user?.fullName || "User"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {isLocalRehearsal
                          ? "scientist@estrus.local"
                          : user?.primaryEmailAddress?.emailAddress}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
