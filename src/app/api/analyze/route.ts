/**
 * Public single-image analysis for the supervisor demo.
 *
 * Runs the same encoder the production pipeline uses — SAM3 for the visual
 * crop, BioCLIP for the embedding — but classifies synchronously against the
 * reference library instead of queueing a Trigger.dev job. That makes it usable
 * in a live demo, where a 6-second poll loop and a Save step are not.
 *
 * Deliberately unauthenticated so the public demo works, and deliberately
 * write-free: nothing here touches cohorts, subjects, or logs.
 */

import { NextRequest } from "next/server";
import {
  classifyEmbedding,
  shouldAbstain,
  CLASSIFIER_SETTINGS,
} from "@/lib/server/reference-classifier";

export const runtime = "nodejs";
export const maxDuration = 120;

const BIOCLIP_URL =
  process.env.BIOCLIP_API_URL ||
  "https://abdellaalioncan--estrus-pipeline-embed-endpoint.modal.run";
const SAM3_URL =
  process.env.SAM3_API_URL ||
  "https://abdellaalioncan--estrus-pipeline-segment-endpoint.modal.run";

const MAX_BYTES = 10 * 1024 * 1024;

/** The demo calls GPU endpoints that cost real money per invocation, and the
 *  route is public. A coarse per-IP window is enough to stop casual abuse
 *  without standing up shared infrastructure. */
const RATE_LIMIT = { windowMs: 60_000, maxRequests: 12 };
const requestLog = new Map<string, number[]>();

function rateLimited(request: NextRequest): boolean {
  const key =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  const now = Date.now();
  const recent = (requestLog.get(key) ?? []).filter(
    (at) => now - at < RATE_LIMIT.windowMs
  );

  if (recent.length >= RATE_LIMIT.maxRequests) {
    requestLog.set(key, recent);
    return true;
  }

  recent.push(now);
  requestLog.set(key, recent);

  // Opportunistic cleanup so the map cannot grow without bound.
  if (requestLog.size > 500) {
    for (const [existing, times] of requestLog) {
      if (times.every((at) => now - at >= RATE_LIMIT.windowMs)) {
        requestLog.delete(existing);
      }
    }
  }
  return false;
}

async function segment(base64Image: string): Promise<string | null> {
  try {
    const response = await fetch(SAM3_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: base64Image,
        prompt: "mouse body",
        bg_mode: "mask_crop",
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) return null;

    const result = (await response.json()) as { image?: string; format?: string };
    if (!result.image) return null;

    const mime = result.format === "png" ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${result.image}`;
  } catch {
    // Segmentation is a visual aid, not a precondition for classification.
    return null;
  }
}

async function embed(base64Image: string): Promise<number[]> {
  const response = await fetch(BIOCLIP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Image }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    throw new Error(
      `BioCLIP endpoint returned ${response.status} ${response.statusText}`
    );
  }

  const { embedding } = (await response.json()) as { embedding?: number[] };
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("BioCLIP endpoint returned no embedding");
  }
  return embedding;
}

/** Warms both GPU endpoints so the first real analysis of a demo does not pay
 *  a ~35 s cold start in front of an audience. */
export async function GET() {
  const ping = async (url: string) => {
    const started = Date.now();
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: "" }),
        signal: AbortSignal.timeout(90_000),
      });
      return { ok: true, ms: Date.now() - started };
    } catch {
      return { ok: false, ms: Date.now() - started };
    }
  };

  const [encoder, segmenter] = await Promise.all([ping(BIOCLIP_URL), ping(SAM3_URL)]);
  return Response.json({ warm: { encoder, segmenter } });
}

export async function POST(request: NextRequest) {
  if (rateLimited(request)) {
    return Response.json(
      { error: "Too many analyses from this address. Wait a minute and retry." },
      { status: 429 }
    );
  }

  let file: File | null = null;
  try {
    const formData = await request.formData();
    file = formData.get("file") as File | null;
  } catch {
    return Response.json({ error: "Could not read the uploaded form." }, { status: 400 });
  }

  if (!file) {
    return Response.json({ error: "No image was provided." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "That file is not an image." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return Response.json(
      { error: "Images must be larger than 0 bytes and no more than 10 MB." },
      { status: 400 }
    );
  }

  const startedAt = Date.now();

  try {
    const base64Image = Buffer.from(await file.arrayBuffer()).toString("base64");

    // Segmentation runs alongside the embedding: the crop is shown to the
    // reviewer, but the classifier reads the photograph as supplied, which is
    // the domain the reference library was built from.
    const [croppedDataUri, embedding] = await Promise.all([
      segment(base64Image),
      embed(base64Image),
    ]);

    const classification = await classifyEmbedding(embedding);
    const abstained = shouldAbstain(classification);

    return Response.json({
      stage: classification.stage,
      abstained,
      scores: classification.scores,
      neighbours: classification.neighbours.slice(0, 5).map((neighbour) => ({
        label: neighbour.label,
        similarity: Number(neighbour.similarity.toFixed(4)),
      })),
      evidence: {
        method: `BioCLIP embedding + similarity-weighted k-NN (k=${CLASSIFIER_SETTINGS.NEIGHBOUR_COUNT})`,
        reference_source: classification.source,
        reference_count: classification.referenceCount,
        nearest_similarity: Number(classification.nearestSimilarity.toFixed(4)),
        mean_similarity: Number(classification.meanSimilarity.toFixed(4)),
        margin: Number(classification.margin.toFixed(4)),
      },
      review_required: true,
      review_reasons: classification.reviewReasons,
      cropped_image: croppedDataUri,
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analysis failed for an unknown reason.";
    console.error("[api/analyze]", message);
    return Response.json({ error: message }, { status: 502 });
  }
}
