'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, PieChart } from "lucide-react";

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
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Subjects
          </CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalSubjects}</div>
          <p className="text-xs text-muted-foreground">
            Active in colony
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Scans Today
          </CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{todaysScans}</div>
          <p className="text-xs text-muted-foreground">
            Logs recorded today
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            7-Day Distribution
          </CardTitle>
          <PieChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 text-xs mt-2">
             {stageDistribution.slice(0, 3).map(d => (
               <div key={d.stage} className="flex flex-col items-center">
                  <div className="font-bold">{Math.round((d.value / totalScansInDistribution) * 100) || 0}%</div>
                  <div className="text-muted-foreground truncate w-16 text-center">{d.stage}</div>
               </div>
             ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

