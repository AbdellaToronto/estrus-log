'use client';

import { useState } from 'react';
import { CohortManager } from "@/components/cohort-manager";
import { createCohort } from "@/app/actions";

export function CohortsPageClient({ initialCohorts }: { initialCohorts: any[] }) {
  const [cohorts, setCohorts] = useState(initialCohorts);

  async function handleAddCohort(newCohort: any) {
    // Optimistic update
    setCohorts([newCohort, ...cohorts]);
    const formData = new FormData();
    formData.append('name', newCohort.name);
    formData.append('description', newCohort.description);
    await createCohort(formData);
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground/80">Cohorts</h1>
      </div>
      
      <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6">
         <CohortManager 
          cohorts={cohorts} 
          onAddCohort={handleAddCohort} 
        />
      </div>
    </div>
  );
}

