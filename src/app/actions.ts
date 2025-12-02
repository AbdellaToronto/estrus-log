"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createAuthClient, createAdminClient } from "@/lib/supabase";
import { getGcs } from "@/lib/gcs";
import { revalidatePath } from "next/cache";
import { tasks } from "@trigger.dev/sdk/v3";
import type { analyzeScanSessionTask } from "@/trigger/scan-tasks";
import type { Database, Json } from "@/lib/database-types";

// --- Types/Defaults ---
const DEFAULT_ESTRUS_CONFIG = {
  subject_config: { fields: ["dob", "genotype", "cage_number"] },
  log_config: {
    stages: ["Proestrus", "Estrus", "Metestrus", "Diestrus"],
    features: ["swelling_score", "color_score"],
  },
};

type LogRow = Database["public"]["Tables"]["estrus_logs"]["Row"];
type LogWithSubject = LogRow & {
  mice?: { name?: string; cohort_id?: string } | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const extractConfidenceValue = (value: LogRow["confidence"]): number => {
  if (typeof value === "number") return value;
  if (isRecord(value) && "score" in value) {
    const rawScore = value["score"];
    if (typeof rawScore === "number") {
      return rawScore;
    }
  }
  return 0;
};

const coerceFeatureRecord = (value: unknown): Record<string, string> => {
  if (!isRecord(value)) return {};
  return Object.entries(value).reduce<Record<string, string>>(
    (acc, [key, val]) => {
      if (typeof val === "string") {
        acc[key] = val;
      }
      return acc;
    },
    {}
  );
};

// --- Utils ---

// Validates if a string is a valid UUID. Note: Supabase/Postgres UUIDs are strict.
// Clerk IDs like "user_..." are NOT valid UUIDs.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string) {
  return UUID_REGEX.test(id);
}

// --- Cohorts ---

