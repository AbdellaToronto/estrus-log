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
  FlaskConical,
  LogOut,
  TestTube
} from "lucide-react";
import { UserButton, OrganizationSwitcher, useUser } from "@clerk/nextjs";

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Cohorts', href: '/cohorts', icon: Users },
  { label: 'Experiments', href: '/experiments', icon: TestTube },
  { label: 'Library', href: '/library', icon: Library },
  { label: 'Settings', href: '/settings', icon: Settings },
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
