'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

type Cohort = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
};

export function CohortList({ cohorts }: { cohorts: Cohort[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">Cohorts</CardTitle>
        <Link href="/cohorts" className="text-sm text-primary hover:underline">
          View All
        </Link>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-2">
          {cohorts.map((cohort) => (
            <Link 
              key={cohort.id} 
              href={`/cohorts/${cohort.id}`}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
            >
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${cohort.color?.replace('bg-', 'bg-') || 'bg-blue-500'}`} />
                <div className="flex flex-col">
                    <span className="text-sm font-medium">{cohort.name}</span>
                    {cohort.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[150px]">{cohort.description}</span>
                    )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
          {cohorts.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No cohorts found.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}







