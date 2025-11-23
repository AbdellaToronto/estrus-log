import { z } from "zod";

export type ClassificationStage = "Proestrus" | "Estrus" | "Metestrus" | "Diestrus" | "Uncertain";

// Matches the schema from src/app/api/classify/route.ts (Reverted version)
export interface ClassificationResult {
  estrus_stage: ClassificationStage;
  confidence_scores: {
    Proestrus: number;
    Estrus: number;
    Metestrus: number;
    Diestrus: number;
  };
  features: {
    vaginal_opening: string;
    tissue_color: string;
    swelling: string;
    moisture: string;
  };
  reasoning: string;
  thoughts?: string;
}

export function getPrimaryStageName(result?: ClassificationResult | null): ClassificationStage | undefined {
  if (!result?.estrus_stage) return undefined;
  return result.estrus_stage;
}

export function getPrimaryStageConfidence(result?: ClassificationResult | null): number {
  if (!result?.confidence_scores || !result?.estrus_stage) return 0;
  const stage = result.estrus_stage;
  // @ts-ignore - Dynamic access to confidence scores
  return result.confidence_scores[stage] || 0;
}

export function getPrimaryStagePrediction(result?: ClassificationResult | null): { name: ClassificationStage; confidence: number } | undefined {
  const name = getPrimaryStageName(result);
  if (!name) return undefined;

  return {
    name,
    confidence: getPrimaryStageConfidence(result)
  };
}
