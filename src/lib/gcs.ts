import { Storage } from "@google-cloud/storage"
import fs from "node:fs"

export type GCSConfig = {
  bucketName: string
  projectId?: string
  credentials?: Record<string, unknown>
  cdnBaseUrl?: string
}

export type GcsObjectLocation = {
  bucketName: string
  objectPath: string
}

const GCS_URI_PREFIX = "gs://"

/** Store object identifiers, not anonymously readable HTTP URLs. */
export function toGcsObjectUri(bucketName: string, objectPath: string) {
  return `${GCS_URI_PREFIX}${bucketName}/${objectPath}`
}

/** Accept new gs:// references and legacy storage.googleapis.com URLs. */
export function getGcsObjectLocation(value: string | null | undefined): GcsObjectLocation | null {
  if (!value) return null
  if (value.startsWith(GCS_URI_PREFIX)) {
    const remainder = value.slice(GCS_URI_PREFIX.length)
    const slashIndex = remainder.indexOf("/")
    if (slashIndex <= 0 || slashIndex === remainder.length - 1) return null
    return {
      bucketName: remainder.slice(0, slashIndex),
      objectPath: remainder.slice(slashIndex + 1),
    }
  }
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.hostname !== "storage.googleapis.com") return null
    const [, bucketName, ...pathParts] = url.pathname.split("/")
    if (!bucketName || pathParts.length === 0) return null
    return { bucketName, objectPath: decodeURIComponent(pathParts.join("/")) }
  } catch {
    return null
  }
}

/** Cache for initialized GCS SDK objects to avoid re-creating clients */
let cached: {
  /** Google Cloud Storage client instance */
  storage: Storage
  /** Default bucket handle based on `bucketName` */
  bucket: ReturnType<Storage["bucket"]>
  /** Resolved configuration derived from explicit config and environment */
  cfg: GCSConfig
} | null = null

/**
 * Lazily initialize and cache a GCS client using either explicit configuration
 * or environment variables. This function is safe to call many times; the
 * underlying SDK client and bucket handle are created once and reused.
 *
 * @param config - Partial overrides for `GCSConfig`.
 * @returns Cached SDK client, bucket handle, and resolved configuration.
 * @throws If `bucketName` is not provided or resolvable from environment.
 */
export function getGcs(config?: Partial<GCSConfig>) {
  if (cached) return cached
  // Resolve credentials from env: inline JSON, base64 JSON, or file path
  let envCreds: Record<string, unknown> | undefined
  if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
    try {
      envCreds = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
    } catch {}
  } else if (process.env.GCP_SERVICE_ACCOUNT_KEY_B64) {
    try {
      envCreds = JSON.parse(
        Buffer.from(process.env.GCP_SERVICE_ACCOUNT_KEY_B64, "base64").toString(
          "utf8"
        )
      )
    } catch {}
  } else if (process.env.GCP_SERVICE_ACCOUNT_KEY_FILE) {
    try {
      envCreds = JSON.parse(
        fs.readFileSync(process.env.GCP_SERVICE_ACCOUNT_KEY_FILE, "utf8")
      )
    } catch {}
  }
  const cfg: GCSConfig = {
    // Trim to prevent issues with newlines in env vars (common copy-paste error)
    bucketName: (config?.bucketName ?? process.env.GCS_BUCKET_NAME ?? "").trim(),
    projectId: config?.projectId ?? process.env.GCP_PROJECT_ID?.trim(),
    credentials: config?.credentials ?? envCreds,
    cdnBaseUrl: config?.cdnBaseUrl ?? process.env.GCS_CDN_BASE_URL?.trim(),
  }
  if (!cfg.bucketName)
    throw new Error("GCS bucket is not configured (GCS_BUCKET_NAME missing)")
  const storage = new Storage({
    projectId: cfg.projectId,
    credentials: cfg.credentials,
  })
  const bucket = storage.bucket(cfg.bucketName)
  cached = { storage, bucket, cfg }
  return cached
}

/**
 * Create a short-lived URL for a canonical gs:// reference. Legacy HTTP URLs
 * are intentionally returned unchanged so an existing public bucket can be
 * migrated without breaking historical records.
 */
export async function getReadableImageUrl(
  value: string | null | undefined,
  expiresInMs = 15 * 60 * 1000
): Promise<string | null> {
  if (!value) return null
  if (!value.startsWith(GCS_URI_PREFIX)) return value.split("?")[0]

  const location = getGcsObjectLocation(value)
  if (!location) throw new Error("Stored image reference is invalid")
  const { storage } = getGcs()
  const file = storage.bucket(location.bucketName).file(location.objectPath)
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + expiresInMs,
  })
  return url
}
