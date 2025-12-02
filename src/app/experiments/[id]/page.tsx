import { getExperiment, getCohorts, getExperimentInsights, getExperimentVisualizationData } from "@/app/actions";
import { ExperimentDetailClient } from "./experiment-detail-client";

export default async function ExperimentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const [experiment, allCohorts, insights, visualizationData] = await Promise.all([
    getExperiment(resolvedParams.id),
    getCohorts(),
    getExperimentInsights(resolvedParams.id),
    getExperimentVisualizationData(resolvedParams.id)
  ]);

  if (!experiment) {
    return (
      <div className="container py-8">
        <h1 className="text-2xl font-bold">Experiment not found</h1>
        <p className="text-muted-foreground">The requested experiment could not be found or the ID is invalid.</p>
      </div>
    );
  }

  return (
    <ExperimentDetailClient 
      experiment={experiment} 
      allCohorts={allCohorts} 
      insights={insights} 
      visualizationData={visualizationData}
    />
  );
}

