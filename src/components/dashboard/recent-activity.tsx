'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistance } from 'date-fns';

type RecentActivityItem = {
  id: string;
  mouseName: string;
  cohortName: string;
  stage: string;
  imageUrl: string | null;
  time: string;
};

const stageClass: Record<string, string> = {
  Proestrus: 'stage-proestrus',
  Estrus: 'stage-estrus',
  Metestrus: 'stage-metestrus',
  Diestrus: 'stage-diestrus',
};

export function RecentActivity({
  activities,
  renderedAt,
}: {
  activities: RecentActivityItem[];
  renderedAt: string;
}) {
  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Recent entries</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">The latest confirmed or reviewed scans.</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              No recent scans found.
            </div>
          )}
          {activities.map((activity) => (
            <article
              key={activity.id}
              className="flex items-center gap-4 rounded-xl border border-border/80 p-3 transition-colors hover:bg-muted/50"
            >
              <div className="relative h-12 w-12 flex-none overflow-hidden rounded-lg bg-muted">
                 {activity.imageUrl ? (
                    <img
                      src={activity.imageUrl}
                      alt={activity.mouseName}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                 ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Camera className="h-4 w-4" aria-hidden="true" />
                    </div>
                 )}
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">
                  {activity.mouseName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {activity.cohortName} • {formatDistance(new Date(activity.time), new Date(renderedAt), { addSuffix: true })}
                </p>
              </div>
              <div className="flex-none">
                 <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', stageClass[activity.stage] || 'stage-unknown')}>
                    {activity.stage}
                 </span>
              </div>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}




