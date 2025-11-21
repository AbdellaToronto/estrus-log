import { batch, logger, task } from "@trigger.dev/sdk/v3";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { getGcs } from "@/lib/gcs";
import type { Tables } from "@/lib/database-types";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
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
  stage: z.array(
    z.object({
      name: z
        .enum(["Proestrus", "Estrus", "Metestrus", "Diestrus", "Uncertain"])
        .describe("The estrus stage of the mouse"),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .describe("The confidence in the stage"),
    })
  ),
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

      const classification = await generateObject({
        model: google("gemini-3-pro-preview"),
        schema: ClassificationSchema,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `
                System/Role: You are an expert Veterinary Pathologist and Rodent Physiologist specialized in reproductive biology. Your task is to visually classify the stage of the estrous cycle in mice based on an image of the external genitalia. This is for a scientific research database.

                Context & Rules:

                The Problem: Naive classifiers often overfit to Diestrus because it is the longest phase. You must aggressively evaluate against this bias. Do not default to Diestrus unless the visual evidence is undeniable.

                Visual Rubric: Use the following criteria to analyze the image:

                Proestrus: Vaginal opening is visible; tissue is swollen, moist, and pink/red. Striations may be visible.

                Estrus: Vaginal opening is gaping/open; tissue is less swollen than proestrus, distinctively pale/pink, and looks dry or "cornified" (rougher texture).

                Metestrus: Vaginal opening is closing; pale tissue; often white debris (leukocytes/cornified cells) is visible at the opening.

                Diestrus: Vaginal opening is small/closed; tissue is pale and not swollen. Use this classification only if the opening is definitively closed.

                Instructions:

                Analyze the image provided.

                First, describe the Color of the tissue (e.g., Red, Pink, Pale).

                Second, describe the Opening (e.g., Gaping, Wide, Narrow, Closed).

                Third, describe the Texture/Moistness (e.g., Moist/Swollen, Dry/Cornified, Debris present).

                Finally, determine the Stage based strictly on the visual evidence described above.

                Output Format: Please return your response in this format:

                Visual Analysis: [Your observations of color, opening, and texture]

                Predicted Stage: [Proestrus | Estrus | Metestrus | Diestrus]

                Confidence Score: [0-100%]

                Reasoning: [Why it fits this stage and not the others]
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
          ai_result: classification.object,
        })
        .eq("id", scanItemId);

      logger.log("Scan item analyzed", { scanItemId });

      return classification.object;
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
