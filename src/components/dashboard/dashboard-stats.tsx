'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, PieChart, ScanLine } from "lucide-react";

export function DashboardStats({ 
  totalSubjects, 
  todaysScans, 
  stageDistribution 
}: { 
  totalSubjects: number; 
  todaysScans: number; 
  stageDistribution: { stage: string; value: number }[];
}) {
  const totalScansInDistribution = stageDistribution.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
      <Card className="gap-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Subjects</CardTitle>
          <div className="rounded-lg bg-sky-50 p-2 text-sky-700"><Users className="h-4 w-4" /></div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalSubjects}</div>
          <p className="text-xs text-muted-foreground">Active in this lab</p>
        </CardContent>
      </Card>
      <Card className="gap-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Logged today</CardTitle>
          <div className="rounded-lg bg-violet-50 p-2 text-violet-700"><ScanLine className="h-4 w-4" /></div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{todaysScans}</div>
          <p className="text-xs text-muted-foreground">Images reviewed and saved</p>
        </CardContent>
      </Card>
      <Card className="gap-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Most common stage</CardTitle>
          <div className="rounded-lg bg-amber-50 p-2 text-amber-700"><PieChart className="h-4 w-4" /></div>
        </CardHeader>
        <CardContent>
          {stageDistribution.length > 0 ? (
            <div>
              <div className="text-2xl font-bold">{stageDistribution[0]?.stage}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {Math.round(((stageDistribution[0]?.value || 0) / totalScansInDistribution) * 100)}% of recent scans
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No scans yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}




