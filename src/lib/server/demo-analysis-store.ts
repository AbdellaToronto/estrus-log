/**
 * Object-storage persistence for public demo analyses.
 *
 * The demo deliberately writes no database records, but an analysis that
 * evaporates on refresh cannot be shared or revisited. Storing the photograph,
 * the segmentation, and the result JSON as three objects under one prefix gives
 * shareable permalinks without touching cohorts, subjects, or logs.
 *
 * Images are never handed out as public URLs. Reads go through short-lived
 * signed URLs, the same way the authenticated app serves research images.
 */

import { randomUUID } from "node:crypto";
import { getGcs, getReadableImageUrl, toGcsObjectUri } from "@/lib/gcs";

/** Public uploads stay under their own prefix so a lifecycle rule can expire
 *  them without touching research data, and so a stranger's upload is never
 *  mistaken for a lab record. */
const PREFIX = "demo-analyses";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type StoredDemoAnalysis<T> = {
  id: string;
  result: T;
  originalUri: string;
  segmentedUri: string | null;
  createdAt: string;
};

function extensionFor(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? "bin";
}

function isConfigured(): boolean {
  return Boolean(process.env.GCS_BUCKET_NAME?.trim());
}

/**
 * Persist one demo analysis. Returns null when object storage is not
 * configured, which keeps the route working as an in-memory demo rather than
 * failing the request.
 */
export async function saveDemoAnalysis<T>(options: {
  original: { bytes: Buffer; mimeType: string };
  segmented?: { bytes: Buffer; mimeType: string } | null;
  result: T;
}): Promise<StoredDemoAnalysis<T> | null> {
  if (!isConfigured()) return null;

  try {
    const { bucket, cfg } = getGcs();
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    const originalPath = `${PREFIX}/${id}/original.${extensionFor(options.original.mimeType)}`;
    await bucket.file(originalPath).save(options.original.bytes, {
      contentType: options.original.mimeType,
    });

    let segmentedPath: string | null = null;
    if (options.segmented) {
      segmentedPath = `${PREFIX}/${id}/segmented.${extensionFor(options.segmented.mimeType)}`;
      await bucket.file(segmentedPath).save(options.segmented.bytes, {
        contentType: options.segmented.mimeType,
      });
    }

    const originalUri = toGcsObjectUri(cfg.bucketName, originalPath);
    const segmentedUri = segmentedPath
      ? toGcsObjectUri(cfg.bucketName, segmentedPath)
      : null;

    const record: StoredDemoAnalysis<T> = {
      id,
      result: options.result,
      originalUri,
      segmentedUri,
      createdAt,
    };

    await bucket.file(`${PREFIX}/${id}/result.json`).save(
      JSON.stringify(record),
      { contentType: "application/json" }
    );

    return record;
  } catch (error) {
    // A storage failure must not lose the analysis the reviewer is waiting for.
    console.error("[demo-analysis-store] save failed", error);
    return null;
  }
}

/** Load a stored analysis and mint fresh signed URLs for its images. */
export async function loadDemoAnalysis<T>(id: string): Promise<
  (StoredDemoAnalysis<T> & { originalUrl: string | null; segmentedUrl: string | null }) | null
> {
  if (!isConfigured()) return null;
  // Reject anything that is not a plain UUID before it reaches a file path.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }

  try {
    const { bucket } = getGcs();
    const [contents] = await bucket.file(`${PREFIX}/${id}/result.json`).download();
    const record = JSON.parse(contents.toString("utf8")) as StoredDemoAnalysis<T>;

    const [originalUrl, segmentedUrl] = await Promise.all([
      getReadableImageUrl(record.originalUri),
      record.segmentedUri ? getReadableImageUrl(record.segmentedUri) : Promise.resolve(null),
    ]);

    return { ...record, originalUrl, segmentedUrl };
  } catch {
    return null;
  }
}

/** Signed read URLs for a record that was just written. */
export async function signStoredImages(
  record: Pick<StoredDemoAnalysis<unknown>, "originalUri" | "segmentedUri">
): Promise<{ originalUrl: string | null; segmentedUrl: string | null }> {
  const [originalUrl, segmentedUrl] = await Promise.all([
    getReadableImageUrl(record.originalUri),
    record.segmentedUri ? getReadableImageUrl(record.segmentedUri) : Promise.resolve(null),
  ]);
  return { originalUrl, segmentedUrl };
}
