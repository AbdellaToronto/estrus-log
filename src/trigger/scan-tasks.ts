import { batch, logger, task } from "@trigger.dev/sdk/v3";
import { getServiceSupabase } from "@/lib/supabase-admin";
import type { Tables } from "@/lib/database-types";
import { z } from "zod";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";

const supabase = () => getServiceSupabase();

const STAGES = ["Proestrus", "Estrus", "Metestrus", "Diestrus"] as const;
type Stage = (typeof STAGES)[number];

const ClassificationSchema = z.object({
  features: z.object({
    swelling: z.string().optional(),
    color: z.string().optional(),
    opening: z.string().optional(),
    moistness: z.string().optional(),
  }),
  reasoning: z
    .string()
    .describe(
      "Your analysis and thought on the image, described in detail, its state in regards to estrus"
    ),
  estrus_stage: z
    .enum(["Proestrus", "Estrus", "Metestrus", "Diestrus"])
    .describe("The final determined estrus stage"),
  confidence_scores: z
    .object({
      Proestrus: z.number().min(0).max(1),
      Estrus: z.number().min(0).max(1),
      Metestrus: z.number().min(0).max(1),
      Diestrus: z.number().min(0).max(1),
    })
    .describe("Confidence scores for each stage (must sum to roughly 1)"),
});

