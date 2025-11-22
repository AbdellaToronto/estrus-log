"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createServerClient, configFromEnv } from "@/lib/supabase";
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

// --- Cohorts ---

export async function getCohorts() {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");
  
  const token = await getToken();
  const supabase = createServerClient(configFromEnv(), token || undefined);
  
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
  const supabase = createServerClient(configFromEnv(), token || undefined);
  
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

  const token = await getToken();
  const supabase = createServerClient(configFromEnv(), token || undefined);

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
  const supabase = createServerClient(configFromEnv(), token || undefined);

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
  const supabase = createServerClient(configFromEnv(), token || undefined);
  
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
  
  const token = await getToken();
  const supabase = createServerClient(configFromEnv(), token || undefined);
  
  const { data, error } = await supabase
    .from("mice")
    .select("*, cohorts(name, color, type, subject_config, log_config)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createSubject(formData: FormData) {
  const { userId, orgId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");
  
  const token = await getToken();
  const supabase = createServerClient(configFromEnv(), token || undefined);
  
  const name = formData.get("name") as string;
  const cohortId = formData.get("cohortId") as string;

  const metadata: Record<string, string> = {};
  ["dob", "genotype", "cage_number"].forEach((field) => {
    const value = formData.get(field);
    if (typeof value === "string" && value.length > 0) {
      metadata[field] = value;
    }
  });

  const { error } = await supabase.from("mice").insert({
    user_id: userId,
    org_id: orgId || null,
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
  const supabase = createServerClient(configFromEnv(), token || undefined);
  
  const { data, error } = await supabase
    .from("estrus_logs")
    .select("*")
    .eq("mouse_id", subjectId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Refresh signed URLs
  const { bucket } = getGcs();
  const bucketName = bucket.name;
  const prefix = `https://storage.googleapis.com/${bucketName}/`;

  const updatedLogs = await Promise.all(
    data.map(async (log) => {
      if (log.image_url && log.image_url.includes(prefix)) {
        try {
          const objectPath = log.image_url.split(prefix)[1].split("?")[0];
          const file = bucket.file(objectPath);
          const [newUrl] = await file.getSignedUrl({
            version: "v4",
            action: "read",
            expires: Date.now() + 60 * 60 * 1000, // 1 hour
          });
          return { ...log, image_url: newUrl };
        } catch (e) {
          console.error("Failed to refresh URL for log", log.id, e);
          return log;
        }
      }
      return log;
    })
  );

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
  const supabase = createServerClient(configFromEnv(), token || undefined);
  
  const { error } = await supabase.from("estrus_logs").insert({
    mouse_id: data.subjectId,
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
  const supabase = createServerClient(configFromEnv(), token || undefined);

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
  const supabase = createServerClient(configFromEnv(), token || undefined);

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

  const updatedItems = await Promise.all(
    data.map(async (item) => {
      // Only refresh if it looks like a GCS URL
      if (item.image_url && item.image_url.includes(prefix)) {
        try {
          const objectPath = item.image_url.split(prefix)[1];
          // Remove query params if any (signed urls have them)
          const cleanPath = objectPath.split("?")[0];

          const file = bucket.file(cleanPath);
          const [newUrl] = await file.getSignedUrl({
            version: "v4",
            action: "read", // Use 'read' for viewing, but 'write' if we were re-uploading (not needed here)
            expires: Date.now() + 60 * 60 * 1000, // 1 hour
          });

          // We return the new signed URL for the UI to use, but we don't necessarily need to update the DB
          // unless we want to persist it. For now, just returning it is enough for the UI session.
          return { ...item, image_url: newUrl };
        } catch (e) {
          console.error("Failed to refresh URL", e);
          return item;
        }
      }
      return item;
    })
  );

  return updatedItems;
}

export async function startScanSessionAnalysis(sessionId: string) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  const supabase = createServerClient(configFromEnv(), token || undefined);

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
  const supabase = createServerClient(configFromEnv(), token || undefined);

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
  const supabase = createServerClient(configFromEnv(), token || undefined);

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
  const supabase = createServerClient(configFromEnv(), token || undefined);

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
  const supabase = createServerClient(configFromEnv(), token || undefined);

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
  const { userId, orgId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  const supabase = createServerClient(configFromEnv(), token || undefined);

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
          // Create it
          const { data: createdSubject } = await supabase
            .from("mice")
            .insert({
              user_id: userId,
              org_id: orgId || null,
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
  const supabase = createServerClient(configFromEnv(), token || undefined);

  const { data, error } = await supabase
    .from("estrus_logs")
    .select("*, mice!inner(name, cohort_id)")
    .eq("mice.cohort_id", cohortId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Refresh signed URLs
  const { bucket } = getGcs();
  const bucketName = bucket.name;
  const prefix = `https://storage.googleapis.com/${bucketName}/`;

  const updatedData = await Promise.all(
    data.map(async (log) => {
      if (log.image_url && log.image_url.includes(prefix)) {
        try {
          const objectPath = log.image_url.split(prefix)[1].split("?")[0];
          const file = bucket.file(objectPath);
          const [newUrl] = await file.getSignedUrl({
            version: "v4",
            action: "read",
            expires: Date.now() + 60 * 60 * 1000, // 1 hour
          });
          return { ...log, image_url: newUrl };
        } catch (e) {
          console.error("Failed to refresh URL for log", log.id, e);
          return log;
        }
      }
      return log;
    })
  );

  // Transform to include subjectName for easier consumption
  return updatedData.map((log) => ({
    ...log,
    subjectName: log.mice?.name || "Unknown",
  }));
}

export async function getCohortInsights(
  cohortId: string
): Promise<CohortInsights> {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  const supabase = createServerClient(configFromEnv(), token || undefined);

  const { data: logs, error } = await supabase
    .from("estrus_logs")
    .select(
      "id, stage, confidence, created_at, image_url, features, mice!inner(name, cohort_id)"
    )
    .eq("mice.cohort_id", cohortId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const typedLogs = (logs ?? []) as LogWithSubject[];

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
