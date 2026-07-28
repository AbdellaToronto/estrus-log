'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, ArrowRight } from "lucide-react";

interface CohortOption {
  id: string;
  name: string;
}

interface BatchUploadCardProps {
  cohorts: CohortOption[];
  className?: string;
}

export function BatchUploadCard({ cohorts, className }: BatchUploadCardProps) {
  const router = useRouter();
  const [selectedCohortId, setSelectedCohortId] = useState<string>(
    cohorts.length > 0 ? cohorts[0].id : ''
  );

  const handleStart = () => {
    if (selectedCohortId) {
      router.push(`/cohorts/${selectedCohortId}/batch`);
    }
  };

  if (cohorts.length === 0) return null;

  return (
    <Card className={`relative overflow-hidden border-primary/20 ${className}`}>
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
      
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UploadCloud className="w-6 h-6" />
          </div>
        </div>
        <CardTitle className="text-xl">Review a batch</CardTitle>
        <CardDescription>
          Upload images from one session and confirm each suggested stage before saving.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="relative space-y-4">
        {cohorts.length > 1 ? (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Save to cohort</label>
            <Select value={selectedCohortId} onValueChange={setSelectedCohortId}>
              <SelectTrigger className="bg-white/50 backdrop-blur-sm">
                <SelectValue placeholder="Select a cohort" />
              </SelectTrigger>
              <SelectContent>
                {cohorts.map((cohort) => (
                  <SelectItem key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Saving to <span className="font-medium text-foreground">{cohorts[0]?.name}</span>
          </div>
        )}

        <Button
          className="w-full"
          onClick={handleStart}
          disabled={!selectedCohortId}
        >
          Choose images
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