export async function getCohorts() {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("cohorts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createCohort(formData: FormData) {
  const { userId, orgId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  // -- SAFETY CHECK: Ensure user exists in Supabase before creating foreign key ref --
  const user = await currentUser();
  if (user) {
    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    await supabase.from("users").upsert({
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || "unknown",
      full_name: fullName,
      avatar_url: user.imageUrl,
    });
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const type = (formData.get("type") as string) || "estrus_tracking";

  let subjectConfig = {};
  let logConfig = {};

  if (type === "estrus_tracking") {
    subjectConfig = DEFAULT_ESTRUS_CONFIG.subject_config;
    logConfig = DEFAULT_ESTRUS_CONFIG.log_config;
  } else {
    try {
      const customSubjectConfig = formData.get("subject_config");
      if (customSubjectConfig)
        subjectConfig = JSON.parse(customSubjectConfig as string);

      const customLogConfig = formData.get("log_config");
      if (customLogConfig) logConfig = JSON.parse(customLogConfig as string);
    } catch (e) {
      console.error("Failed to parse custom config", e);
    }
  }

  const { error } = await supabase.from("cohorts").insert({
    user_id: userId,
    org_id: orgId || null,
    name,
    description,
    color: "bg-blue-500",
    type,
    subject_config: subjectConfig,
    log_config: logConfig,
  });

  if (error) throw error;
  revalidatePath("/dashboard");
}

export async function getCohort(id: string) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (!isValidUUID(id)) {
    return null;
  }

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("cohorts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

// --- Subjects (Formerly Mice) ---

export async function getSubjects() {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("mice")
    .select("*, cohorts(name, color, type, subject_config)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getCohortSubjects(cohortId: string) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("mice")
    .select("*, cohorts(name, color, type, subject_config)")
    .eq("cohort_id", cohortId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getSubject(id: string) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (!isValidUUID(id)) {
    return null;
  }

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("mice")
    .select("*, cohorts(name, color, type, subject_config, log_config)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createSubject(formData: FormData) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const name = formData.get("name") as string;
  const cohortId = formData.get("cohortId") as string;

  const metadata: Record<string, string> = {};
  ["dob", "genotype", "cage_number"].forEach((field) => {
    const value = formData.get(field);
    if (typeof value === "string" && value.length > 0) {
      metadata[field] = value;
    }
  });

  // IMPORTANT: Inherit org_id from the cohort to maintain data consistency
  // This ensures subjects always belong to the same org as their cohort
  let subjectOrgId: string | null = null;
  if (cohortId) {
    const { data: cohort } = await supabase
      .from("cohorts")
      .select("org_id")
      .eq("id", cohortId)
      .single();

    subjectOrgId = cohort?.org_id || null;
  }

  const { error } = await supabase.from("mice").insert({
    user_id: userId,
    org_id: subjectOrgId,
    name,
    cohort_id: cohortId || null,
    metadata,
  });

  if (error) throw error;
  revalidatePath("/dashboard");
  if (cohortId) revalidatePath(`/cohorts/${cohortId}`);
}

// --- Logs ---

export async function getSubjectLogs(subjectId: string) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("estrus_logs")
    .select("*")
    .eq("mouse_id", subjectId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Bucket is public - just strip any query params from old signed URLs
  const updatedLogs = data.map((log) => {
    if (log.image_url) {
      return { ...log, image_url: log.image_url.split("?")[0] };
    }
    return log;
  });

  return updatedLogs;
}

export async function createLog(data: {
  subjectId: string;
  stage: string;
  confidence: number | { score: number };
  features?: Record<string, unknown>;
  imageUrl: string;
  notes: string;
  flexibleData?: Record<string, unknown>;
}) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  // Get the cohort_id from the subject - required for RLS
  const { data: subject } = await supabase
    .from("mice")
    .select("cohort_id")
    .eq("id", data.subjectId)
    .single();

  const { error } = await supabase.from("estrus_logs").insert({
    mouse_id: data.subjectId,
    cohort_id: subject?.cohort_id, // Required for RLS policy
    stage: data.stage,
    confidence: data.confidence,
    features: data.features ?? {},
    data: data.flexibleData ?? {},
    image_url: data.imageUrl,
    notes: data.notes,
  });

  if (error) throw error;
  revalidatePath(`/subjects/${data.subjectId}`);
}

// --- Scan Sessions (Batch) ---

export async function getScanSession(cohortId: string) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  // Find the most recent 'pending' session for this user/cohort
  const { data, error } = await supabase
    .from("scan_sessions")
    .select("*")
    .eq("cohort_id", cohortId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getScanItems(sessionId: string) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("scan_items")
    .select("*")
    .eq("session_id", sessionId);

  if (error) throw error;

  // --- FIX: Refresh Signed URLs on read ---
  // GCS Signed URLs expire. If we are resuming a session, we MUST refresh them.
  // We'll do this transparently here.

  const { bucket } = getGcs();

  // Filter for items that have a GCS path (image_url starting with http usually means it's already signed,
  // but we need to know the storage path to re-sign.
  // However, our previous logic stored the FULL signed URL in `image_url`.
  // This is problematic for resuming because we can't easily reverse-engineer the object path from a signed URL
  // if the structure is complex or if we don't store the raw path.
  //
  // BETTER APPROACH: We should have stored the relative path.
  // But we stored the public URL.
  //
  // Workaround: Extract the path from the stored URL or assume a structure.
  // Our getUploadUrl structure: `orgs/${orgId}/...` or `users/${userId}/...`
  // The public URL is `https://storage.googleapis.com/${bucket.name}/${path}`

  const bucketName = bucket.name;
  const prefix = `https://storage.googleapis.com/${bucketName}/`;

  // Bucket is public - just strip any existing query params (old signed URLs) and return clean public URLs
  const updatedItems = data.map((item) => {
    if (item.image_url && item.image_url.includes(prefix)) {
      const cleanUrl = item.image_url.split("?")[0];
      return { ...item, image_url: cleanUrl };
    }
    return item;
  });

  return updatedItems;
}

export async function startScanSessionAnalysis(sessionId: string) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const { data: session, error } = await supabase
    .from("scan_sessions")
    .select("id, cohort_id")
    .eq("id", sessionId)
    .single();

  if (error) throw error;
  if (!session) throw new Error("Session not found");

  await tasks.trigger<typeof analyzeScanSessionTask>("analyze-scan-session", {
    sessionId,
  });

  return { sessionId };
}

export async function createScanSession(cohortId: string, name?: string) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("scan_sessions")
    .insert({
      cohort_id: cohortId,
      user_id: userId,
      name: name || `Batch Scan ${new Date().toLocaleDateString()}`,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createScanItem(sessionId: string, imageUrl: string) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("scan_items")
    .insert({
      session_id: sessionId,
      image_url: imageUrl,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createScanItemsBulk(
  sessionId: string,
  items: { imageUrl: string }[]
) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const rows = items.map((item) => ({
    session_id: sessionId,
    image_url: item.imageUrl,
    status: "pending",
  }));

  const { data, error } = await supabase
    .from("scan_items")
    .insert(rows)
    .select();

  if (error) throw error;
  return data;
}

export async function updateScanItem(
  itemId: string,
  updates: {
    status: string;
    result?: Record<string, unknown>;
    mouseId?: string;
    imageUrl?: string;
  }
) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const payload: {
    status: string;
    ai_result?: Record<string, unknown>;
    mouse_id?: string;
    image_url?: string;
  } = {
    status: updates.status,
  };

  if (updates.result) {
    payload.ai_result = updates.result;
  }
  if (updates.mouseId) {
    payload.mouse_id = updates.mouseId;
  }
  if (updates.imageUrl) {
    payload.image_url = updates.imageUrl;
  }

  const { error } = await supabase
    .from("scan_items")
    .update(payload)
    .eq("id", itemId);

  if (error) throw error;
}

// --- Scan History & Receipts ---

export type ScanSessionSummary = {
  id: string;
  name: string | null;
  status: string;
  created_at: string;
  itemCount: number;
  completedCount: number;
  stageBreakdown: Record<string, number>;
};

export type ScanSessionDetail = ScanSessionSummary & {
  cohort: {
    id: string;
    name: string;
  } | null;
  items: {
    id: string;
    image_url: string | null;
    status: string;
    ai_result: Record<string, unknown> | null;
    mouse_id: string | null;
    mouse_name: string | null;
    created_at: string;
  }[];
  subjectsLogged: { id: string; name: string; logCount: number }[];
};

/**
 * Get all scan sessions for a cohort (for history view)
 */
export async function getCohortScanSessions(
  cohortId: string
): Promise<ScanSessionSummary[]> {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  // Get all sessions for this cohort
  const { data: sessions, error } = await supabase
    .from("scan_sessions")
    .select("id, name, status, created_at")
    .eq("cohort_id", cohortId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!sessions) return [];

  // Get item counts and stage breakdowns for each session
  const sessionIds = sessions.map((s) => s.id);

  const { data: items } = await supabase
    .from("scan_items")
    .select("session_id, status, ai_result")
    .in("session_id", sessionIds);

  // Aggregate by session
  const sessionStats = new Map<
    string,
    { itemCount: number; completedCount: number; stageBreakdown: Record<string, number> }
  >();

  items?.forEach((item) => {
    const stats = sessionStats.get(item.session_id) || {
      itemCount: 0,
      completedCount: 0,
      stageBreakdown: {},
    };
    stats.itemCount++;
    if (item.status === "complete" || item.status === "completed") {
      stats.completedCount++;
    }
    // Extract stage from ai_result
    const result = item.ai_result as { stage?: string } | null;
    if (result?.stage) {
      stats.stageBreakdown[result.stage] =
        (stats.stageBreakdown[result.stage] || 0) + 1;
    }
    sessionStats.set(item.session_id, stats);
  });

  return sessions.map((session) => ({
    ...session,
    ...(sessionStats.get(session.id) || {
      itemCount: 0,
      completedCount: 0,
      stageBreakdown: {},
    }),
  }));
}

/**
 * Get detailed scan session info (for receipt view)
 */
export async function getScanSessionDetail(
  sessionId: string
): Promise<ScanSessionDetail | null> {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  // Get session with cohort info
  const { data: session, error: sessionError } = await supabase
    .from("scan_sessions")
    .select(
      `
      id, name, status, created_at,
      cohorts (id, name)
    `
    )
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) return null;

  // Get all items with mouse info
  const { data: items, error: itemsError } = await supabase
    .from("scan_items")
    .select(
      `
      id, image_url, status, ai_result, mouse_id, created_at,
      mice (id, name)
    `
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (itemsError) throw itemsError;

  // Clean up image URLs (strip query params from signed URLs)
  const { bucket } = getGcs();
  const bucketName = bucket.name;
  const prefix = `https://storage.googleapis.com/${bucketName}/`;

  const cleanedItems =
    items?.map((item) => {
      let cleanUrl = item.image_url;
      if (cleanUrl && cleanUrl.includes(prefix)) {
        cleanUrl = cleanUrl.split("?")[0];
      }
      const miceData = item.mice as { id: string; name: string } | { id: string; name: string }[] | null;
      const mice = Array.isArray(miceData) ? miceData[0] : miceData;
      return {
        id: item.id,
        image_url: cleanUrl,
        status: item.status,
        ai_result: item.ai_result as Record<string, unknown> | null,
        mouse_id: item.mouse_id,
        mouse_name: mice?.name || null,
        created_at: item.created_at,
      };
    }) || [];

  // Calculate stage breakdown
  const stageBreakdown: Record<string, number> = {};
  cleanedItems.forEach((item) => {
    const result = item.ai_result as { stage?: string } | null;
    if (result?.stage) {
      stageBreakdown[result.stage] = (stageBreakdown[result.stage] || 0) + 1;
    }
  });

  // Calculate subjects logged
  const subjectCounts = new Map<string, { id: string; name: string; count: number }>();
  cleanedItems.forEach((item) => {
    if (item.mouse_id && item.mouse_name) {
      const existing = subjectCounts.get(item.mouse_id) || {
        id: item.mouse_id,
        name: item.mouse_name,
        count: 0,
      };
      existing.count++;
      subjectCounts.set(item.mouse_id, existing);
    }
  });

  const cohortDataRaw = session.cohorts as { id: string; name: string } | { id: string; name: string }[] | null;
  const cohortData = Array.isArray(cohortDataRaw) ? cohortDataRaw[0] : cohortDataRaw;

  return {
    id: session.id,
    name: session.name,
    status: session.status,
    created_at: session.created_at,
    cohort: cohortData,
    itemCount: cleanedItems.length,
    completedCount: cleanedItems.filter(
      (i) => i.status === "complete" || i.status === "completed"
    ).length,
    stageBreakdown,
    items: cleanedItems,
    subjectsLogged: Array.from(subjectCounts.values()).map((s) => ({
      id: s.id,
      name: s.name,
      logCount: s.count,
    })),
  };
}

// --- GCS Upload & Batch ---

export async function getUploadUrl(
  filename: string,
  contentType: string,
  cohortId?: string
) {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const { bucket } = getGcs();

  // Organize by Org/User -> Cohort -> Logs
  const rootPath = orgId ? `orgs/${orgId}` : `users/${userId}`;
  const subPath = cohortId ? `${cohortId}/logs` : "uploads";

  const path = `${rootPath}/${subPath}/${Date.now()}-${filename}`;
  const file = bucket.file(path);

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    contentType,
  });

  return {
    url,
    publicUrl: `https://storage.googleapis.com/${bucket.name}/${path}`,
  };
}

export async function getUploadUrls(
  files: { filename: string; contentType: string }[],
  cohortId: string
) {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const { bucket } = getGcs();
  const rootPath = orgId ? `orgs/${orgId}` : `users/${userId}`;
  const subPath = cohortId ? `${cohortId}/logs` : "uploads";

  const results = await Promise.all(
    files.map(async (f) => {
      const path = `${rootPath}/${subPath}/${Date.now()}-${f.filename}`;
      const file = bucket.file(path);
      const [url] = await file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType: f.contentType,
      });
      return {
        filename: f.filename,
        url,
        publicUrl: `https://storage.googleapis.com/${bucket.name}/${path}`,
      };
    })
  );

  return results;
}

type BatchLogItem = {
  filename: string;
  imageUrl: string;
  stage: string;
  confidence: number;
  features?: Record<string, unknown>;
  reasoning: string;
  scanItemId?: string;
  subjectId?: string; // Explicit existing subject
  newSubjectName?: string; // Or create a new one
  flexibleData?: Record<string, unknown>; // NEW: Support flexible data like granular confidences
};

export type CohortInsights = {
  totalLogs: number;
  stageDistribution: { stage: string; value: number }[];
  confidenceByStage: { stage: string; value: number }[];
  timeline: { date: string; value: number }[];
  featureBreakdown: {
    swelling: { label: string; value: number }[];
    color: { label: string; value: number }[];
    opening: { label: string; value: number }[];
    moistness: { label: string; value: number }[];
  };
  recentLogs: {
    id: string;
    stage: string;
    confidence: number;
    created_at: string;
    subjectName: string;
    imageUrl: string | null;
  }[];
};

const STAGES = ["Proestrus", "Estrus", "Metestrus", "Diestrus", "Uncertain"];

export async function batchSaveLogs(
  cohortId: string,
  items: BatchLogItem[],
  sessionId?: string
) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  // Get the cohort's org_id to ensure new subjects inherit it
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("org_id")
    .eq("id", cohortId)
    .single();

  const cohortOrgId = cohort?.org_id || null;

  // 1. Get existing subjects to match filenames
  const { data: existingSubjects } = await supabase
    .from("mice")
    .select("id, name")
    .eq("cohort_id", cohortId);

  const subjectMap = new Map(
    existingSubjects?.map((s) => [s.name.toLowerCase(), s.id])
  );

  const logsToInsert = [];
  const scanItemsToUpdate = [];

  for (const item of items) {
    let subjectId = item.subjectId;

    // If no explicit ID, try to find by new name or fallback to filename matching
    if (!subjectId) {
      // 1. Try explicit new name (e.g. user typed "227A" in UI)
      if (item.newSubjectName) {
        const lowerName = item.newSubjectName.toLowerCase();
        subjectId = subjectMap.get(lowerName); // Check if exists first

        if (!subjectId) {
          // Create it - IMPORTANT: inherit org_id from cohort, not from session
          const { data: createdSubject } = await supabase
            .from("mice")
            .insert({
              user_id: userId,
              org_id: cohortOrgId, // Inherit from cohort
              cohort_id: cohortId,
              name: item.newSubjectName,
              status: "Active",
            })
            .select("id")
            .single();

          if (createdSubject) {
            subjectId = createdSubject.id;
            subjectMap.set(lowerName, subjectId);
          }
        }
      }
      // 2. Fallback to Filename heuristic (only if desired/legacy)
      else {
        const cleanFilename = item.filename.replace(/^\d+-/, "");
        const potentialName = cleanFilename.split(/[_\s.-]/)[0];
        if (potentialName) {
          subjectId = subjectMap.get(potentialName.toLowerCase());
        }
      }
    }

    if (subjectId) {
      logsToInsert.push({
        mouse_id: subjectId,
        cohort_id: cohortId, // Required for RLS policy
        stage: item.stage,
        confidence:
          typeof item.confidence === "number" ? item.confidence : 0.95,
        features: item.features ?? {},
        image_url: item.imageUrl,
        notes: item.reasoning,
        data: item.flexibleData ?? item.features ?? {},
      });

      if (item.scanItemId) {
        scanItemsToUpdate.push({
          id: item.scanItemId,
          mouse_id: subjectId,
          status: "completed",
        });
      }
    }
  }

  if (logsToInsert.length > 0) {
    const { error } = await supabase.from("estrus_logs").insert(logsToInsert);
    if (error) throw error;
  }

  // Update Scan Items links if provided
  if (scanItemsToUpdate.length > 0) {
    // In a real app, we'd bulk update, but loop for now or use a stored procedure
    // For simplicity, we'll just fire promises
    await Promise.all(
      scanItemsToUpdate.map((u) =>
        supabase
          .from("scan_items")
          .update({ mouse_id: u.mouse_id, status: "completed" })
          .eq("id", u.id)
      )
    );
  }

  if (sessionId) {
    await supabase
      .from("scan_sessions")
      .update({ status: "completed" })
      .eq("id", sessionId);
  }

  revalidatePath(`/cohorts/${cohortId}`);
  return { savedCount: logsToInsert.length };
}

export async function getCohortLogs(cohortId: string) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("estrus_logs")
    .select("*, mice!inner(name, cohort_id)")
    .eq("mice.cohort_id", cohortId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Bucket is public - strip query params from old signed URLs and add subjectName
  return data.map((log) => ({
    ...log,
    image_url: log.image_url?.split("?")[0] || log.image_url,
    subjectName: log.mice?.name || "Unknown",
  }));
}

export async function getCohortInsights(
  cohortId: string
): Promise<CohortInsights> {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const { data: logs, error } = await supabase
    .from("estrus_logs")
    .select(
      "id, stage, confidence, created_at, image_url, features, mice!inner(name, cohort_id)"
    )
    .eq("mice.cohort_id", cohortId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const typedLogs = (logs ?? []) as unknown as LogWithSubject[];

  if (typedLogs.length === 0) {
    return {
      totalLogs: 0,
      stageDistribution: [],
      confidenceByStage: [],
      timeline: [],
      featureBreakdown: { swelling: [], color: [], opening: [], moistness: [] },
      recentLogs: [],
    };
  }

  const stageCounts = new Map<string, number>();
  const confidenceMap = new Map<string, { sum: number; count: number }>();
  const timelineMap = new Map<string, number>();
  const featureCounts = {
    swelling: new Map<string, number>(),
    color: new Map<string, number>(),
    opening: new Map<string, number>(),
    moistness: new Map<string, number>(),
  };

  const recentLogs = typedLogs.slice(0, 6).map((log) => ({
    id: log.id,
    stage: log.stage || "Uncertain",
    confidence: extractConfidenceValue(log.confidence),
    created_at: log.created_at,
    subjectName: log.mice?.name || "Unknown subject",
    imageUrl: log.image_url,
  }));

  typedLogs.forEach((log) => {
    const stage = STAGES.includes(log.stage) ? log.stage : "Uncertain";
    const confidenceValue = extractConfidenceValue(log.confidence);

    stageCounts.set(stage, (stageCounts.get(stage) || 0) + 1);

    const confEntry = confidenceMap.get(stage) || { sum: 0, count: 0 };
    confEntry.sum += confidenceValue;
    confEntry.count += 1;
    confidenceMap.set(stage, confEntry);

    const dayKey = new Date(log.created_at).toISOString().split("T")[0];
    timelineMap.set(dayKey, (timelineMap.get(dayKey) || 0) + 1);

    const featureSource = coerceFeatureRecord(log.features ?? log.data ?? {});
    (["swelling", "color", "opening", "moistness"] as const).forEach((key) => {
      const value = featureSource[key];
      if (!value) return;
      const map = featureCounts[key];
      map.set(value, (map.get(value) || 0) + 1);
    });
  });

  const totalLogs = typedLogs.length;

  const stageDistribution = Array.from(stageCounts.entries())
    .map(([stage, value]) => ({ stage, value }))
    .sort((a, b) => b.value - a.value);

  const confidenceByStage = Array.from(confidenceMap.entries())
    .map(([stage, { sum, count }]) => ({
      stage,
      value: count ? sum / count : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const timeline = Array.from(timelineMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, value]) => ({ date, value }));

  const featureBreakdown = {
    swelling: Array.from(featureCounts.swelling.entries()).map(
      ([label, value]) => ({ label, value })
    ),
    color: Array.from(featureCounts.color.entries()).map(([label, value]) => ({
      label,
      value,
    })),
    opening: Array.from(featureCounts.opening.entries()).map(
      ([label, value]) => ({ label, value })
    ),
    moistness: Array.from(featureCounts.moistness.entries()).map(
      ([label, value]) => ({ label, value })
    ),
  };

  return {
    totalLogs,
    stageDistribution,
    confidenceByStage,
    timeline,
    featureBreakdown,
    recentLogs,
  };
}

export type DashboardStats = {
  totalSubjects: number;
  todaysScans: number;
  stageDistribution: { stage: string; value: number }[];
  recentActivity: {
    id: string;
    mouseName: string;
    cohortName: string;
    stage: string;
    imageUrl: string | null;
    time: string;
  }[];
  dailyTrend: {
    date: string;
    Proestrus: number;
    Estrus: number;
    Metestrus: number;
    Diestrus: number;
  }[];
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  // 1. Total Subjects
  const { count: totalSubjects, error: subjectsError } = await supabase
    .from("mice")
    .select("*", { count: "exact", head: true });

  if (subjectsError) throw subjectsError;

  // 2. Today's Scans
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count: todaysScans, error: scansError } = await supabase
    .from("estrus_logs")
    .select("*", { count: "exact", head: true })
    .gte("created_at", today.toISOString());

  if (scansError) throw scansError;

  // 3. Recent Activity (Last 10 logs across all cohorts)
  const { data: recentLogs, error: logsError } = await supabase
    .from("estrus_logs")
    .select("*, mice(name, cohort_id), cohorts(name)")
    .order("created_at", { ascending: false })
    .limit(10);

  if (logsError) throw logsError;

  // Bucket is public - just strip query params from old signed URLs
  const recentActivity = recentLogs.map((log) => {
    const imageUrl = log.image_url?.split("?")[0] || log.image_url;

    // Safe access for cohorts (might be object or array depending on TS inference)
    const cohortData = log.cohorts as unknown as
      | { name: string }
      | { name: string }[]
      | null;
    const cohortName = Array.isArray(cohortData)
      ? cohortData[0]?.name
      : cohortData?.name || "Unassigned";

    return {
      id: log.id,
      mouseName: log.mice?.name || "Unknown",
      cohortName,
      stage: log.stage,
      imageUrl,
      time: log.created_at,
    };
  });

  // 4. Stage Distribution (Last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: distributionData, error: distError } = await supabase
    .from("estrus_logs")
    .select("stage")
    .gte("created_at", weekAgo.toISOString());

  if (distError) throw distError;

  const stageCounts = new Map<string, number>();
  distributionData?.forEach((log) => {
    const stage = STAGES.includes(log.stage) ? log.stage : "Uncertain";
    stageCounts.set(stage, (stageCounts.get(stage) || 0) + 1);
  });

  const stageDistribution = Array.from(stageCounts.entries())
    .map(([stage, value]) => ({ stage, value }))
    .sort((a, b) => b.value - a.value);

  // 5. Daily Trend (Last 7 days breakdown by stage per day)
  const { data: trendData, error: trendError } = await supabase
    .from("estrus_logs")
    .select("stage, created_at")
    .gte("created_at", weekAgo.toISOString())
    .order("created_at", { ascending: true });

  if (trendError) throw trendError;

  // Group by date
  const dailyMap = new Map<
    string,
    { Proestrus: number; Estrus: number; Metestrus: number; Diestrus: number }
  >();

  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    dailyMap.set(dateStr, {
      Proestrus: 0,
      Estrus: 0,
      Metestrus: 0,
      Diestrus: 0,
    });
  }

  // Fill in the data
  trendData?.forEach((log) => {
    const dateStr = new Date(log.created_at).toISOString().split("T")[0];
    const dayData = dailyMap.get(dateStr);
    if (dayData && log.stage in dayData) {
      dayData[log.stage as keyof typeof dayData]++;
    }
  });

  const dailyTrend = Array.from(dailyMap.entries()).map(([date, counts]) => ({
    date,
    ...counts,
  }));

  return {
    totalSubjects: totalSubjects || 0,
    todaysScans: todaysScans || 0,
    stageDistribution,
    recentActivity,
    dailyTrend,
  };
}

// --- Experiments ---

export async function getExperiments() {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("experiments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createExperiment(formData: FormData) {
  const { userId, orgId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const startDate = formData.get("start_date") as string;
  const endDate = formData.get("end_date") as string;

  const { error } = await supabase.from("experiments").insert({
    user_id: userId,
    org_id: orgId || null,
    name,
    description,
    start_date: startDate || null,
    end_date: endDate || null,
    status: "planned",
  });

  if (error) throw error;
  revalidatePath("/experiments");
}

export async function getExperiment(id: string) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (!isValidUUID(id)) {
    // If the ID provided is not a valid UUID (e.g. "new", or garbage), return null early.
    // This prevents Postgres errors like "invalid input syntax for type uuid".
    return null;
  }

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const { data, error } = await supabase
    .from("experiments")
    .select(
      `
      *,
      experiment_cohorts (
        cohort_id,
        cohorts (*)
      )
    `
    )
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteExperiment(id: string) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const { error } = await supabase.from("experiments").delete().eq("id", id);

  if (error) throw error;
  revalidatePath("/experiments");
}

export async function addCohortToExperiment(
  experimentId: string,
  cohortId: string
) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const { error } = await supabase.from("experiment_cohorts").insert({
    experiment_id: experimentId,
    cohort_id: cohortId,
  });

  if (error) throw error;
  revalidatePath(`/experiments/${experimentId}`);
}

export async function removeCohortFromExperiment(
  experimentId: string,
  cohortId: string
) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  const { error } = await supabase
    .from("experiment_cohorts")
    .delete()
    .eq("experiment_id", experimentId)
    .eq("cohort_id", cohortId);

  if (error) throw error;
  revalidatePath(`/experiments/${experimentId}`);
}

// --- Experiment Insights & Export ---

export type ExperimentInsights = {
  totalLogs: number;
  totalSubjects: number;
  stageDistribution: { stage: string; value: number }[];
  timeline: { date: string; value: number }[];
  cohortStats: {
    id: string;
    name: string;
    subjectCount: number;
    logCount: number;
  }[];
};

export async function getExperimentInsights(
  experimentId: string
): Promise<ExperimentInsights> {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  // 1. Get Cohorts in Experiment
  const { data: experimentCohorts, error: cohortsError } = await supabase
    .from("experiment_cohorts")
    .select("cohort_id, cohorts(name)")
    .eq("experiment_id", experimentId);

  if (cohortsError) throw cohortsError;

  const cohortIds = experimentCohorts.map((ec) => ec.cohort_id);

  if (cohortIds.length === 0) {
    return {
      totalLogs: 0,
      totalSubjects: 0,
      stageDistribution: [],
      timeline: [],
      cohortStats: [],
    };
  }

  // 2. Get Logs for these cohorts (via mice)
  const { data: logs, error: logsError } = await supabase
    .from("estrus_logs")
    .select("id, stage, created_at, mice!inner(id, cohort_id)")
    .in("mice.cohort_id", cohortIds);

  if (logsError) throw logsError;

  // 3. Get Subjects count
  const { count: totalSubjects, error: subjectsError } = await supabase
    .from("mice")
    .select("*", { count: "exact", head: true })
    .in("cohort_id", cohortIds);

  if (subjectsError) throw subjectsError;

  // Aggregation
  const stageCounts = new Map<string, number>();
  const timelineMap = new Map<string, number>();
  const cohortLogCounts = new Map<string, number>();

  logs.forEach((log) => {
    const stage = STAGES.includes(log.stage) ? log.stage : "Uncertain";
    stageCounts.set(stage, (stageCounts.get(stage) || 0) + 1);

    const dayKey = new Date(log.created_at).toISOString().split("T")[0];
    timelineMap.set(dayKey, (timelineMap.get(dayKey) || 0) + 1);

    const cohortId = (log.mice as any)?.cohort_id;
    if (cohortId) {
      cohortLogCounts.set(cohortId, (cohortLogCounts.get(cohortId) || 0) + 1);
    }
  });

  // Subject count per cohort
  const { data: subjectsPerCohort } = await supabase
    .from("mice")
    .select("cohort_id")
    .in("cohort_id", cohortIds);

  const cohortSubjectCounts = new Map<string, number>();
  subjectsPerCohort?.forEach((s) => {
    if (s.cohort_id) {
      cohortSubjectCounts.set(
        s.cohort_id,
        (cohortSubjectCounts.get(s.cohort_id) || 0) + 1
      );
    }
  });

  const cohortStats = experimentCohorts.map((ec) => {
    // cohorts can be an array or single object depending on Supabase typing
    const cohortData = Array.isArray(ec.cohorts) ? ec.cohorts[0] : ec.cohorts;
    return {
      id: ec.cohort_id,
      name: cohortData?.name || "Unknown",
      subjectCount: cohortSubjectCounts.get(ec.cohort_id) || 0,
      logCount: cohortLogCounts.get(ec.cohort_id) || 0,
    };
  });

  return {
    totalLogs: logs.length,
    totalSubjects: totalSubjects || 0,
    stageDistribution: Array.from(stageCounts.entries())
      .map(([stage, value]) => ({ stage, value }))
      .sort((a, b) => b.value - a.value),
    timeline: Array.from(timelineMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value })),
    cohortStats,
  };
}

