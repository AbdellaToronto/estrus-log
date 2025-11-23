'use client';

import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DashboardStats as DashboardStatsComponent } from "@/components/dashboard/dashboard-stats";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { CohortList } from "@/components/dashboard/cohort-list";
import type { DashboardStats } from "@/app/actions";

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

  // We might use 'initialSubjects' for search or just ignore it if we don't show the full library here.
  // If the user searches, we could maybe show a dropdown or filter the cohorts?
  // For now, I'll leave the search bar but it won't filter anything visible unless I add search results.
  // Actually, let's make the search bar redirect to the library or filter the cohort list if names match?
  // Let's just keep it visual for now or remove it if it does nothing. 
  // The user had a search bar, so I'll keep it but maybe make it just a placeholder for future global search.

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground/80">Dashboard</h1>
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search subjects..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/40 border-white/20 rounded-full w-64 focus-visible:ring-0 focus-visible:bg-white/60 transition-all"
            />
          </div>
          <Avatar className="h-9 w-9 border-2 border-white/20">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>LW</AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Stats Row */}
      <DashboardStatsComponent 
        totalSubjects={stats.totalSubjects} 
        todaysScans={stats.todaysScans} 
        stageDistribution={stats.stageDistribution} 
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Recent Activity */}
        <RecentActivity activities={stats.recentActivity} />

        {/* Right Column: Cohorts & Quick Links */}
        <div className="space-y-6">
          <CohortList cohorts={initialCohorts} />
          
          {/* Maybe a "Quick Start" card? */}
          {/* 
          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent>
              <Button className="w-full">Start New Scan Session</Button>
            </CardContent>
          </Card> 
          */}
        </div>
      </div>
    </div>
  );
}
