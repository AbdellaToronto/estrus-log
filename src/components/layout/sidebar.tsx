'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Users, 
  Library, 
  Settings, 
  FlaskConical
} from "lucide-react";
import { UserButton, OrganizationSwitcher, useUser } from "@clerk/nextjs";

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Cohorts', icon: Users, href: '/cohorts' }, // Placeholder route
  { label: 'Library', icon: Library, href: '/library' }, // Placeholder route
  { label: 'Settings', icon: Settings, href: '/settings' }, // Placeholder route
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <aside className="fixed left-4 top-4 bottom-4 w-64 rounded-3xl glass-panel flex flex-col p-6 z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
          <FlaskConical className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-none">Estrus Log</h1>
          <p className="text-xs text-muted-foreground">Research Tool</p>
        </div>
      </div>
      
      {/* Organization Switcher */}
      <div className="mb-6 px-2">
         <OrganizationSwitcher 
           hidePersonal={false}
           afterCreateOrganizationUrl="/dashboard"
           afterSelectOrganizationUrl="/dashboard"
           afterSelectPersonalUrl="/dashboard"
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

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 h-12 rounded-xl transition-all duration-300",
                  isActive 
                    ? "bg-primary/10 text-primary font-semibold shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Button>
            </Link>
          );
        })}
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
