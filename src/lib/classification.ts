export type ClassificationStage =
  | "Proestrus"
  | "Estrus"
  | "Metestrus"
  | "Diestrus"
  | "Uncertain";

export type ClassificationFeatures = {
  swelling?: string;
  color?: string;
  opening?: string;
  moistness?: string;
  [key: string]: string | undefined;
};

export type StagePrediction = {
  name: ClassificationStage;
  confidence: number;
};

export type ClassificationResult = {
  stage: StagePrediction[] | ClassificationStage;
  reasoning?: string;
  confidence?: number;
  features?: ClassificationFeatures;
};

export function getPrimaryStagePrediction(
  result?: ClassificationResult | null
): StagePrediction | null {
  if (!result?.stage) {
    return null;
  }

  if (Array.isArray(result.stage)) {
    if (result.stage.length === 0) {
      return null;
    }

    return result.stage.reduce<StagePrediction | null>((best, entry) => {
      if (!best || entry.confidence > best.confidence) {
        return entry;
      }
      return best;
    }, null);
  }

  const fallbackConfidence =
    typeof result.confidence === "number" ? result.confidence : 1;

  return {
    name: result.stage,
    confidence: fallbackConfidence,
  };
}

export function getPrimaryStageName(
  result?: ClassificationResult | null
): ClassificationStage | null {
  return getPrimaryStagePrediction(result)?.name ?? null;
}

export function getPrimaryStageConfidence(
  result?: ClassificationResult | null
): number {
  return getPrimaryStagePrediction(result)?.confidence ?? 0;
}

export function filenameFromPath(path: string): string {
  const segments = path.split("/");
  return decodeURIComponent(segments[segments.length - 1] || "asset");
}

export function extractSubjectNameFromFilename(
  filename: string
): string | null {
  const token = filename.split(/[_\s.-]/)[0];
  if (!token) return null;
  return token.trim();
}