export async function getExperimentExportData(experimentId: string) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  // 1. Get Cohorts
  const { data: experimentCohorts } = await supabase
    .from("experiment_cohorts")
    .select("cohort_id")
    .eq("experiment_id", experimentId);

  if (!experimentCohorts || experimentCohorts.length === 0) return [];

  const cohortIds = experimentCohorts.map((ec) => ec.cohort_id);

  // 2. Fetch Full Data
  const { data, error } = await supabase
    .from("estrus_logs")
    .select(
      `
      *,
      mice!inner (
        name,
        cohort_id,
        cohorts ( name ),
        metadata
      )
    `
    )
    .in("mice.cohort_id", cohortIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Bucket is public - just strip query params from old signed URLs
  const rows = data.map((log) => {
    const imageUrl = log.image_url?.split("?")[0] || "";
    const mouse = log.mice as any;
    const cohort = mouse?.cohorts as any;

    return {
      LogID: log.id,
      Date: new Date(log.created_at).toLocaleString(),
      SubjectName: mouse?.name || "Unknown",
      CohortName: cohort?.name || "Unknown",
      Stage: log.stage,
      Confidence: extractConfidenceValue(log.confidence),
      Notes: log.notes || "",
      ImageURL: imageUrl,
      Features: JSON.stringify(log.features || {}),
      FlexibleData: JSON.stringify(log.data || {}),
      SubjectMetadata: JSON.stringify(mouse?.metadata || {}),
    };
  });

  return rows;
}

