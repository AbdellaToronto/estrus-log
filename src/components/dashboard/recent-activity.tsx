'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from 'date-fns';

type RecentActivityItem = {
  id: string;
  mouseName: string;
  cohortName: string;
  stage: string;
  imageUrl: string | null;
  time: string;
};

export function RecentActivity({ activities }: { activities: RecentActivityItem[] }) {
  return (
    <Card className="col-span-4 md:col-span-2 lg:col-span-2">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              No recent scans found.
            </div>
          )}
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center space-x-4 rounded-md border p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="relative h-12 w-12 flex-none overflow-hidden rounded-md bg-muted">
                 {activity.imageUrl ? (
                    <img
                      src={activity.imageUrl}
                      alt={activity.mouseName}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://placehold.co/100x100?text=Mouse';
                      }}
                    />
                 ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      No Img
                    </div>
                 )}
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">
                  {activity.mouseName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {activity.cohortName} • {formatDistanceToNow(new Date(activity.time), { addSuffix: true })}
                </p>
              </div>
              <div className="flex-none">
                 <Badge variant={
                    activity.stage === 'Estrus' ? 'destructive' :
                    activity.stage === 'Proestrus' ? 'default' :
                    'secondary'
                 }>
                    {activity.stage}
                 </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}






