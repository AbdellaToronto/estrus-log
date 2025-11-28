import { batch, logger, task } from "@trigger.dev/sdk/v3";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { getGcs } from "@/lib/gcs";
import type { Tables } from "@/lib/database-types";
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

// Note: getGcs() is called lazily inside task functions to avoid import-time errors
// during Trigger.dev indexing (when env vars aren't available)

async function fetchImageAsBlob(url: string): Promise<Blob> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unable to fetch image ${url}: ${response.status}`);
    }
    return await response.blob();
  } catch (networkError) {
    // Lazily initialize GCS only when needed for fallback
    const gcs = getGcs();
    const prefix = `https://storage.googleapis.com/${gcs.bucket.name}/`;
    if (!url.startsWith(prefix)) {
      throw networkError;
    }
    const objectPath = url.slice(prefix.length).split("?")[0];
    const file = gcs.bucket.file(objectPath);
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    const contentType = metadata?.contentType || "image/jpeg";
    return new Blob([new Uint8Array(buffer)], { type: contentType });
  }
}

interface Neighbor {
  id: string;
  label: string;
  similarity: number;
  image_path: string | null;
  metadata: any;
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

      // 2b. Generate SAM3 cropped image for visual artifact (optional, non-blocking)
      let croppedImageUrl: string | null = null;
      try {
        const sam3Url =
          process.env.SAM3_API_URL ||
          "https://abdellaalioncan--estrus-pipeline-segment-endpoint.modal.run";

        logger.log("Generating SAM3 cropped image...");

        const sam3Response = await fetch(sam3Url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64Image,
            prompt: "mouse body",
            bg_mode: "mask_crop",
          }),
        });

        if (sam3Response.ok) {
          const sam3Result = (await sam3Response.json()) as {
            image: string;
            format: string;
          };

          // Upload cropped image to GCS (lazy init)
          const gcs = getGcs();
          const croppedBuffer = Buffer.from(sam3Result.image, "base64");
          const croppedFileName = `scans/${typedScanItem.session_id}/${scanItemId}_cropped.${sam3Result.format}`;
          const croppedFile = gcs.bucket.file(croppedFileName);

          await croppedFile.save(croppedBuffer, {
            contentType:
              sam3Result.format === "png" ? "image/png" : "image/jpeg",
          });

          croppedImageUrl = `https://storage.googleapis.com/${gcs.bucket.name}/${croppedFileName}`;
          logger.log("SAM3 cropped image saved", { croppedImageUrl });
        } else {
          logger.warn("SAM3 cropping failed, continuing without cropped image");
        }
      } catch (sam3Error) {
        logger.warn("SAM3 cropping error, continuing without cropped image", {
          error: sam3Error,
        });
      }

      // 3. Find Neighbors (k-NN)
      logger.log("Finding similar reference images...");

      // Cast to any because the RPC function is not yet in the generated types
      const { data: neighborsData, error: matchError } = await (
        client as any
      ).rpc("match_reference_images", {
        query_embedding: embedding,
        match_threshold: 0.0, // Return top k regardless of similarity
        match_count: 3,
      });

      if (matchError) {
        logger.error("Similarity search failed", { error: matchError });
        throw new Error("Failed to match reference images");
      }

      const neighbors = neighborsData as Neighbor[] | null;

      if (!neighbors || neighbors.length === 0) {
        logger.warn(
          "No reference images found. Defaulting to Diestrus (Uncertain)."
        );
        // Fallback result
        const result: ClassificationResult = {
          estrus_stage: "Diestrus",
          confidence_scores: {
            Proestrus: 0,
            Estrus: 0,
            Metestrus: 0,
            Diestrus: 1,
          },
          features: {
            swelling: "Unknown",
            color: "Unknown",
            opening: "Unknown",
            moistness: "Unknown",
          },
          reasoning: "No reference images available for comparison.",
        };

        await client
          .from("scan_items")
          .update({ status: "complete", ai_result: result })
          .eq("id", scanItemId);
        return result;
      }

      // 4. Voting Logic
      const votes: Record<string, number> = {
        Proestrus: 0,
        Estrus: 0,
        Metestrus: 0,
        Diestrus: 0,
      };

      neighbors.forEach((n) => {
        if (votes[n.label] !== undefined) {
          votes[n.label]++;
        } else {
          // Handle potential case mismatches or new labels
          votes[n.label] = 1;
        }
      });

      // Determine Winner
      let winner: "Proestrus" | "Estrus" | "Metestrus" | "Diestrus" =
        "Diestrus"; // Default
      let maxVotes = -1;

      // Check for majority (>=2 out of 3) or plurality
      for (const [stage, count] of Object.entries(votes)) {
        if (count > maxVotes) {
          maxVotes = count;
          // Cast string to enum type if valid, else fallback
          if (
            ["Proestrus", "Estrus", "Metestrus", "Diestrus"].includes(stage)
          ) {
            winner = stage as any;
          }
        }
      }

      // Calculate confidence based on vote share
      const totalVotes = neighbors.length;
      const confidence_scores = {
        Proestrus: (votes.Proestrus || 0) / totalVotes,
        Estrus: (votes.Estrus || 0) / totalVotes,
        Metestrus: (votes.Metestrus || 0) / totalVotes,
        Diestrus: (votes.Diestrus || 0) / totalVotes,
      };

      const neighborSummary = neighbors
        .map((n) => `${n.label} (${(n.similarity * 100).toFixed(1)}%)`)
        .join(", ");

      const classification: ClassificationResult = {
        estrus_stage: winner,
        confidence_scores,
        features: {
          swelling: "N/A (BioCLIP Analysis)",
          color: "N/A (BioCLIP Analysis)",
          opening: "N/A (BioCLIP Analysis)",
          moistness: "N/A (BioCLIP Analysis)",
        },
        reasoning: `Classified using BioCLIP (Frozen Feature Extractor) + k-NN (k=3). Neighbors: ${neighborSummary}.`,
      };

      // Validate result
      const validatedResult = ClassificationSchema.parse(classification);

      await client
        .from("scan_items")
        .update({
          status: "complete",
          ai_result: {
            ...validatedResult,
            thoughts: validatedResult.reasoning,
          },
          cropped_image_url: croppedImageUrl,
        })
        .eq("id", scanItemId);

      logger.log("Scan item analyzed", { scanItemId, result: winner });

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