export async function getExperimentVisualizationData(experimentId: string) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);

  // 1. Get Cohorts
  const { data: experimentCohorts, error: cohortsError } = await supabase
    .from("experiment_cohorts")
    .select("cohort_id, cohorts(id, name, color)")
    .eq("experiment_id", experimentId);

  if (cohortsError) throw cohortsError;

  if (!experimentCohorts || experimentCohorts.length === 0) {
    return { cohorts: [], logs: [] };
  }

  const cohortIds = experimentCohorts.map((ec) => ec.cohort_id);

  // 2. Get All Mice in these cohorts (to have a complete list even if no logs)
  const { data: mice, error: miceError } = await supabase
    .from("mice")
    .select("id, name, cohort_id")
    .in("cohort_id", cohortIds)
    .order("name"); // Consistent ordering

  if (miceError) throw miceError;

  // 3. Get Logs
  // We select minimal fields needed for visualization to keep payload light
  const { data: logs, error: logsError } = await supabase
    .from("estrus_logs")
    .select("id, mouse_id, stage, created_at, features, confidence")
    .in("cohort_id", cohortIds)
    .order("created_at", { ascending: true });

  if (logsError) throw logsError;

  // Structure the data
  // We want to return a list of cohorts, each with their mice, and a flat list of logs (or nested)
  // Returning flat logs is usually easier for charting libraries, but nested mice is good for layout.

  const cohorts = experimentCohorts.map((ec) => ({
    ...ec.cohorts,
    mice: mice.filter((m) => m.cohort_id === ec.cohort_id),
  }));

  return {
    cohorts,
    logs: logs.map((log) => ({
      ...log,
      date: new Date(log.created_at).toISOString().split("T")[0], // Extract YYYY-MM-DD
    })),
  };
}

