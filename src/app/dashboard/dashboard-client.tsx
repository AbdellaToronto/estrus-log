'use client';

import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DashboardStats as DashboardStatsComponent } from "@/components/dashboard/dashboard-stats";
import { StageTrendChart } from "@/components/dashboard/stage-trend-chart";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { CohortList } from "@/components/dashboard/cohort-list";
import { BatchUploadCard } from "@/components/dashboard/batch-upload-card";
import { OnboardingFlow } from "@/components/onboarding";
import type { DashboardStats } from "@/app/actions";
import { useUser } from "@clerk/nextjs";

export function DashboardClient({ 
  initialCohorts, 
  initialSubjects,
  stats 
}: { 
  initialCohorts: any[], 
  initialSubjects: any[],
  stats: DashboardStats
}) {
  const [search, setSearch] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { user } = useUser();

  // Show onboarding if user has no cohorts
  useEffect(() => {
    if (initialCohorts.length === 0) {
      setShowOnboarding(true);
    }
  }, [initialCohorts.length]);

  // If showing onboarding, render that instead
  if (showOnboarding) {
    return (
      <OnboardingFlow 
        onComplete={() => {
          setShowOnboarding(false);
          // Refresh the page to get the new cohort
          window.location.reload();
        }} 
      />
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground/80">Dashboard</h1>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search subjects..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/40 border-white/20 rounded-full w-full sm:w-64 focus-visible:ring-0 focus-visible:bg-white/60 transition-all"
            />
          </div>
          <Avatar className="h-9 w-9 border-2 border-white/20 flex-shrink-0 hidden sm:flex">
            <AvatarImage src={user?.imageUrl} />
            <AvatarFallback>
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Stats Row */}
      <DashboardStatsComponent 
        totalSubjects={stats.totalSubjects} 
        todaysScans={stats.todaysScans} 
        stageDistribution={stats.stageDistribution} 
      />

      {/* 7-Day Activity Chart - Full Width */}
      <StageTrendChart data={stats.dailyTrend} />

      {/* Main Content Grid - Actions first, then Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Actions & Cohorts (prioritized) */}
        <div className="space-y-6 lg:order-first">
          <BatchUploadCard cohorts={initialCohorts} />
          <CohortList cohorts={initialCohorts} />
        </div>

        {/* Right Column: Recent Activity (less prominent) */}
        <RecentActivity activities={stats.recentActivity} />
      </div>
    </div>
  );
}
