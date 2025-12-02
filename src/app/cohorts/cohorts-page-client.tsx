"use client";

import { useState } from "react";
import { CohortManager } from "@/components/cohort-manager";
import { createCohort } from "@/app/actions";

type Cohort = {
  id: string;
  name: string;
  description: string;
  color: string;
};

export function CohortsPageClient({
  initialCohorts,
}: {
  initialCohorts: Cohort[];
}) {
  const [cohorts, setCohorts] = useState(initialCohorts);

  async function handleAddCohort(newCohort: Cohort) {
    // Optimistic update
    setCohorts([newCohort, ...cohorts]);
    const formData = new FormData();
    formData.append("name", newCohort.name);
    formData.append("description", newCohort.description);
    await createCohort(formData);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground/80">Cohorts</h1>
      </div>

      <div className="glass-panel rounded-3xl p-6">
        <CohortManager cohorts={cohorts} onAddCohort={handleAddCohort} />
      </div>
    </div>
  );
}
