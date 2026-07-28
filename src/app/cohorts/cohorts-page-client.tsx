"use client";

import { useState } from "react";
import { CohortManager, type NewCohort } from "@/components/cohort-manager";
import { createCohort } from "@/app/actions";

type Cohort = {
  id: string;
  name: string;
  description: string | null;
  color: string;
};

export function CohortsPageClient({
  initialCohorts,
}: {
  initialCohorts: Cohort[];
}) {
  const [cohorts, setCohorts] = useState(initialCohorts);

  async function handleAddCohort(newCohort: NewCohort) {
    const formData = new FormData();
    formData.append("name", newCohort.name);
    formData.append("description", newCohort.description);
    const cohort = await createCohort(formData);
    setCohorts((current) => [cohort, ...current]);
  }

  return (
    <div className="page-shell space-y-6 md:space-y-8">
      <div>
        <p className="page-eyebrow">Lab organization</p>
        <h1 className="page-title mt-1">Cohorts</h1>
        <p className="mt-2 text-sm text-muted-foreground">Group subjects by study or colony, then move into their scan history when you are ready to review.</p>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
        <CohortManager cohorts={cohorts} onAddCohort={handleAddCohort} />
      </div>
    </div>
  );
}
