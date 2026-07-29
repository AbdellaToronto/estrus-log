/**
 * Public single-image analysis for the demo.
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
  classifyWhiteCoatBinary,
  shouldAbstain,
  CLASSIFIER_SETTINGS,
} from "@/lib/server/reference-classifier";
import { saveDemoAnalysis, signStoredImages } from "@/lib/server/demo-analysis-store";

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

type Segmentation = { bytes: Buffer; mimeType: string };

async function segment(base64Image: string): Promise<Segmentation | null> {
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

    return {
      bytes: Buffer.from(result.image, "base64"),
      mimeType: result.format === "png" ? "image/png" : "image/jpeg",
    };
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
  const upload = file;

  // Newline-delimited JSON rather than one opaque response. A cold GPU can take
  // forty seconds, and during a live demo the difference between "spinner" and
  // "encoding on a cold GPU" is the difference between broken and working.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));

      try {
        await runAnalysis(upload, startedAt, send);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Analysis failed for an unknown reason.";
        console.error("[api/analyze]", message);
        send({ event: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      // Stops proxies from buffering the stage events into one flush.
      "X-Accel-Buffering": "no",
    },
  });
}

async function runAnalysis(
  file: File,
  startedAt: number,
  send: (payload: unknown) => void
): Promise<void> {
  const originalBytes = Buffer.from(await file.arrayBuffer());
  const base64Image = originalBytes.toString("base64");

  // Segmentation and embedding are issued together, so they are reported as
  // one stage rather than pretending they are sequential.
  send({ event: "stage", stage: "encoding" });

  // Segmentation is shown to the reviewer, but the classifier reads the
  // photograph as supplied, which is the domain the reference library was
  // built from.
  const [segmentation, embedding] = await Promise.all([
    segment(base64Image),
    embed(base64Image),
  ]);

  send({ event: "stage", stage: "matching" });
  const classification = await classifyEmbedding(embedding);
  const abstained = shouldAbstain(classification);

  // The demo's validated scope is the binary task on white-coated mice, so that
  // is reported alongside the unvalidated four-stage guess rather than buried.
  const binary = classifyWhiteCoatBinary(embedding);

  const result = {
    binary: binary
      ? {
          group: binary.group,
          scores: binary.scores,
          in_reference_domain: binary.inReferenceDomain,
          nearest_similarity: Number(binary.nearestSimilarity.toFixed(4)),
          reference_count: binary.referenceCount,
          method: binary.method,
          sealed_test: binary.sealedTest,
        }
      : null,
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
  };

  send({ event: "stage", stage: "storing" });

  // Persist so the analysis can be revisited and shared. A storage failure
  // degrades to an inline result rather than losing the analysis.
  const stored = await saveDemoAnalysis({
    original: { bytes: originalBytes, mimeType: file.type },
    segmented: segmentation,
    result,
  });

  let originalUrl: string | null = null;
  let segmentedUrl: string | null = null;
  if (stored) {
    ({ originalUrl, segmentedUrl } = await signStoredImages(stored));
  }

  send({
    event: "result",
    ...result,
    id: stored?.id ?? null,
    original_url: originalUrl,
    // Fall back to an inline data URI when object storage is unavailable, so
    // the segmentation is still visible.
    cropped_image:
      segmentedUrl ??
      (segmentation
        ? `data:${segmentation.mimeType};base64,${segmentation.bytes.toString("base64")}`
        : null),
    elapsed_ms: Date.now() - startedAt,
  });
}