// =============================================================================
// Organization Discovery & Join Requests
// =============================================================================

export type DiscoverableOrg = {
  id: string;
  clerk_org_id: string;
  name: string;
  institution: string | null;
  department: string | null;
  description: string | null;
  logo_url: string | null;
  member_count: number;
  created_at: string;
};

export type JoinRequest = {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  message: string | null;
  role: string;
  status: "pending" | "approved" | "denied" | "cancelled";
  created_at: string;
};

/**
 * Search for discoverable organizations
 */
export async function searchOrganizations(
  query?: string,
  institution?: string
): Promise<DiscoverableOrg[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("search_organizations", {
    search_query: query || null,
    institution_filter: institution || null,
    limit_count: 20,
  });

  if (error) {
    console.error("Error searching organizations:", error);
    return [];
  }

  // We need to get org names from Clerk - for now return what we have
  // In production, you'd fetch org names from Clerk's API
  return (data || []).map((org: any) => ({
    id: org.id,
    clerk_org_id: org.clerk_org_id,
    name: org.department || "Unnamed Lab", // Fallback - ideally fetch from Clerk
    institution: org.institution,
    department: org.department,
    description: org.description,
    logo_url: org.logo_url,
    member_count: org.member_count || 1,
    created_at: org.created_at,
  }));
}

