'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const FULL_BLEED_PATHS = ['/sign-in', '/sign-up', '/onboarding', '/onboarding-flow-lab', '/workflow-lab', '/observation-lab', '/cohort-lab', '/dashboard-lab', '/experiments-lab', '/experiment-detail-lab', '/batch-lab', '/demo'];

export function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullBleed = FULL_BLEED_PATHS.some((path) => pathname.startsWith(path));

  if (pathname.startsWith('/cohort-lab') || pathname.startsWith('/dashboard-lab') || pathname.startsWith('/experiments-lab') || pathname.startsWith('/experiment-detail-lab')) {
    return <main className="min-h-screen px-4 py-6 lg:px-8">{children}</main>;
  }

  if (fullBleed) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <main className={cn('min-h-screen', 'px-4 pb-8 pt-20 lg:px-7 lg:pb-12 lg:pt-24')}>
      {children}
    </main>
  );
}