// Gemini-specific schema (simpler, focused on visual analysis)
const GeminiClassificationSchema = z.object({
  estrus_stage: z
    .enum(["Proestrus", "Estrus", "Metestrus", "Diestrus"])
    .describe("The estrus stage based on visual analysis"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence in this classification (0-1)"),
  features: z.object({
    swelling: z.string().describe("Description of vaginal swelling"),
    color: z.string().describe("Color of the vaginal area (pink, red, pale, etc)"),
    opening: z.string().describe("State of vaginal opening (open, closed, gaping)"),
    moistness: z.string().describe("Moisture level (dry, moist, wet)"),
  }),
  reasoning: z.string().describe("Detailed reasoning for the classification"),
});

type ClassificationResult = z.infer<typeof ClassificationSchema>;

type ScanItemRow = Tables<"scan_items">;

type ScanItemRecord = Omit<ScanItemRow, "ai_result"> & {
  ai_result?: ClassificationResult | null;
};

type BatchChildRun = {
  ok: boolean;
  error?: unknown;
};

async function fetchImageAsBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to fetch image ${url}: ${response.status}`);
  }
  return await response.blob();
}

interface Neighbor {
  id: string;
  label: string;
  similarity: number;
  image_path: string | null;
  metadata: any;
}

// Normalize stage labels to Title Case
const normalizeLabel = (label: string): Stage => {
  const lower = label.toLowerCase();
  const normalized = lower.charAt(0).toUpperCase() + lower.slice(1);
  if (STAGES.includes(normalized as Stage)) {
    return normalized as Stage;
  }
  return "Diestrus"; // Default fallback
};

// Ensemble voting: combine k-NN and Gemini predictions
function ensembleVote(
  knnScores: Record<Stage, number>,
  geminiStage: Stage,
  geminiConfidence: number
): { stage: Stage; confidence_scores: Record<Stage, number>; method: string } {
  // Weight: k-NN gets 40%, Gemini gets 60% (Gemini is more reliable for visual analysis)
  const knnWeight = 0.4;
  const geminiWeight = 0.6;

  // Create Gemini scores (winner takes all, scaled by confidence)
  const geminiScores: Record<Stage, number> = {
    Proestrus: 0,
    Estrus: 0,
    Metestrus: 0,
    Diestrus: 0,
  };
  geminiScores[geminiStage] = geminiConfidence;
  // Distribute remaining confidence among other stages
  const remaining = (1 - geminiConfidence) / 3;
  for (const stage of STAGES) {
    if (stage !== geminiStage) {
      geminiScores[stage] = remaining;
    }
  }

  // Combine scores
  const combined: Record<Stage, number> = {
    Proestrus: knnScores.Proestrus * knnWeight + geminiScores.Proestrus * geminiWeight,
    Estrus: knnScores.Estrus * knnWeight + geminiScores.Estrus * geminiWeight,
    Metestrus: knnScores.Metestrus * knnWeight + geminiScores.Metestrus * geminiWeight,
    Diestrus: knnScores.Diestrus * knnWeight + geminiScores.Diestrus * geminiWeight,
  };

  // Find winner
  let winner: Stage = "Diestrus";
  let maxScore = -1;
  for (const stage of STAGES) {
    if (combined[stage] > maxScore) {
      maxScore = combined[stage];
      winner = stage;
    }
  }

  // Normalize to sum to 1
  const total = Object.values(combined).reduce((a, b) => a + b, 0);
  const normalized: Record<Stage, number> = {
    Proestrus: combined.Proestrus / total,
    Estrus: combined.Estrus / total,
    Metestrus: combined.Metestrus / total,
    Diestrus: combined.Diestrus / total,
  };

  return {
    stage: winner,
    confidence_scores: normalized,
    method: "ensemble (k-NN 40% + Gemini 60%)",
  };
}

export const analyzeScanItemTask = task({
  id: "analyze-scan-item",
  maxDuration: 600,
  run: async ({ scanItemId }: { scanItemId: string }) => {
    const client = supabase();

    const { data: scanItem, error } = await client
      .from("scan_items")
      .select("id, image_url, session_id, status, ai_result")
      .eq("id", scanItemId)
      .single();

    const typedScanItem = scanItem as ScanItemRecord | null;

    if (error || !typedScanItem) {
      throw new Error(`Scan item ${scanItemId} not found`);
    }

    await client
      .from("scan_items")
      .update({ status: "analyzing" })
      .eq("id", scanItemId);

    try {
      // 1. Fetch Image
      const imageBlob = await fetchImageAsBlob(typedScanItem.image_url);
      const arrayBuffer = await imageBlob.arrayBuffer();
      const base64Image = Buffer.from(arrayBuffer).toString("base64");

      // 2. Run BioCLIP k-NN classification
      logger.log("Running BioCLIP k-NN classification...");
      
      const bioclipUrl =
        process.env.BIOCLIP_API_URL ||
        "https://abdellaalioncan--estrus-pipeline-embed-endpoint.modal.run";

      const embedResponse = await fetch(bioclipUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image }),
      });

      if (!embedResponse.ok) {
        const errorText = await embedResponse.text();
        throw new Error(`BioCLIP Error: ${embedResponse.status} - ${errorText}`);
      }

      const { embedding } = (await embedResponse.json()) as { embedding: number[] };

      // Find k-NN neighbors
      const { data: neighborsData, error: matchError } = await (client as any).rpc(
        "match_reference_images",
        {
          query_embedding: embedding,
          match_threshold: 0.0,
          match_count: 5, // Get 5 neighbors for better voting
        }
      );

      if (matchError) {
        logger.error("k-NN search failed", { error: matchError });
        throw new Error("Failed to match reference images");
      }

      const neighbors = (neighborsData as Neighbor[]) || [];

      // Calculate k-NN scores
      const knnVotes: Record<Stage, number> = {
        Proestrus: 0,
        Estrus: 0,
        Metestrus: 0,
        Diestrus: 0,
      };

      neighbors.forEach((n) => {
        const stage = normalizeLabel(n.label);
        knnVotes[stage]++;
      });

      const totalKnnVotes = neighbors.length || 1;
      const knnScores: Record<Stage, number> = {
        Proestrus: knnVotes.Proestrus / totalKnnVotes,
        Estrus: knnVotes.Estrus / totalKnnVotes,
        Metestrus: knnVotes.Metestrus / totalKnnVotes,
        Diestrus: knnVotes.Diestrus / totalKnnVotes,
      };

      const neighborSummary = neighbors
        .map((n) => `${n.label} (${(n.similarity * 100).toFixed(1)}%)`)
        .join(", ");

      logger.log("k-NN results", { knnScores, neighbors: neighborSummary });

      // 3. Run Gemini classification
      logger.log("Running Gemini visual classification...");
      
      let geminiResult: { stage: Stage; confidence: number; features: any; reasoning: string } | null = null;
      
      try {
        const geminiResponse = await generateObject({
          model: google("gemini-1.5-pro-latest"),
          schema: GeminiClassificationSchema,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  image: base64Image,
                },
                {
                  type: "text",
                  text: `You are an expert in mouse estrus cycle staging. Analyze this image of a mouse vaginal area and determine the estrus stage.

The four stages are:
- **Proestrus**: Swollen, pink/red, moist vaginal opening. Cells are mostly nucleated epithelial cells.
- **Estrus**: Open vaginal opening, often gaping. Cornified (keratinized) epithelial cells predominate. May appear slightly dry.
- **Metestrus**: Transitional appearance. Mix of cornified cells and leukocytes. Vaginal opening may be less prominent.
- **Diestrus**: Small, pale vaginal opening. Predominantly leukocytes (white blood cells). Appears dry.

Analyze the visual features carefully and provide your classification with confidence level.`,
                },
              ],
            },
          ],
        });

        geminiResult = {
          stage: geminiResponse.object.estrus_stage,
          confidence: geminiResponse.object.confidence,
          features: geminiResponse.object.features,
          reasoning: geminiResponse.object.reasoning,
        };

        logger.log("Gemini result", { 
          stage: geminiResult.stage, 
          confidence: geminiResult.confidence 
        });
      } catch (geminiError) {
        logger.warn("Gemini classification failed, using k-NN only", { error: geminiError });
      }

      // 4. Ensemble voting (or fallback to k-NN only)
      let finalStage: Stage;
      let finalScores: Record<Stage, number>;
      let method: string;
      let features: ClassificationResult["features"];
      let reasoning: string;

      if (geminiResult) {
        // Use ensemble voting
        const ensemble = ensembleVote(knnScores, geminiResult.stage, geminiResult.confidence);
        finalStage = ensemble.stage;
        finalScores = ensemble.confidence_scores;
        method = ensemble.method;
        features = geminiResult.features;
        reasoning = `${geminiResult.reasoning}\n\n[Ensemble: k-NN neighbors: ${neighborSummary}. k-NN predicted ${Object.entries(knnScores).sort((a, b) => b[1] - a[1])[0][0]}, Gemini predicted ${geminiResult.stage} (${Math.round(geminiResult.confidence * 100)}% confident). Final: ${finalStage}]`;
      } else {
        // Fallback to k-NN only
        finalStage = (Object.entries(knnScores).sort((a, b) => b[1] - a[1])[0][0]) as Stage;
        finalScores = knnScores;
        method = "k-NN only (Gemini unavailable)";
        features = {
          swelling: "N/A",
          color: "N/A",
          opening: "N/A",
          moistness: "N/A",
        };
        reasoning = `Classified using BioCLIP k-NN (k=5). Neighbors: ${neighborSummary}.`;
      }

      const classification: ClassificationResult = {
        estrus_stage: finalStage,
        confidence_scores: finalScores,
        features,
        reasoning,
      };

      // Validate and save
      const validatedResult = ClassificationSchema.parse(classification);

      await client
        .from("scan_items")
        .update({
          status: "complete",
          ai_result: {
            ...validatedResult,
            thoughts: reasoning,
            knn_scores: knnScores,
            gemini_stage: geminiResult?.stage,
            gemini_confidence: geminiResult?.confidence,
            method,
          },
        })
        .eq("id", scanItemId);

      logger.log("Scan item analyzed", { 
        scanItemId, 
        result: finalStage, 
        method,
        knnTop: Object.entries(knnScores).sort((a, b) => b[1] - a[1])[0],
        gemini: geminiResult ? `${geminiResult.stage} (${Math.round(geminiResult.confidence * 100)}%)` : "N/A"
      });

      return classification;
    } catch (error) {
      await client
        .from("scan_items")
        .update({ status: "error" })
        .eq("id", scanItemId);
      logger.error("Failed to analyze scan item", { scanItemId, error });
      throw error;
    }
  },
});

function isBatchChildRun(value: unknown): value is BatchChildRun {
  return typeof value === "object" && value !== null && "ok" in value;
}

function normalizeBatchRuns(result: unknown): BatchChildRun[] {
  if (Array.isArray(result)) {
    return result.filter(isBatchChildRun);
  }
  if (result && typeof result === "object") {
    const runs = (result as { runs?: unknown }).runs;
    if (Array.isArray(runs)) {
      return runs.filter(isBatchChildRun);
    }
  }
  return [];
}

export const analyzeScanSessionTask = task({
  id: "analyze-scan-session",
  maxDuration: 3600,
  run: async ({ sessionId }: { sessionId: string }) => {
    const client = supabase();

    const { data: session, error } = await client
      .from("scan_sessions")
      .select("id, status")
      .eq("id", sessionId)
      .single();

    if (error || !session) {
      throw new Error("Scan session not found");
    }

    const { data: items, error: itemsError } = await client
      .from("scan_items")
      .select("id, status")
      .eq("session_id", sessionId)
      .in("status", ["uploaded", "error"]);

    if (itemsError) throw itemsError;
    const typedItems = (items ?? []) as Array<
      Pick<ScanItemRecord, "id" | "status">
    >;
    if (typedItems.length === 0) {
      logger.log("No items pending analysis", { sessionId });
      return { analyzed: 0 };
    }

    const chunkSize = 5;
    for (let i = 0; i < typedItems.length; i += chunkSize) {
      const chunk = typedItems.slice(i, i + chunkSize);
      const batchResult = await batch.triggerAndWait<
        typeof analyzeScanItemTask
      >(
        chunk.map((item) => ({
          id: "analyze-scan-item",
          payload: { scanItemId: item.id },
        }))
      );

      const runs = normalizeBatchRuns(batchResult);

      runs.forEach((result, idx) => {
        if (!result.ok) {
          logger.error("Child task failed", {
            scanItemId: chunk[idx]?.id,
            error: result.error,
          });
        }
      });
    }

    await client
      .from("scan_sessions")
      .update({ status: "review" })
      .eq("id", sessionId);

    logger.log("Session analysis complete", {
      sessionId,
      analyzed: typedItems.length,
    });

    return { analyzed: typedItems.length };
  },
});
