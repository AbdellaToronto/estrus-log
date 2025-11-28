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
  Library, 
  Settings, 
  FlaskConical,
  TestTube,
  Search,
  Building2,
  Globe,
  Menu,
} from "lucide-react";
import { UserButton, OrganizationSwitcher, useUser, useOrganization } from "@clerk/nextjs";

// Navigation items when user HAS an organization
const ORG_NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Cohorts', href: '/cohorts', icon: Users },
  { label: 'Experiments', href: '/experiments', icon: TestTube },
  { label: 'Library', href: '/library', icon: Library },
  { label: 'Settings', href: '/settings', icon: Settings },
];

// Navigation items when user has NO organization (exploring)
const EXPLORE_NAV_ITEMS = [
  { label: 'Find a Lab', href: '/discover', icon: Search },
  { label: 'Browse Research', href: '/explore', icon: Globe },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useUser();
  const { organization } = useOrganization();

  const hasOrg = !!organization;
  const navItems = hasOrg ? ORG_NAV_ITEMS : EXPLORE_NAV_ITEMS;

  // Don't show on certain pages
  const hiddenPaths = ['/sign-in', '/sign-up'];
  if (hiddenPaths.some(path => pathname.startsWith(path))) {
    return null;
  }

  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/20">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
            <FlaskConical className="w-5 h-5" />
          </div>
          <span className="font-bold text-base">Estrus Log</span>
        </Link>

        {/* Right side: User + Menu */}
        <div className="flex items-center gap-2">
          <UserButton afterSignOutUrl="/" />
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
                {/* Organization Switcher */}
                {hasOrg ? (
                  <div className="p-4 border-b border-white/10">
                    <OrganizationSwitcher 
                      hidePersonal={true}
                      afterCreateOrganizationUrl="/dashboard"
                      afterSelectOrganizationUrl="/dashboard"
                      afterSelectPersonalUrl="/onboarding"
                      organizationProfileMode="navigation"
                      organizationProfileUrl="/organization"
                      appearance={{
                        elements: {
                          rootBox: "w-full",
                          organizationSwitcherTrigger: "w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors",
                          organizationPreviewTextContainer: "mr-auto",
                          organizationPreviewMainIdentifier: "text-sm font-medium text-foreground",
                          organizationPreviewSecondaryIdentifier: "text-xs text-muted-foreground"
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="p-4 border-b border-white/10">
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-2 text-amber-600 mb-1">
                        <Building2 className="w-4 h-4" />
                        <span className="text-sm font-medium">No Lab Selected</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Join or create a lab to access all features
                      </p>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                  <div className="pb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {hasOrg ? 'Lab Tools' : 'Explore'}
                    </span>
                  </div>
                  
                  {navItems.map((item) => {
                    const isActive = pathname === item.href || 
                      (item.href !== '/' && pathname.startsWith(item.href));
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
                        <item.icon className={cn(
                          "w-5 h-5",
                          isActive ? "text-primary-foreground" : "text-muted-foreground"
                        )} />
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
                          pathname === '/discover'
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                            : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                        )}
                      >
                        <Search className="w-5 h-5" />
                        <span className="font-medium">Discover Labs</span>
                      </Link>
                      <Link
                        href="/explore"
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
                          pathname === '/explore'
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                            : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                        )}
                      >
                        <Globe className="w-5 h-5" />
                        <span className="font-medium">Public Research</span>
                      </Link>
                    </>
                  )}
                </nav>

                {/* User info at bottom */}
                <div className="p-4 border-t border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user?.fullName || 'User'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.primaryEmailAddress?.emailAddress}</p>
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