/**
 * Get all unique institutions for filtering
 */
export async function getInstitutions(): Promise<string[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("organization_profiles")
    .select("institution")
    .eq("is_discoverable", true)
    .not("institution", "is", null);

  if (error) {
    console.error("Error fetching institutions:", error);
    return [];
  }

  const institutions = [
    ...new Set(data?.map((d) => d.institution).filter(Boolean)),
  ] as string[];
  return institutions.sort();
}

/**
 * Create or update organization profile (called when org is created/updated)
 */
export async function upsertOrganizationProfile(data: {
  clerkOrgId: string;
  name: string;
  isDiscoverable?: boolean;
  institution?: string;
  department?: string;
  description?: string;
  logoUrl?: string;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createAdminClient();

  const { error } = await supabase.from("organization_profiles").upsert(
    {
      clerk_org_id: data.clerkOrgId,
      is_discoverable: data.isDiscoverable ?? false,
      institution: data.institution,
      department: data.name, // Use org name as department
      description: data.description,
      logo_url: data.logoUrl,
    },
    {
      onConflict: "clerk_org_id",
    }
  );

  if (error) throw error;

  revalidatePath("/onboarding");
}

/**
 * Request to join an organization
 */
export async function requestToJoinOrganization(
  organizationId: string,
  message?: string
) {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) throw new Error("Unauthorized");

  const supabase = createAdminClient();

  // Check if user already has a pending request
  const { data: existing } = await supabase
    .from("join_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .single();

  if (existing) {
    throw new Error("You already have a pending request for this organization");
  }

  const { error } = await supabase.from("join_requests").insert({
    user_id: userId,
    user_email: user.emailAddresses[0]?.emailAddress || "",
    user_name: user.fullName || user.firstName || null,
    organization_id: organizationId,
    message: message || null,
    role: "member",
    status: "pending",
  });

  if (error) throw error;

  revalidatePath("/onboarding");
  return { success: true };
}

/**
 * Get user's pending join requests
 */
export async function getMyJoinRequests(): Promise<
  (JoinRequest & { organization: DiscoverableOrg | null })[]
> {
  const { userId } = await auth();
  if (!userId) return [];

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("join_requests")
    .select(
      `
      *,
      organization_profiles (
        id,
        clerk_org_id,
        institution,
        department,
        description,
        logo_url,
        member_count,
        created_at
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching join requests:", error);
    return [];
  }

  return (data || []).map((req: any) => ({
    id: req.id,
    user_id: req.user_id,
    user_email: req.user_email,
    user_name: req.user_name,
    message: req.message,
    role: req.role,
    status: req.status,
    created_at: req.created_at,
    organization: req.organization_profiles
      ? {
          id: req.organization_profiles.id,
          clerk_org_id: req.organization_profiles.clerk_org_id,
          name: req.organization_profiles.department || "Unnamed Lab",
          institution: req.organization_profiles.institution,
          department: req.organization_profiles.department,
          description: req.organization_profiles.description,
          logo_url: req.organization_profiles.logo_url,
          member_count: req.organization_profiles.member_count || 1,
          created_at: req.organization_profiles.created_at,
        }
      : null,
  }));
}

/**
 * Cancel a pending join request
 */
export async function cancelJoinRequest(requestId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("join_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("user_id", userId)
    .eq("status", "pending");

  if (error) throw error;

  revalidatePath("/onboarding");
  return { success: true };
}

/**
 * Get pending requests for an organization (admin only)
 */
export async function getPendingRequestsForOrg(
  clerkOrgId: string
): Promise<JoinRequest[]> {
  const { userId } = await auth();
  if (!userId) return [];

  // Note: In production, verify the user is an admin of this org via Clerk
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("get_pending_requests", {
    org_clerk_id: clerkOrgId,
  });

  if (error) {
    console.error("Error fetching pending requests:", error);
    return [];
  }

  return (data || []).map((req: any) => ({
    id: req.id,
    user_id: req.user_id,
    user_email: req.user_email,
    user_name: req.user_name,
    message: req.message,
    role: req.role,
    status: "pending" as const,
    created_at: req.created_at,
  }));
}

/**
 * Approve a join request (admin only)
 * This will create a Clerk invitation for the user
 */
export async function approveJoinRequest(requestId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createAdminClient();

  // Get the request details
  const { data: request, error: fetchError } = await supabase
    .from("join_requests")
    .select(
      `
      *,
      organization_profiles (clerk_org_id)
    `
    )
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    throw new Error("Request not found");
  }

  // Update request status
  const { error: updateError } = await supabase
    .from("join_requests")
    .update({
      status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updateError) throw updateError;

  // TODO: Create Clerk invitation using Clerk Backend API
  // const clerkOrgId = request.organization_profiles?.clerk_org_id;
  // await clerkClient.organizations.createOrganizationInvitation({
  //   organizationId: clerkOrgId,
  //   emailAddress: request.user_email,
  //   role: "basic_member",
  // });

  revalidatePath("/");
  return { success: true };
}

/**
 * Deny a join request (admin only)
 */
export async function denyJoinRequest(requestId: string, note?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("join_requests")
    .update({
      status: "denied",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_note: note || null,
    })
    .eq("id", requestId);

  if (error) throw error;

  revalidatePath("/");
  return { success: true };
}

/**
 * Get organization profile by Clerk org ID
 */
export async function getOrganizationProfile(clerkOrgId: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("organization_profiles")
    .select("*")
    .eq("clerk_org_id", clerkOrgId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching org profile:", error);
    return null;
  }

  return data;
}

/**
 * Update organization profile settings
 */
export async function updateOrganizationProfile(
  clerkOrgId: string,
  updates: {
    isDiscoverable?: boolean;
    institution?: string;
    department?: string;
    description?: string;
  }
) {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Verify user is part of this org
  if (orgId !== clerkOrgId) {
    throw new Error("You can only update your own organization");
  }

  const supabase = createAdminClient();

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.isDiscoverable !== undefined)
    updateData.is_discoverable = updates.isDiscoverable;
  if (updates.institution !== undefined)
    updateData.institution = updates.institution;
  if (updates.department !== undefined)
    updateData.department = updates.department;
  if (updates.description !== undefined)
    updateData.description = updates.description;

  const { error } = await supabase
    .from("organization_profiles")
    .update(updateData)
    .eq("clerk_org_id", clerkOrgId);

  if (error) throw error;

  revalidatePath("/settings");
  return { success: true };
}

/**
 * Get user's data summary (for showing what they have across orgs)
 */
export async function getUserDataSummary() {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = createAdminClient();

  // Get cohorts grouped by org
  const { data: cohorts } = await supabase
    .from("cohorts")
    .select("id, name, org_id, created_at")
    .eq("user_id", userId);

  // Get mice count
  const { count: miceCount } = await supabase
    .from("mice")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // Get logs count
  const { data: logCounts } = await supabase
    .from("estrus_logs")
    .select("id, mice!inner(user_id)")
    .eq("mice.user_id", userId);

  // Group cohorts by org
  const orgMap = new Map<string | null, typeof cohorts>();
  cohorts?.forEach((c) => {
    const existing = orgMap.get(c.org_id) || [];
    existing.push(c);
    orgMap.set(c.org_id, existing);
  });

  // Get org names
  const orgIds = [
    ...new Set(cohorts?.map((c) => c.org_id).filter(Boolean) as string[]),
  ];
  const { data: orgProfiles } = await supabase
    .from("organization_profiles")
    .select("clerk_org_id, department, institution")
    .in("clerk_org_id", orgIds);

  const orgNameMap = new Map(
    orgProfiles?.map((o) => [o.clerk_org_id, o]) || []
  );

  return {
    totalCohorts: cohorts?.length || 0,
    totalMice: miceCount || 0,
    totalLogs: logCounts?.length || 0,
    byOrg: Array.from(orgMap.entries()).map(([orgId, orgCohorts]) => ({
      orgId,
      orgName: orgId
        ? orgNameMap.get(orgId)?.department || "Unknown Org"
        : "Personal",
      institution: orgId ? orgNameMap.get(orgId)?.institution : null,
      cohortCount: orgCohorts?.length || 0,
      isOrphaned: orgId ? !orgNameMap.has(orgId) : false,
    })),
  };
}
