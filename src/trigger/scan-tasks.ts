import { batch, logger, task } from "@trigger.dev/sdk/v3";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { getGcs, getGcsObjectLocation, toGcsObjectUri } from "@/lib/gcs";
import type { Tables } from "@/lib/database-types";
import {
  ESTRUS_STAGES,
  normalizeClassificationFeatures,
  normalizeConfidenceScores,
  type ClassificationResult,
  type ClassificationStage,
} from "@/lib/classification";
import { z } from "zod";

const supabase = () => getServiceSupabase();

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
  review_required: z.boolean().optional(),
  review_reasons: z.array(z.string()).optional(),
  evidence: z
    .object({
      method: z.string(),
      reference_count: z.number().int().nonnegative().optional(),
      nearest_similarity: z.number().optional(),
      mean_similarity: z.number().optional(),
    })
    .optional(),
  model_version: z.string().optional(),
});

type ScanItemRow = Tables<"scan_items">;

type ScanItemRecord = Omit<ScanItemRow, "ai_result"> & {
  ai_result?: ClassificationResult | null;
};

type BatchChildRun = {
  ok: boolean;
  error?: unknown;
};

const gcs = getGcs();

async function fetchImageAsBlob(url: string): Promise<Blob> {
  const location = getGcsObjectLocation(url);
  if (url.startsWith("gs://") && location) {
    const file = gcs.storage.bucket(location.bucketName).file(location.objectPath);
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    return new Blob([new Uint8Array(buffer)], { type: metadata?.contentType || "image/jpeg" });
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unable to fetch image ${url}: ${response.status}`);
    }
    return await response.blob();
  } catch (networkError) {
    if (!location) {
      throw networkError;
    }
    const file = gcs.storage.bucket(location.bucketName).file(location.objectPath);
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    const contentType = metadata?.contentType || "image/jpeg";
    return new Blob([new Uint8Array(buffer)], { type: contentType });
  }
}

async function generateSuggestedRoi({
  imageBlob,
  sessionId,
  scanItemId,
}: {
  imageBlob: Blob;
  sessionId: string;
  scanItemId: string;
}) {
  const sam3Url =
    process.env.SAM3_API_URL ||
    "https://abdellaalioncan--estrus-pipeline-segment-endpoint.modal.run";
  const arrayBuffer = await imageBlob.arrayBuffer();
  const base64Image = Buffer.from(arrayBuffer).toString("base64");

  const response = await fetch(sam3Url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: base64Image,
      prompt: "mouse external genital region",
      bg_mode: "mask_crop",
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`SAM3 crop proposal failed: ${response.status} ${detail}`);
  }

  const result = (await response.json()) as { image: string; format: string };
  const format = result.format === "png" ? "png" : "jpg";
  const contentType = format === "png" ? "image/png" : "image/jpeg";
  const objectPath = `scans/${sessionId}/${scanItemId}_suggested_roi.${format}`;
  const file = gcs.bucket.file(objectPath);
  await file.save(Buffer.from(result.image, "base64"), { contentType });

  return toGcsObjectUri(gcs.bucket.name, objectPath);
}

interface Neighbor {
  id: string;
  label: string;
  similarity: number;
  image_path: string | null;
  metadata: Record<string, unknown>;
}

type ReferenceMatchRpcClient = {
  rpc: (
    functionName: "match_reference_images",
    args: {
      query_embedding: number[];
      match_threshold: number;
      match_count: number;
    }
  ) => Promise<{ data: Neighbor[] | null; error: unknown }>;
};

const MIN_REFERENCE_SIMILARITY = 0.18;
const LOW_SIMILARITY_REVIEW_THRESHOLD = 0.4;

function toStage(label: string): ClassificationStage | undefined {
  return ESTRUS_STAGES.find(
    (stage) => stage.toLowerCase() === label.trim().toLowerCase()
  );
}

function buildWeightedClassification(neighbors: Neighbor[]): ClassificationResult {
  const scores: Record<ClassificationStage, number> = {
    Proestrus: 0,
    Estrus: 0,
    Metestrus: 0,
    Diestrus: 0,
  };
  const validNeighbors = neighbors
    .map((neighbor) => ({ ...neighbor, stage: toStage(neighbor.label) }))
    .filter(
      (neighbor): neighbor is Neighbor & { stage: ClassificationStage } =>
        Boolean(neighbor.stage) && Number.isFinite(neighbor.similarity)
    );

  if (validNeighbors.length === 0) {
    throw new Error("Reference images did not contain a recognized estrus-stage label");
  }

  // A closer neighbor contributes more evidence than a distant one. This is
  // deliberately not called a calibrated probability: it is only relative
  // support among the available reference images.
  validNeighbors.forEach((neighbor) => {
    const weight = Math.max(0, neighbor.similarity - MIN_REFERENCE_SIMILARITY);
    scores[neighbor.stage] += weight;
  });

  const confidence_scores = normalizeConfidenceScores(scores);
  const rankedStages = [...ESTRUS_STAGES].sort(
    (left, right) => confidence_scores[right] - confidence_scores[left]
  );
  const winner = rankedStages[0];
  const runnerUp = rankedStages[1];
  const similarities = validNeighbors.map((neighbor) => neighbor.similarity);
  const nearestSimilarity = Math.max(...similarities);
  const meanSimilarity =
    similarities.reduce((sum, similarity) => sum + similarity, 0) /
    similarities.length;
  const reviewReasons: string[] = [];

  if (validNeighbors.length < 3) {
    reviewReasons.push("Fewer than three labeled reference images were available.");
  }
  if (nearestSimilarity < LOW_SIMILARITY_REVIEW_THRESHOLD) {
    reviewReasons.push("The closest reference image was only weakly similar.");
  }
  if (meanSimilarity < LOW_SIMILARITY_REVIEW_THRESHOLD) {
    reviewReasons.push("The reference set was weakly similar overall.");
  }
  if (confidence_scores[winner] - confidence_scores[runnerUp] < 0.2) {
    reviewReasons.push("The leading stage was not clearly separated from the next stage.");
  }
  if (process.env.CLASSIFIER_AUTO_ACCEPT !== "true") {
    reviewReasons.push(
      "Human confirmation is required until this classifier is validated for this colony and imaging protocol."
    );
  }

  const neighborSummary = validNeighbors
    .map((neighbor) => `${neighbor.stage} (${(neighbor.similarity * 100).toFixed(1)}%)`)
    .join(", ");

  return ClassificationSchema.parse({
    estrus_stage: winner,
    confidence_scores,
    features: normalizeClassificationFeatures(undefined),
    reasoning:
      "BioCLIP embedding matched against labeled reference images using similarity-weighted k-NN. " +
      `Reference support: ${neighborSummary}.`,
    review_required: reviewReasons.length > 0,
    review_reasons: reviewReasons,
    evidence: {
      method: "BioCLIP similarity-weighted k-NN",
      reference_count: validNeighbors.length,
      nearest_similarity: nearestSimilarity,
      mean_similarity: meanSimilarity,
    },
    model_version: "bioclip-weighted-knn-v2",
  }) as ClassificationResult;
}

export const proposeScanItemRoiTask = task({
  id: "propose-scan-item-roi",
  maxDuration: 600,
  run: async ({ scanItemId }: { scanItemId: string }) => {
    const client = supabase();
    const { data: scanItem, error } = await client
      .from("scan_items")
      .select("id, image_url, session_id")
      .eq("id", scanItemId)
      .single();

    if (error || !scanItem) throw new Error(`Scan item ${scanItemId} not found`);
    await client.from("scan_items").update({ status: "proposing_roi" }).eq("id", scanItemId);

    try {
      const original = await fetchImageAsBlob(scanItem.image_url);
      const croppedImageUrl = await generateSuggestedRoi({
        imageBlob: original,
        sessionId: scanItem.session_id,
        scanItemId,
      });

      await client
        .from("scan_items")
        .update({
          status: "roi_review",
          cropped_image_url: croppedImageUrl,
          ai_result: {
            crop_review: {
              method: "SAM3 text-prompt proposal",
              prompt: "mouse external genital region",
              confirmed: false,
            },
          },
        })
        .eq("id", scanItemId);

      return { croppedImageUrl };
    } catch (proposalError) {
      await client.from("scan_items").update({ status: "crop_error" }).eq("id", scanItemId);
      logger.error("Failed to propose ROI", { scanItemId, error: proposalError });
      throw proposalError;
    }
  },
});

export const analyzeScanItemTask = task({
  id: "analyze-scan-item",
  maxDuration: 600,
  run: async ({ scanItemId }: { scanItemId: string }) => {
    const client = supabase();

    const { data: scanItem, error } = await client
      .from("scan_items")
      .select("id, image_url, cropped_image_url, session_id, status, ai_result")
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
      if (typedScanItem.status !== "roi_confirmed" || !typedScanItem.cropped_image_url) {
        throw new Error("A scientist-confirmed ROI is required before batch analysis");
      }

      // 1. Fetch the prepared ROI, never the unconfirmed original frame.
      const imageBlob = await fetchImageAsBlob(typedScanItem.cropped_image_url);

      // 2. Generate Embedding via Modal Cloud BioCLIP Service
      const bioclipUrl =
        process.env.BIOCLIP_API_URL ||
        "https://abdellaalioncan--estrus-pipeline-embed-endpoint.modal.run";

      // Convert blob to base64 for the Modal endpoint
      const arrayBuffer = await imageBlob.arrayBuffer();
      const base64Image = Buffer.from(arrayBuffer).toString("base64");

      logger.log("Sending image to BioCLIP cloud service...", {
        url: bioclipUrl,
      });

      const embedResponse = await fetch(bioclipUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: base64Image }),
      });

      if (!embedResponse.ok) {
        const errorText = await embedResponse.text();
        throw new Error(
          `BioCLIP Service Error: ${embedResponse.status} ${embedResponse.statusText} - ${errorText}`
        );
      }

      const { embedding } = (await embedResponse.json()) as {
        embedding: number[];
      };

      // 3. Find Neighbors (k-NN)
      logger.log("Finding similar reference images...");

      // The local generated database types predate this SQL RPC.
      const referenceMatchClient = client as unknown as ReferenceMatchRpcClient;
      const { data: neighborsData, error: matchError } = await referenceMatchClient.rpc("match_reference_images", {
        query_embedding: embedding,
        // Do not convert unrelated reference images into a confident stage.
        match_threshold: MIN_REFERENCE_SIMILARITY,
        match_count: 3,
      });

      if (matchError) {
        logger.error("Similarity search failed", { error: matchError });
        throw new Error("Failed to match reference images");
      }

      const neighbors = neighborsData as Neighbor[] | null;

      if (!neighbors || neighbors.length === 0) {
        throw new Error(
          "No sufficiently similar labeled reference images were found. Add reviewed references before using this classifier."
        );
      }

      // 4. Similarity-weighted evidence aggregation. Equal votes turn three
      // barely-related images into an apparently certain result, which is not
      // appropriate for a research log.
      const validatedResult = buildWeightedClassification(neighbors);

      await client
        .from("scan_items")
        .update({
          status: "complete",
          ai_result: {
            ...validatedResult,
            thoughts: validatedResult.reasoning,
            crop_review: {
              method: "SAM3 text-prompt proposal",
              confirmed: true,
              analyzed_as_model_input: true,
            },
          },
        })
        .eq("id", scanItemId);

      logger.log("Scan item analyzed", {
        scanItemId,
        result: validatedResult.estrus_stage,
        reviewRequired: validatedResult.review_required,
      });

      return validatedResult;
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

export const proposeScanSessionRoisTask = task({
  id: "propose-scan-session-rois",
  maxDuration: 3600,
  run: async ({ sessionId }: { sessionId: string }) => {
    const client = supabase();
    const { data: session, error } = await client
      .from("scan_sessions")
      .select("id, modality")
      .eq("id", sessionId)
      .single();

    if (error || !session) throw new Error("Scan session not found");
    if (session.modality !== "external_photo") {
      throw new Error("ROI proposals are available only for external genital-photo sessions");
    }

    const { data: items, error: itemsError } = await client
      .from("scan_items")
      .select("id, status")
      .eq("session_id", sessionId)
      .in("status", ["uploaded", "crop_error"]);
    if (itemsError) throw itemsError;

    const pending = items ?? [];
    const chunkSize = 5;
    for (let index = 0; index < pending.length; index += chunkSize) {
      const chunk = pending.slice(index, index + chunkSize);
      const result = await batch.triggerAndWait<typeof proposeScanItemRoiTask>(
        chunk.map((item) => ({
          id: "propose-scan-item-roi",
          payload: { scanItemId: item.id },
        }))
      );
      normalizeBatchRuns(result).forEach((run, runIndex) => {
        if (!run.ok) {
          logger.error("ROI proposal child task failed", {
            scanItemId: chunk[runIndex]?.id,
            error: run.error,
          });
        }
      });
    }

    await client.from("scan_sessions").update({ status: "crop_review" }).eq("id", sessionId);
    return { proposed: pending.length };
  },
});

export const analyzeScanSessionTask = task({
  id: "analyze-scan-session",
  maxDuration: 3600,
  run: async ({ sessionId }: { sessionId: string }) => {
    const client = supabase();

    const { data: session, error } = await client
      .from("scan_sessions")
      .select("id, status, modality")
      .eq("id", sessionId)
      .single();

    if (error || !session) {
      throw new Error("Scan session not found");
    }
    if (session.modality !== "external_photo") {
      throw new Error("Batch analysis only supports external genital-photo sessions");
    }

    const { data: items, error: itemsError } = await client
      .from("scan_items")
      .select("id, status")
      .eq("session_id", sessionId)
      .in("status", ["roi_confirmed"]);

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
