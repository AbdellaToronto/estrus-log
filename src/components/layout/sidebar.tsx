'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  UserPlus,
  Cog,
} from "lucide-react";
import { UserButton, OrganizationSwitcher, useUser, useOrganization } from "@clerk/nextjs";
import { getPendingRequestsForOrg } from "@/app/actions";

// Navigation items when user HAS an organization
const ORG_NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Cohorts', href: '/cohorts', icon: Users },
  { label: 'Experiments', href: '/experiments', icon: TestTube },
  { label: 'Settings', href: '/settings', icon: Settings },
];

// Navigation items when user has NO organization (exploring)
const EXPLORE_NAV_ITEMS = [
  { label: 'Find a Lab', href: '/discover', icon: Search },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { organization } = useOrganization();
  const [pendingCount, setPendingCount] = useState(0);

  const hasOrg = !!organization;
  const navItems = hasOrg ? ORG_NAV_ITEMS : EXPLORE_NAV_ITEMS;

  // Fetch pending join requests count
  useEffect(() => {
    if (organization?.id) {
      getPendingRequestsForOrg(organization.id)
        .then((requests) => setPendingCount(requests.length))
        .catch(() => setPendingCount(0));
    } else {
      setPendingCount(0);
    }
  }, [organization?.id]);

  // Don't show sidebar on certain pages
  const hiddenPaths = ['/sign-in', '/sign-up'];
  if (hiddenPaths.some(path => pathname.startsWith(path))) {
    return null;
  }

  return (
    <aside className="hidden lg:flex fixed left-4 top-4 bottom-4 w-64 rounded-3xl glass-panel flex-col p-6 z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
          <FlaskConical className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-none">Estrus Log</h1>
          <p className="text-xs text-muted-foreground">Research Platform</p>
        </div>
      </div>
      
      {/* Organization Switcher - only show if user has orgs */}
      {hasOrg ? (
        <div className="mb-6 px-2">
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
                organizationSwitcherTrigger: "w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10",
                organizationPreviewTextContainer: "mr-auto",
                organizationPreviewMainIdentifier: "text-sm font-medium text-foreground",
                organizationPreviewSecondaryIdentifier: "text-xs text-muted-foreground",
                organizationSwitcherPopoverCard: "!z-[100]",
                organizationSwitcherPopoverActions: "!z-[100]",
              }
            }}
          />
        </div>
      ) : (
        <div className="mb-6 px-2">
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

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1">
        {/* Section Label */}
        <div className="px-4 py-2">
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
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-colors",
                isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
              )} />
              <span className="font-medium">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50" />
              )}
            </Link>
          );
        })}

        {/* Lab Management section for users with orgs */}
        {hasOrg && (
          <>
            <div className="my-4 mx-4 border-t border-white/10" />
            <div className="px-4 py-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Lab Management
              </span>
            </div>
            <Link
              href="/organization/requests"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                pathname.startsWith('/organization')
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <Cog className={cn(
                "w-5 h-5 transition-colors",
                pathname.startsWith('/organization') ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
              )} />
              <span className="font-medium">Lab Settings</span>
              {pendingCount > 0 && (
                <Badge 
                  className={cn(
                    "ml-auto text-[10px] px-1.5 py-0 h-5 min-w-[20px] justify-center",
                    pathname.startsWith('/organization')
                      ? "bg-white/20 text-white"
                      : "bg-amber-500 text-white"
                  )}
                >
                  {pendingCount}
                </Badge>
              )}
            </Link>
            
            <div className="my-4 mx-4 border-t border-white/10" />
            <div className="px-4 py-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Community
              </span>
            </div>
            <Link
              href="/discover"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                pathname === '/discover'
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <Search className={cn(
                "w-5 h-5 transition-colors",
                pathname === '/discover' ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
              )} />
              <span className="font-medium">Discover Labs</span>
            </Link>
          </>
        )}
      </nav>

      {/* User Profile */}
      <div className="mt-auto pt-6 border-t border-white/10">
        <div className="flex items-center gap-3 px-2">
          <UserButton afterSignOutUrl="/" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.fullName || 'User'}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
