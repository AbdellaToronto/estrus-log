'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface BatchUploadCardProps {
  cohorts: any[];
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
    <Card className={`overflow-hidden relative group border-dashed border-2 ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-2 group-hover:scale-110 transition-transform duration-300">
            <UploadCloud className="w-6 h-6" />
          </div>
          <Sparkles className="w-5 h-5 text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse" />
        </div>
        <CardTitle className="text-xl">Batch Analysis</CardTitle>
        <CardDescription>
          Upload multiple images to automatically classify estrus stages using AI.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="relative space-y-4">
        {cohorts.length > 1 ? (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Select Cohort</label>
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
            Target: <span className="font-medium text-foreground">{cohorts[0]?.name}</span>
          </div>
        )}

        <Button 
          className="w-full group-hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90" 
          onClick={handleStart}
          disabled={!selectedCohortId}
        >
          Start Upload
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  );
}
