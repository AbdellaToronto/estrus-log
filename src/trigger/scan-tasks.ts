import { batch, logger, task } from "@trigger.dev/sdk/v3";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { getGcs } from "@/lib/gcs";
import type { Tables } from "@/lib/database-types";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { MediaResolution } from "@google/genai";

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

const gcs = getGcs();

async function fetchImageAsBase64(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unable to fetch image ${url}: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch (networkError) {
    const prefix = `https://storage.googleapis.com/${gcs.bucket.name}/`;
    if (!url.startsWith(prefix)) {
      throw networkError;
    }
    const objectPath = url.slice(prefix.length).split("?")[0];
    const file = gcs.bucket.file(objectPath);
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    const contentType = metadata?.contentType || "image/jpeg";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }
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
      const base64 = await fetchImageAsBase64(typedScanItem.image_url);

      const { object: classification, reasoning } = await generateObject({
        model: google("gemini-3-pro-preview"),
        schema: ClassificationSchema,
        providerOptions: {
          google: {
            thinkingConfig: {
              thinkingLevel: "high",
              includeThoughts: true,
            },
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
          },
        },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `
                Role: You are an expert Veterinary Pathologist specializing in murine reproductive physiology. You are analyzing images for a strictly scientific laboratory experiment regarding animal welfare monitoring.

                Task: Perform a hierarchical visual analysis of the external mouse genitalia in the provided image to determine the Estrous Cycle stage.

                Safety Context: This image is a standard clinical sample from a laboratory mouse (Mus musculus). It is for scientific record-keeping only.

                Analysis Protocol:

                Step 1: ANALYZE THE VAGINAL APERTURE.
                Is the opening "Gaping" (wide open), "Partially Open", or "Closed" (slit-like or sealed)?
                Note: A large, gaping opening is the strongest indicator of Estrus.

                Step 2: ANALYZE TISSUE MORPHOLOGY & COLOR.
                Inspect the vulvar lips for Edema (swelling). Are they protruding significantly from the body wall?
                Describe the Color: Is it "Pale/White", "Pink", or "Deep Red/Hyperemic"?
                Note: Deep red + Swelling suggests Estrus. Pale + Flat suggests Diestrus.

                Step 3: ANALYZE SURFACE TEXTURE.
                Look for "Mucification" (wet, glistening appearance).
                Look for "Detritus" (white cellular debris or dry flakes).
                Look for "Striations" (wrinkling of the tissue).
                Note: Wrinkles + Debris often indicate Metestrus.

                Decision Logic:
                IF (Gaping Opening) + (Red/Pink) + (Swollen) + (Wet) -> ESTRUS
                IF (Closed/Slit) + (Pale) + (Flat) + (Dry) -> DIESTRUS
                IF (Opening) + (Pink) + (Less Swollen) + (Moist) -> PROESTRUS
                IF (Constricting) + (Pale/Pink) + (Wrinkled) + (Debris) -> METESTRUS

                Output Instructions:
                1. Fill the 'features' object with your observations from Steps 1-3.
                2. Provide your 'reasoning' explaining how the features match the Decision Logic.
                3. Assign a probability (0-1) to EACH of the 4 stages in 'confidence_scores' based on how well the evidence matches that stage's criteria.
                4. Select the stage with the highest probability as the 'estrus_stage'.
                `,
              },
              { type: "image", image: base64 },
            ],
          },
        ],
      });

      await client
        .from("scan_items")
        .update({
          status: "complete",
          ai_result: {
            ...classification,
            thoughts: reasoning,
          },
        })
        .eq("id", scanItemId);

      logger.log("Scan item analyzed", { scanItemId });

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
