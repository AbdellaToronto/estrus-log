"use server";

import { auth, currentUser, isLocalRehearsal } from "@/lib/auth";
import { randomUUID } from "node:crypto";
import { createAuthClient, createAdminClient } from "@/lib/supabase";
import { getGcs, getReadableImageUrl, toGcsObjectUri } from "@/lib/gcs";
import { revalidatePath } from "next/cache";
import { tasks } from "@trigger.dev/sdk/v3";
import type {
  analyzeScanSessionTask,
  proposeScanSessionRoisTask,
} from "@/trigger/scan-tasks";
import type { Database } from "@/lib/database-types";
import { normalizeClassificationFeatures } from "@/lib/classification";
import {
  isSubjectCoatColour,
  normalizeSubjectCoatColour,
  type SubjectCoatColour,
} from "@/lib/subject-metadata";

// --- Types/Defaults ---
const DEFAULT_ESTRUS_CONFIG = {
  subject_config: {
    fields: ["dob", "genotype", "cage_number", "coat_colour", "strain"],
  },
  log_config: {
    stages: ["Proestrus", "Estrus", "Metestrus", "Diestrus"],
    features: ["swelling_score", "color_score"],
  },
};

type LogRow = Database["public"]["Tables"]["estrus_logs"]["Row"];
type LogWithSubject = LogRow & {
  mice?: {
    name?: string;
    cohort_id?: string;
    coat_colour?: string | null;
    strain?: string | null;
  } | null;
};

export type ObservationModality = "external_photo" | "vaginal_cytology";
export type BatchObservationContext = {
  modality: ObservationModality;
  captureDate: string;
};

type LogObservationContext = BatchObservationContext & {
  labelStatus: "confirmed" | "uncertain_or_transition";
  confirmationSource:
    | "scientist_review"
    | "scientist_batch_review"
    | "paired_cytology_review";
};

type GroundTruthReference = {
  modality: "vaginal_cytology";
  imageUrl: string;
  sampleId?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isObservationModality = (value: unknown): value is ObservationModality =>
  value === "external_photo" || value === "vaginal_cytology";

const assertBatchObservationContext = (
  context: BatchObservationContext
): BatchObservationContext => {
  if (!isObservationModality(context.modality)) {
    throw new Error("Choose whether this batch is external photos or vaginal cytology");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(context.captureDate)) {
    throw new Error("A specimen capture date is required for this batch");
  }
  return context;
};

const assertLogObservationContext = (
  context: LogObservationContext
): LogObservationContext => {
  assertBatchObservationContext(context);
  if (context.labelStatus !== "confirmed" && context.labelStatus !== "uncertain_or_transition") {
    throw new Error("A confirmed or uncertain observation status is required");
  }
  if (
    context.confirmationSource !== "scientist_review" &&
    context.confirmationSource !== "scientist_batch_review" &&
    context.confirmationSource !== "paired_cytology_review"
  ) {
    throw new Error("A scientist confirmation source is required");
  }
  return context;
};

const normalizeCaptureMetadata = (metadata?: Record<string, unknown>) => {
  if (!metadata) return {};
  return Object.entries(metadata).reduce<Record<string, string>>((result, [key, value]) => {
    if (typeof value !== "string") return result;
    const trimmed = value.trim();
    if (trimmed) result[key] = trimmed.slice(0, 200);
    return result;
  }, {});
};

const extractConfidenceValue = (
  value: LogRow["confidence"],
  stage?: string
): number => {
  const bounded = (raw: number) => Math.min(1, Math.max(0, raw));
  if (typeof value === "number" && Number.isFinite(value)) return bounded(value);
  if (isRecord(value) && "score" in value) {
    const rawScore = value["score"];
    if (typeof rawScore === "number" && Number.isFinite(rawScore)) {
      return bounded(rawScore);
    }
  }
  // Some early records stored the complete score distribution directly in
  // `confidence`. Use the score for the saved stage instead of reporting 0.
  if (stage && isRecord(value)) {
    const stageScore = value[stage];
    if (typeof stageScore === "number" && Number.isFinite(stageScore)) {
      return bounded(stageScore);
    }
  }
  return 0;
};

const hasModelSupport = (log: Pick<LogRow, "data">): boolean => {
  if (!isRecord(log.data)) return false;
  const scores = log.data.confidence_scores;
  return (
    isRecord(scores) &&
    Object.values(scores).some(
      (value) => typeof value === "number" && Number.isFinite(value)
    )
  );
};

type ExternalBinarySummary = {
  decision_status?: string;
  reference_backed_binary_suggestion?: string;
  probability_proestrus_or_estrus?: number;
  model_version?: string;
};

const getExternalBinarySummary = (log: Pick<LogRow, "data">): ExternalBinarySummary | null => {
  if (!isRecord(log.data)) return null;
  const evidence = log.data.evidence;
  if (!isRecord(evidence)) return null;
  const binary = evidence.external_binary;
  return isRecord(binary) ? (binary as ExternalBinarySummary) : null;
};

const coerceFeatureRecord = (value: unknown): Record<string, string> => {
  const normalized = normalizeClassificationFeatures(
    isRecord(value) ? value : undefined
  );
  return Object.entries(normalized).reduce<Record<string, string>>(
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

  const { data: cohort, error } = await supabase
    .from("cohorts")
    .insert({
      user_id: userId,
      org_id: orgId || null,
      name,
      description,
      color: "bg-blue-500",
      type,
      subject_config: subjectConfig,
      log_config: logConfig,
    })
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/dashboard");
  revalidatePath("/cohorts");
  return cohort;
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
  const rawCoatColour = formData.get("coat_colour");
  const coatColour = normalizeSubjectCoatColour(rawCoatColour);
  const strainValue = formData.get("strain");
  const strain =
    typeof strainValue === "string"
      ? strainValue.trim().slice(0, 120) || null
      : null;

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
    coat_colour: coatColour,
    strain,
    metadata,
  });

  if (error) throw error;
  revalidatePath("/dashboard");
  if (cohortId) revalidatePath(`/cohorts/${cohortId}`);
}

export async function updateSubjectResearchMetadata(data: {
  subjectId: string;
  coatColour: SubjectCoatColour | null;
  strain?: string;
}) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!isValidUUID(data.subjectId)) throw new Error("A valid subject is required");
  if (
    data.coatColour !== null &&
    !isSubjectCoatColour(data.coatColour)
  ) {
    throw new Error("Choose a supported coat-colour category");
  }
  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const strain = data.strain?.trim().slice(0, 120) || null;
  const supabase = createAuthClient(token);
  const { data: subject, error } = await supabase
    .from("mice")
    .update({ coat_colour: data.coatColour, strain })
    .eq("id", data.subjectId)
    .select("id, cohort_id, coat_colour, strain")
    .single();

  if (error) throw error;
  revalidatePath(`/subjects/${data.subjectId}`);
  if (subject.cohort_id) revalidatePath(`/cohorts/${subject.cohort_id}`);
  return subject;
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

  const updatedLogs = await Promise.all(
    data.map(async (log) => {
      const flexibleData = isRecord(log.data) ? log.data : {};
      const modelInput = isRecord(flexibleData.model_input_reference)
        ? flexibleData.model_input_reference
        : null;
      const modelInputObjectReference = modelInput?.image_object_reference;
      const readableModelInput = typeof modelInputObjectReference === "string"
        ? await getReadableImageUrl(modelInputObjectReference)
        : null;
      return {
        ...log,
        image_url: await getReadableImageUrl(log.image_url),
        reference_image_url: await getReadableImageUrl(log.reference_image_url),
        data: modelInput
          ? {
              ...flexibleData,
              model_input_reference: {
                ...modelInput,
                readable_image_url: readableModelInput,
              },
            }
          : log.data,
      };
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
  observationContext: LogObservationContext;
  groundTruthReference?: GroundTruthReference;
  captureMetadata?: Record<string, unknown>;
  flexibleData?: Record<string, unknown>;
}) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);
  const observation = assertLogObservationContext(data.observationContext);

  if (!isValidUUID(data.subjectId)) throw new Error("A valid subject is required");
  const stage = data.stage.trim();
  if (!stage) throw new Error("A stage is required");
  if (stage === "Uncertain / transition" && !data.notes.trim()) {
    throw new Error("A brief observation note is required for an uncertain or transition finding");
  }
  if (stage === "Uncertain / transition" && observation.labelStatus !== "uncertain_or_transition") {
    throw new Error("Transition findings must be recorded as uncertain or transition");
  }
  const confidence =
    typeof data.confidence === "number" ? data.confidence : data.confidence.score;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("Confidence must be a number between 0 and 1");
  }
  const reference = data.groundTruthReference;
  if (observation.confirmationSource === "paired_cytology_review") {
    if (observation.modality !== "external_photo") {
      throw new Error("Paired cytology can confirm an external-photo observation only");
    }
    if (
      reference?.modality !== "vaginal_cytology" ||
      !reference.imageUrl.trim()
    ) {
      throw new Error("A paired cytology image is required for cytology-confirmed ground truth");
    }
  } else if (reference) {
    throw new Error("Cytology reference evidence requires paired cytology confirmation");
  }

  // Get the cohort_id from the subject - required for RLS
  const { data: subject, error: subjectError } = await supabase
    .from("mice")
    .select("cohort_id")
    .eq("id", data.subjectId)
    .single();

  if (subjectError || !subject?.cohort_id) {
    throw new Error("Subject was not found in a cohort you can access");
  }

  const { error } = await supabase.from("estrus_logs").insert({
    mouse_id: data.subjectId,
    cohort_id: subject?.cohort_id, // Required for RLS policy
    stage,
    confidence,
    features: normalizeClassificationFeatures(data.features),
    data: data.flexibleData ?? {},
    image_url: data.imageUrl,
    notes: data.notes,
    modality: observation.modality,
    capture_date: observation.captureDate,
    label_status: observation.labelStatus,
    confirmation_source: observation.confirmationSource,
    reviewer_id: userId,
    capture_metadata: normalizeCaptureMetadata(data.captureMetadata),
    reference_modality: reference?.modality ?? null,
    reference_image_url: reference?.imageUrl ?? null,
    reference_sample_id: reference?.sampleId?.trim().slice(0, 200) || null,
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

  // A session remains recoverable through analysis and review. Previously a
  // page refresh after analysis hid the pending review session from its owner.
  const { data, error } = await supabase
    .from("scan_sessions")
    .select("*")
    .eq("cohort_id", cohortId)
    .eq("user_id", userId)
    .in("status", ["pending", "analyzing", "review"])
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

  const updatedItems = await Promise.all(
    data.map(async (item) => ({
      ...item,
      image_url: await getReadableImageUrl(item.image_url),
      cropped_image_url: await getReadableImageUrl(item.cropped_image_url),
      mask_image_url: await getReadableImageUrl(item.mask_image_url),
    }))
  );

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
    .select("id, cohort_id, modality, capture_date")
    .eq("id", sessionId)
    .single();

  if (error) throw error;
  if (!session) throw new Error("Session not found");
  if (session.modality !== "external_photo") {
    throw new Error(
      "Batch analysis is available only for external genital photos. Log cytology as a scientist-reviewed single observation."
    );
  }
  if (!session.capture_date) {
    throw new Error("Add the specimen capture date before starting analysis");
  }

  const { data: items, error: itemsError } = await supabase
    .from("scan_items")
    .select("status, cropped_image_url")
    .eq("session_id", sessionId);
  if (itemsError) throw itemsError;
  if (!items?.length) throw new Error("Add images before starting analysis");
  const unresolved = items.filter(
    (item) => !["roi_confirmed", "complete", "saved"].includes(item.status ?? "")
  );
  if (unresolved.length > 0) {
    throw new Error(`Confirm every suggested crop before analysis (${unresolved.length} remaining)`);
  }

  const { error: statusError } = await supabase
    .from("scan_sessions")
    .update({ status: "analyzing" })
    .eq("id", sessionId);
  if (statusError) throw statusError;

  await tasks.trigger<typeof analyzeScanSessionTask>("analyze-scan-session", {
    sessionId,
  });

  return { sessionId };
}

export async function startScanSessionRoiProposal(sessionId: string) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);
  const { data: session, error } = await supabase
    .from("scan_sessions")
    .select("id, modality, capture_date")
    .eq("id", sessionId)
    .single();
  if (error) throw error;
  if (!session) throw new Error("Session not found");
  if (session.modality !== "external_photo" || !session.capture_date) {
    throw new Error("Choose an external-photo modality and capture date before suggesting crops");
  }

  const { error: statusError } = await supabase
    .from("scan_sessions")
    .update({ status: "proposing_roi" })
    .eq("id", sessionId);
  if (statusError) throw statusError;

  await tasks.trigger<typeof proposeScanSessionRoisTask>("propose-scan-session-rois", {
    sessionId,
  });
  return { sessionId };
}

export async function createScanSession(
  cohortId: string,
  context: BatchObservationContext,
  name?: string
) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);
  const observation = assertBatchObservationContext(context);

  const { data, error } = await supabase
    .from("scan_sessions")
    .insert({
      cohort_id: cohortId,
      user_id: userId,
      name: name || `Batch Scan ${new Date().toLocaleDateString()}`,
      status: "pending",
      modality: observation.modality,
      capture_date: observation.captureDate,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateScanSessionContext(
  sessionId: string,
  context: BatchObservationContext
) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const token = await getToken();
  if (!token) throw new Error("No authentication token");
  if (!isValidUUID(sessionId)) throw new Error("A valid scan session is required");

  const observation = assertBatchObservationContext(context);
  const supabase = createAuthClient(token);
  const { error } = await supabase
    .from("scan_sessions")
    .update({ modality: observation.modality, capture_date: observation.captureDate })
    .eq("id", sessionId);
  if (error) throw error;
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
    croppedImageUrl?: string;
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
    cropped_image_url?: string;
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
  if (updates.croppedImageUrl) {
    payload.cropped_image_url = updates.croppedImageUrl;
  }

  const { error } = await supabase
    .from("scan_items")
    .update(payload)
    .eq("id", itemId);

  if (error) throw error;
}

export async function deleteScanItem(itemId: string) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const token = await getToken();
  if (!token) throw new Error("No authentication token");
  if (!isValidUUID(itemId)) throw new Error("A valid scan item is required");

  const supabase = createAuthClient(token);
  const { error } = await supabase
    .from("scan_items")
    .delete()
    .eq("id", itemId);
  if (error) throw error;
}

// --- Scan History & Receipts ---

export type ScanSessionSummary = {
  id: string;
  name: string | null;
  status: string;
  workflowStatus: "preparing" | "analyzing" | "review" | "saved";
  created_at: string;
  captureDate: string | null;
  modality: string | null;
  itemCount: number;
  completedCount: number;
  actionCount: number;
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
    savedStage: string | null;
    notes: string | null;
    captureDate: string | null;
    confirmationSource: string | null;
    binaryModel: {
      decisionStatus: string | null;
      suggestion: string | null;
      probabilityEarly: number | null;
      modelVersion: string | null;
    } | null;
    mouse_id: string | null;
    mouse_name: string | null;
    created_at: string;
  }[];
  subjectsLogged: { id: string; name: string; logCount: number }[];
};

/**
 * Get all scan sessions for a cohort (for history view)
 * Now queries from estrus_logs (permanent records) for accurate counts
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
    .select("id, name, status, created_at, capture_date, modality")
    .eq("cohort_id", cohortId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!sessions?.length) return [];

  // Get log counts and stage breakdowns from estrus_logs (the permanent records)
  const sessionIds = sessions.map((s) => s.id);

  const [{ data: logs, error: logsError }, { data: scanItems, error: itemsError }] = await Promise.all([
    supabase
    .from("estrus_logs")
    .select("session_id, stage")
    .in("session_id", sessionIds),
    supabase
      .from("scan_items")
      .select("session_id, status")
      .in("session_id", sessionIds),
  ]);
  if (logsError) throw logsError;
  if (itemsError) throw itemsError;

  // Aggregate by session
  const sessionStats = new Map<
    string,
    {
      scanItemCount: number;
      completedCount: number;
      workflowCompleteCount: number;
      stageBreakdown: Record<string, number>;
    }
  >();

  logs?.forEach((log) => {
    if (!log.session_id) return;
    const stats = sessionStats.get(log.session_id) || {
      scanItemCount: 0,
      completedCount: 0,
      workflowCompleteCount: 0,
      stageBreakdown: {},
    };
    stats.completedCount++; // All logs are finalized
    if (log.stage) {
      stats.stageBreakdown[log.stage] =
        (stats.stageBreakdown[log.stage] || 0) + 1;
    }
    sessionStats.set(log.session_id, stats);
  });

  scanItems?.forEach((item) => {
    if (!item.session_id) return;
    const stats = sessionStats.get(item.session_id) || {
      scanItemCount: 0,
      completedCount: 0,
      workflowCompleteCount: 0,
      stageBreakdown: {},
    };
    stats.scanItemCount++;
    if (["complete", "saved"].includes(item.status ?? "")) {
      stats.workflowCompleteCount++;
    }
    sessionStats.set(item.session_id, stats);
  });

  return sessions.map((session) => {
    const stats = sessionStats.get(session.id) || {
      scanItemCount: 0,
      completedCount: 0,
      workflowCompleteCount: 0,
      stageBreakdown: {},
    };
    // A saved log and its originating scan item represent the same photo. Older
    // sessions may have logs but no retained workflow items, so use the larger
    // of the two sources instead of adding them together.
    const itemCount = Math.max(stats.scanItemCount, stats.completedCount);
    const actionCount = Math.max(0, itemCount - stats.completedCount);
    const workflowStatus: ScanSessionSummary["workflowStatus"] =
      itemCount > 0 && actionCount === 0
        ? "saved"
        : session.status === "review" || stats.workflowCompleteCount > 0
          ? "review"
          : ["analyzing", "processing"].includes(session.status)
            ? "analyzing"
            : "preparing";
    return {
      ...session,
      captureDate: session.capture_date,
      modality: session.modality,
      workflowStatus,
      itemCount,
      completedCount: stats.completedCount,
      actionCount,
      stageBreakdown: stats.stageBreakdown,
    };
  });
}

/**
 * Get detailed scan session info (for receipt view)
 * Now queries from estrus_logs (permanent records) instead of scan_items (workflow)
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
      id, name, status, created_at, capture_date, modality,
      cohorts (id, name)
    `
    )
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) return null;

  // Get logs linked to this session (the permanent records)
  const { data: logs, error: logsError } = await supabase
    .from("estrus_logs")
    .select(
      `
      id, image_url, stage, notes, capture_date, confirmation_source, data, created_at, mouse_id,
      mice (id, name)
    `
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (logsError) throw logsError;

  const cleanedItems = await Promise.all(
    (logs ?? []).map(async (log) => {
      const imageUrl = await getReadableImageUrl(log.image_url);
      const miceData = log.mice as
        | { id: string; name: string }
        | { id: string; name: string }[]
        | null;
      const mice = Array.isArray(miceData) ? miceData[0] : miceData;
      const binary = getExternalBinarySummary(log);
      return {
        id: log.id,
        image_url: imageUrl,
        status: "completed" as const, // Logs are always finalized
        savedStage: log.stage,
        notes: log.notes,
        captureDate: log.capture_date,
        confirmationSource: log.confirmation_source,
        binaryModel: binary
          ? {
              decisionStatus: binary.decision_status ?? null,
              suggestion: binary.reference_backed_binary_suggestion ?? null,
              probabilityEarly:
                typeof binary.probability_proestrus_or_estrus === "number"
                  ? binary.probability_proestrus_or_estrus
                  : null,
              modelVersion: binary.model_version ?? null,
            }
          : null,
        mouse_id: log.mouse_id,
        mouse_name: mice?.name || null,
        created_at: log.created_at,
      };
    })
  );

  // When a session has not been saved yet, retain its real workflow items so
  // the session page can direct the scientist back to review instead of
  // presenting an empty "receipt".
  let workflowItems: ScanSessionDetail["items"] = [];
  if (cleanedItems.length === 0) {
    const { data: pendingItems, error: pendingItemsError } = await supabase
      .from("scan_items")
      .select("id, image_url, cropped_image_url, status, ai_result, mouse_id, created_at, mice(id, name)")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (pendingItemsError) throw pendingItemsError;
    workflowItems = await Promise.all((pendingItems ?? []).map(async (item) => {
      const miceData = item.mice as { id: string; name: string } | { id: string; name: string }[] | null;
      const mouse = Array.isArray(miceData) ? miceData[0] : miceData;
      const result = isRecord(item.ai_result) ? item.ai_result : {};
      const evidence = isRecord(result.evidence) ? result.evidence : {};
      const binary = isRecord(evidence.external_binary) ? evidence.external_binary : null;
      return {
        id: item.id,
        image_url: await getReadableImageUrl(item.cropped_image_url || item.image_url),
        status: item.status ?? "pending",
        savedStage:
          typeof result.scientist_confirmed_stage === "string"
            ? result.scientist_confirmed_stage
            : null,
        notes: null,
        captureDate: session.capture_date,
        confirmationSource: null,
        binaryModel: binary
          ? {
              decisionStatus: typeof binary.decision_status === "string" ? binary.decision_status : null,
              suggestion: typeof binary.reference_backed_binary_suggestion === "string" ? binary.reference_backed_binary_suggestion : null,
              probabilityEarly: typeof binary.probability_proestrus_or_estrus === "number" ? binary.probability_proestrus_or_estrus : null,
              modelVersion: typeof binary.model_version === "string" ? binary.model_version : null,
            }
          : null,
        mouse_id: item.mouse_id,
        mouse_name: mouse?.name || null,
        created_at: item.created_at,
      };
    }));
  }

  const receiptItems = cleanedItems.length > 0 ? cleanedItems : workflowItems;

  // Scientist-confirmed saved stage distribution.
  const stageBreakdown: Record<string, number> = {};
  cleanedItems.forEach((item) => {
    if (item.savedStage) {
      stageBreakdown[item.savedStage] = (stageBreakdown[item.savedStage] || 0) + 1;
    }
  });

  // Calculate subjects logged
  const subjectCounts = new Map<
    string,
    { id: string; name: string; count: number }
  >();
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

  const cohortDataRaw = session.cohorts as
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
  const cohortData = Array.isArray(cohortDataRaw)
    ? cohortDataRaw[0]
    : cohortDataRaw;

  return {
    id: session.id,
    name: session.name,
    status: session.status,
    created_at: session.created_at,
    cohort: cohortData,
    workflowStatus:
      cleanedItems.length > 0 && cleanedItems.length === receiptItems.length
        ? "saved"
        : session.status === "review" || workflowItems.some((item) => item.status === "complete")
          ? "review"
          : ["analyzing", "processing"].includes(session.status)
            ? "analyzing"
            : "preparing",
    captureDate: session.capture_date,
    modality: session.modality,
    itemCount: receiptItems.length,
    completedCount: cleanedItems.length, // All logs are finalized
    actionCount: Math.max(0, receiptItems.length - cleanedItems.length),
    stageBreakdown,
    items: receiptItems,
    subjectsLogged: Array.from(subjectCounts.values()).map((s) => ({
      id: s.id,
      name: s.name,
      logCount: s.count,
    })),
  };
}

// --- GCS Upload & Batch ---

const localUploadDescriptor = (filename: string) => {
  const safeFilename = filename
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120) || "image";
  const objectUrl = `/api/local-uploads/${randomUUID()}/${safeFilename}`;
  return { url: objectUrl, objectUrl, readUrl: objectUrl };
};

export async function getUploadUrl(
  filename: string,
  contentType: string,
  cohortId?: string
) {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (isLocalRehearsal()) return localUploadDescriptor(filename);

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
    objectUrl: toGcsObjectUri(bucket.name, path),
    readUrl: await getReadableImageUrl(toGcsObjectUri(bucket.name, path)),
  };
}

export async function getUploadUrls(
  files: { filename: string; contentType: string }[],
  cohortId: string
) {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (isLocalRehearsal()) {
    return files.map((file) => ({
      filename: file.filename,
      ...localUploadDescriptor(file.filename),
    }));
  }

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
        objectUrl: toGcsObjectUri(bucket.name, path),
        readUrl: await getReadableImageUrl(toGcsObjectUri(bucket.name, path)),
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
  notes?: string;
  scanItemId?: string;
  subjectId?: string; // Explicit existing subject
  newSubjectName?: string; // Or create a new one
  observationContext: BatchObservationContext;
  flexibleData?: Record<string, unknown>; // NEW: Support flexible data like granular confidences
};

export type CohortInsights = {
  totalLogs: number;
  modelSupportedLogs: number;
  binaryModelReviews: number;
  binarySuggestions: number;
  binaryAbstentions: number;
  binaryEarlyLeads: number;
  binaryLateLeads: number;
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
    hasModelSupport: boolean;
    created_at: string;
    subjectName: string;
    imageUrl: string | null;
    binaryDecisionStatus: string | null;
    binaryGroup: string | null;
  }[];
};

const STAGES = ["Proestrus", "Estrus", "Metestrus", "Diestrus", "Uncertain", "Uncertain / transition"];

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

  if (items.length === 0) return { savedCount: 0 };
  if (
    items.some(
      (item) => !item.subjectId && !item.newSubjectName?.trim()
    )
  ) {
    throw new Error("Assign every analyzed image to a subject before saving");
  }

  // Get the cohort's org_id to ensure new subjects inherit it
  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("org_id")
    .eq("id", cohortId)
    .single();

  if (cohortError || !cohort) throw new Error("Cohort not found");

  const cohortOrgId = cohort?.org_id || null;

  // 1. Get existing subjects to match filenames
  const { data: existingSubjects } = await supabase
    .from("mice")
    .select("id, name")
    .eq("cohort_id", cohortId);

  const subjectMap = new Map(
    existingSubjects?.map((s) => [s.name.toLowerCase(), s.id])
  );
  const subjectIds = new Set(existingSubjects?.map((subject) => subject.id));

  const logsToInsert = [];
  const scanItemsToUpdate = [];

  for (const item of items) {
    let subjectId = item.subjectId;

    if (subjectId && !subjectIds.has(subjectId)) {
      throw new Error("A selected subject does not belong to this cohort");
    }

    const stage = item.stage.trim();
    if (!stage) throw new Error("Every saved item needs a stage");
    const observation = assertBatchObservationContext(item.observationContext);
    if (observation.modality !== "external_photo") {
      throw new Error("Batch save supports external genital-photo observations only");
    }
    if (!Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1) {
      throw new Error("Every saved item needs a confidence between 0 and 1");
    }

    // If no explicit ID, try to find by new name or fallback to filename matching
    if (!subjectId) {
      // 1. Try explicit new name (e.g. user typed "227A" in UI)
      if (item.newSubjectName?.trim()) {
        const subjectName = item.newSubjectName.trim();
        const lowerName = subjectName.toLowerCase();
        subjectId = subjectMap.get(lowerName); // Check if exists first

        if (!subjectId) {
          // Create it - IMPORTANT: inherit org_id from cohort, not from session
          const { data: createdSubject } = await supabase
            .from("mice")
            .insert({
              user_id: userId,
              org_id: cohortOrgId, // Inherit from cohort
              cohort_id: cohortId,
              name: subjectName,
              status: "Active",
            })
            .select("id")
            .single();

          if (!createdSubject) throw new Error(`Could not create subject ${subjectName}`);
          subjectId = createdSubject.id;
          subjectMap.set(lowerName, subjectId);
          subjectIds.add(subjectId);
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
        session_id: sessionId || null, // Link to scan session for receipts
        stage,
        confidence: item.confidence,
        features: normalizeClassificationFeatures(item.features),
        image_url: item.imageUrl,
        notes: item.notes || null,
        modality: observation.modality,
        capture_date: observation.captureDate,
        label_status: "confirmed",
        confirmation_source: "scientist_batch_review",
        reviewer_id: userId,
        data: {
          ...(item.flexibleData ?? item.features ?? {}),
          model_reasoning: item.reasoning,
          observation_context: {
            modality: observation.modality,
            capture_date: observation.captureDate,
            confirmation_source: "scientist_batch_review",
            label_status: "confirmed",
          },
        },
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
    const updateResults = await Promise.all(
      scanItemsToUpdate.map((u) =>
        supabase
          .from("scan_items")
          .update({ mouse_id: u.mouse_id, status: "saved" })
          .eq("id", u.id)
      )
    );
    const updateError = updateResults.find((result) => result.error)?.error;
    if (updateError) throw updateError;
  }

  if (sessionId) {
    const { error: sessionError } = await supabase
      .from("scan_sessions")
      .update({ status: "completed" })
      .eq("id", sessionId);
    if (sessionError) throw sessionError;
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

  return Promise.all(data.map(async (log) => ({
    ...log,
    image_url: await getReadableImageUrl(log.image_url),
    subjectName: log.mice?.name || "Unknown",
  })));
}

/** A portable, provenance-first manifest for local analysis or archiving. */
export async function getCohortExportData(cohortId: string) {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!isValidUUID(cohortId)) throw new Error("A valid cohort is required");
  const token = await getToken();
  if (!token) throw new Error("No authentication token");

  const supabase = createAuthClient(token);
  const { data, error } = await supabase
    .from("estrus_logs")
    .select("id, mouse_id, stage, created_at, image_url, notes, modality, capture_date, capture_metadata, label_status, confirmation_source, reviewer_id, reference_modality, reference_image_url, reference_sample_id, data, mice!inner(name, cohort_id, coat_colour, strain)")
    .eq("mice.cohort_id", cohortId)
    .order("capture_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data.map((log) => {
    const record = isRecord(log.data) ? log.data : {};
    const capture = isRecord(log.capture_metadata) ? log.capture_metadata : {};
    const scores = isRecord(record.confidence_scores) ? record.confidence_scores : {};
    const evidence = isRecord(record.evidence) ? record.evidence : {};
    const externalBinary = isRecord(evidence.external_binary) ? evidence.external_binary : {};
    const modelInput = isRecord(record.model_input_reference) ? record.model_input_reference : {};
    const modelCrop = isRecord(modelInput.crop) ? modelInput.crop : {};
    const mouse = Array.isArray(log.mice) ? log.mice[0] : log.mice;
    return {
      log_id: log.id,
      subject_id: log.mouse_id || "",
      subject_name: mouse?.name || "Unknown",
      subject_coat_colour: mouse?.coat_colour || "",
      subject_strain: mouse?.strain || "",
      saved_stage: log.stage,
      capture_date: log.capture_date || "",
      modality: log.modality || "",
      label_status: log.label_status || "",
      confirmation_source: log.confirmation_source || "",
      reviewer_id: log.reviewer_id || "",
      capture_session: typeof capture.capture_session === "string" ? capture.capture_session : "",
      imaging_device: typeof capture.imaging_device === "string" ? capture.imaging_device : "",
      magnification: typeof capture.magnification === "string" ? capture.magnification : "",
      stain_or_preparation: typeof capture.stain_or_preparation === "string" ? capture.stain_or_preparation : "",
      image_object_reference: log.image_url || "",
      reference_modality: log.reference_modality || "",
      reference_image_object_reference: log.reference_image_url || "",
      reference_sample_id: log.reference_sample_id || "",
      model_version: typeof record.model_version === "string" ? record.model_version : "",
      suggested_stage: typeof record.suggested_stage === "string" ? record.suggested_stage : "",
      model_review_required: record.review_required === true ? "true" : record.review_required === false ? "false" : "",
      binary_model_version: typeof externalBinary.model_version === "string" ? externalBinary.model_version : "",
      binary_decision_status: typeof externalBinary.decision_status === "string" ? externalBinary.decision_status : "",
      binary_group_suggestion: typeof externalBinary.reference_backed_binary_suggestion === "string" ? externalBinary.reference_backed_binary_suggestion : "",
      binary_probability_early: typeof externalBinary.probability_proestrus_or_estrus === "number" ? externalBinary.probability_proestrus_or_estrus : "",
      prepared_roi_object_reference: typeof modelInput.image_object_reference === "string" ? modelInput.image_object_reference : "",
      prepared_roi_confirmed: modelInput.crop_confirmed === true || modelCrop.confirmed === true
        ? "true"
        : modelInput.crop_confirmed === false || modelCrop.confirmed === false
          ? "false"
          : "",
      prepared_roi_crop_json: JSON.stringify(modelCrop),
      confidence_scores_json: JSON.stringify(scores),
      notes: log.notes || "",
      created_at: log.created_at,
    };
  });
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
      "id, stage, confidence, created_at, capture_date, image_url, features, data, mice!inner(name, cohort_id)"
    )
    .eq("mice.cohort_id", cohortId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const typedLogs = (logs ?? []) as unknown as LogWithSubject[];

  if (typedLogs.length === 0) {
    return {
      totalLogs: 0,
      modelSupportedLogs: 0,
      binaryModelReviews: 0,
      binarySuggestions: 0,
      binaryAbstentions: 0,
      binaryEarlyLeads: 0,
      binaryLateLeads: 0,
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

  const recentLogs = typedLogs.slice(0, 6).map((log) => {
    const binary = getExternalBinarySummary(log);
    return {
      id: log.id,
      stage: log.stage || "Uncertain",
      confidence: extractConfidenceValue(log.confidence, log.stage),
      hasModelSupport: hasModelSupport(log),
      created_at: log.created_at,
      subjectName: log.mice?.name || "Unknown subject",
      imageUrl: log.image_url,
      binaryDecisionStatus: binary?.decision_status ?? null,
      binaryGroup: binary?.reference_backed_binary_suggestion ?? null,
    };
  });

  typedLogs.forEach((log) => {
    const stage = STAGES.includes(log.stage) ? log.stage : "Uncertain";
    const confidenceValue = extractConfidenceValue(log.confidence, log.stage);

    stageCounts.set(stage, (stageCounts.get(stage) || 0) + 1);

    if (hasModelSupport(log)) {
      const confEntry = confidenceMap.get(stage) || { sum: 0, count: 0 };
      confEntry.sum += confidenceValue;
      confEntry.count += 1;
      confidenceMap.set(stage, confEntry);
    }

    const dayKey = log.capture_date || new Date(log.created_at).toISOString().split("T")[0];
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
  const modelSupportedLogs = typedLogs.filter(hasModelSupport).length;
  const binaryReviews = typedLogs
    .map(getExternalBinarySummary)
    .filter((value): value is ExternalBinarySummary => Boolean(value));
  const binarySuggestions = binaryReviews.filter(
    (review) => review.decision_status === "reference_backed_suggestion"
  ).length;
  const binaryEarlyLeads = binaryReviews.filter(
    (review) => review.reference_backed_binary_suggestion === "PROESTRUS_OR_ESTRUS"
  ).length;
  const binaryLateLeads = binaryReviews.filter(
    (review) => review.reference_backed_binary_suggestion === "METESTRUS_OR_DIESTRUS"
  ).length;

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
    modelSupportedLogs,
    binaryModelReviews: binaryReviews.length,
    binarySuggestions,
    binaryAbstentions: binaryReviews.length - binarySuggestions,
    binaryEarlyLeads,
    binaryLateLeads,
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
  cohortProgress: {
    id: string;
    name: string;
    totalSubjects: number;
    recordedToday: number;
    remaining: number;
    dueSubjects: {
      id: string;
      name: string;
      coatColour: string | null;
      strain: string | null;
    }[];
  }[];
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
  const localDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const today = new Date();
  const todayKey = localDateKey(today);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartKey = localDateKey(weekStart);

  // Use specimen capture date for daily lab work. created_at reflects when a
  // record was entered and can move an observation into the wrong workday.
  const [subjectsResult, cohortsResult, todayLogsResult] = await Promise.all([
    supabase.from("mice").select("*", { count: "exact", head: true }).eq("status", "Active"),
    supabase.from("cohorts").select("id, name, mice(id, name, status, coat_colour, strain)"),
    supabase
      .from("estrus_logs")
      .select("cohort_id, mouse_id")
      .eq("capture_date", todayKey),
  ]);

  if (subjectsResult.error) throw subjectsResult.error;
  if (cohortsResult.error) throw cohortsResult.error;
  if (todayLogsResult.error) throw todayLogsResult.error;

  const recordedByCohort = new Map<string, Set<string>>();
  todayLogsResult.data.forEach((log) => {
    if (!log.cohort_id || !log.mouse_id) return;
    const recorded = recordedByCohort.get(log.cohort_id) ?? new Set<string>();
    recorded.add(log.mouse_id);
    recordedByCohort.set(log.cohort_id, recorded);
  });

  const cohortProgress = cohortsResult.data
    .map((cohort) => {
      const total = Array.isArray(cohort.mice)
        ? cohort.mice.filter((subject) => subject.status === "Active").length
        : 0;
      const recorded = recordedByCohort.get(cohort.id)?.size ?? 0;
      const dueSubjects = Array.isArray(cohort.mice)
        ? cohort.mice
            .filter(
              (subject) =>
                subject.status === "Active" &&
                !recordedByCohort.get(cohort.id)?.has(subject.id)
            )
            .map((subject) => ({
              id: subject.id,
              name: subject.name,
              coatColour: subject.coat_colour,
              strain: subject.strain,
            }))
            .sort((left, right) =>
              left.name.localeCompare(right.name, undefined, { numeric: true })
            )
        : [];
      return {
        id: cohort.id,
        name: cohort.name,
        totalSubjects: total,
        recordedToday: recorded,
        remaining: Math.max(0, total - recorded),
        dueSubjects,
      };
    })
    .sort((left, right) => right.remaining - left.remaining || left.name.localeCompare(right.name));

  // 3. Recent Activity (Last 10 logs across all cohorts)
  const { data: recentLogs, error: logsError } = await supabase
    .from("estrus_logs")
    .select("*, mice(name, cohort_id), cohorts(name)")
    .order("created_at", { ascending: false })
    .limit(10);

  if (logsError) throw logsError;

  // Bucket is public - just strip query params from old signed URLs
  const recentActivity = await Promise.all(recentLogs.map(async (log) => {
    const imageUrl = await getReadableImageUrl(log.image_url);

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
  }));

  // 4. Scientist-confirmed stage distribution by specimen date.
  const { data: distributionData, error: distError } = await supabase
    .from("estrus_logs")
    .select("stage")
    .gte("capture_date", weekStartKey);

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
    .select("stage, capture_date")
    .gte("capture_date", weekStartKey)
    .order("capture_date", { ascending: true });

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
    const dateStr = localDateKey(date);
    dailyMap.set(dateStr, {
      Proestrus: 0,
      Estrus: 0,
      Metestrus: 0,
      Diestrus: 0,
    });
  }

  // Fill in the data
  trendData?.forEach((log) => {
    const dateStr = log.capture_date;
    if (!dateStr) return;
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
    totalSubjects: subjectsResult.count || 0,
    todaysScans: todayLogsResult.data.length,
    cohortProgress,
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
    .select("*, experiment_cohorts(cohort_id)")
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

  const name = String(formData.get("name") || "").trim().slice(0, 160);
  const description = String(formData.get("description") || "").trim().slice(0, 1200);
  const startDate = String(formData.get("start_date") || "");
  const endDate = String(formData.get("end_date") || "");
  if (!name) throw new Error("A study name is required");
  if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("Choose a valid start date");
  if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) throw new Error("Choose a valid end date");
  if (startDate && endDate && endDate < startDate) throw new Error("The end date must be on or after the start date");

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
  observationDays: number;
  dateRange: { start: string; end: string } | null;
  confirmedLogs: number;
  uncertainLogs: number;
  missingCaptureDates: number;
  pairedCytologyLogs: number;
  binarySuggestions: number;
  binaryAbstentions: number;
  subjectsMissingMetadata: number;
  stageDistribution: { stage: string; value: number }[];
  timeline: { date: string; value: number }[];
  cohortStats: {
    id: string;
    name: string;
    subjectCount: number;
    logCount: number;
    pairedCytologyCount: number;
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
      observationDays: 0,
      dateRange: null,
      confirmedLogs: 0,
      uncertainLogs: 0,
      missingCaptureDates: 0,
      pairedCytologyLogs: 0,
      binarySuggestions: 0,
      binaryAbstentions: 0,
      subjectsMissingMetadata: 0,
      stageDistribution: [],
      timeline: [],
      cohortStats: [],
    };
  }

  // 2. Get Logs for these cohorts (via mice)
  const { data: logs, error: logsError } = await supabase
    .from("estrus_logs")
    .select("id, stage, created_at, capture_date, label_status, confirmation_source, reference_modality, data, mice!inner(id, cohort_id)")
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
  const cohortPairedCounts = new Map<string, number>();
  const captureDates: string[] = [];
  let confirmedLogs = 0;
  let missingCaptureDates = 0;
  let pairedCytologyLogs = 0;
  let binarySuggestions = 0;
  let binaryAbstentions = 0;

  logs.forEach((log) => {
    const stage = STAGES.includes(log.stage) ? log.stage : "Uncertain";
    stageCounts.set(stage, (stageCounts.get(stage) || 0) + 1);

    if (log.capture_date) {
      captureDates.push(log.capture_date);
      timelineMap.set(log.capture_date, (timelineMap.get(log.capture_date) || 0) + 1);
    } else {
      missingCaptureDates += 1;
    }

    if (log.label_status === "confirmed") confirmedLogs += 1;

    const isPairedCytology =
      log.confirmation_source === "paired_cytology_review" &&
      log.reference_modality === "vaginal_cytology";
    if (isPairedCytology) pairedCytologyLogs += 1;

    const externalBinary = getExternalBinarySummary(log);
    if (externalBinary?.decision_status === "reference_backed_suggestion") {
      binarySuggestions += 1;
    }
    if (externalBinary?.decision_status === "abstain") {
      binaryAbstentions += 1;
    }

    const mice = log.mice as { cohort_id?: string } | null;
    const cohortId = mice?.cohort_id;
    if (cohortId) {
      cohortLogCounts.set(cohortId, (cohortLogCounts.get(cohortId) || 0) + 1);
      if (isPairedCytology) {
        cohortPairedCounts.set(
          cohortId,
          (cohortPairedCounts.get(cohortId) || 0) + 1
        );
      }
    }
  });

  // Subject count per cohort
  const { data: subjectsPerCohort } = await supabase
    .from("mice")
    .select("cohort_id, coat_colour, strain")
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
      pairedCytologyCount: cohortPairedCounts.get(ec.cohort_id) || 0,
    };
  });

  const sortedCaptureDates = Array.from(new Set(captureDates)).sort();
  const subjectsMissingMetadata =
    subjectsPerCohort?.filter((subject) => !subject.coat_colour || !subject.strain)
      .length || 0;

  return {
    totalLogs: logs.length,
    totalSubjects: totalSubjects || 0,
    observationDays: sortedCaptureDates.length,
    dateRange:
      sortedCaptureDates.length > 0
        ? {
            start: sortedCaptureDates[0],
            end: sortedCaptureDates[sortedCaptureDates.length - 1],
          }
        : null,
    confirmedLogs,
    uncertainLogs: logs.length - confirmedLogs,
    missingCaptureDates,
    pairedCytologyLogs,
    binarySuggestions,
    binaryAbstentions,
    subjectsMissingMetadata,
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

  const rows = data.map((log) => {
    const mouse = log.mice as {
      cohort_id?: string;
      name?: string;
      metadata?: Record<string, unknown>;
      cohorts?: { name?: string };
    } | null;
    const cohort = mouse?.cohorts;
    const record = isRecord(log.data) ? log.data : {};
    const capture = isRecord(log.capture_metadata) ? log.capture_metadata : {};
    const scores = isRecord(record.confidence_scores)
      ? record.confidence_scores
      : {};
    const externalBinary = getExternalBinarySummary(log) || {};
    const modelInput = isRecord(record.model_input_reference)
      ? record.model_input_reference
      : {};
    const modelCrop = isRecord(modelInput.crop) ? modelInput.crop : {};

    return {
      experiment_id: experimentId,
      log_id: log.id,
      subject_id: log.mouse_id || "",
      subject_name: mouse?.name || "Unknown",
      cohort_id: mouse?.cohort_id || log.cohort_id || "",
      cohort_name: cohort?.name || "Unknown",
      saved_stage: log.stage,
      capture_date: log.capture_date || "",
      modality: log.modality || "",
      label_status: log.label_status || "",
      confirmation_source: log.confirmation_source || "",
      reviewer_id: log.reviewer_id || "",
      reference_modality: log.reference_modality || "",
      reference_image_object_reference: log.reference_image_url || "",
      reference_sample_id: log.reference_sample_id || "",
      image_object_reference: log.image_url || "",
      capture_session:
        typeof capture.capture_session === "string"
          ? capture.capture_session
          : "",
      imaging_device:
        typeof capture.imaging_device === "string" ? capture.imaging_device : "",
      model_version:
        typeof record.model_version === "string" ? record.model_version : "",
      suggested_stage:
        typeof record.suggested_stage === "string" ? record.suggested_stage : "",
      binary_model_version: externalBinary.model_version || "",
      binary_decision_status: externalBinary.decision_status || "",
      binary_group_suggestion:
        externalBinary.reference_backed_binary_suggestion || "",
      binary_probability_early:
        typeof externalBinary.probability_proestrus_or_estrus === "number"
          ? externalBinary.probability_proestrus_or_estrus
          : "",
      prepared_roi_object_reference:
        typeof modelInput.image_object_reference === "string"
          ? modelInput.image_object_reference
          : "",
      prepared_roi_confirmed:
        modelInput.crop_confirmed === true || modelCrop.confirmed === true
          ? "true"
          : modelInput.crop_confirmed === false || modelCrop.confirmed === false
            ? "false"
            : "",
      prepared_roi_crop_json: JSON.stringify(modelCrop),
      confidence_scores_json: JSON.stringify(scores),
      subject_metadata_json: JSON.stringify(mouse?.metadata || {}),
      notes: log.notes || "",
      created_at: log.created_at,
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
    .select("id, mouse_id, cohort_id, stage, created_at, capture_date, modality, label_status, confirmation_source, reference_modality, data")
    .in("cohort_id", cohortIds)
    .order("capture_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (logsError) throw logsError;

  // Structure the data
  // We want to return a list of cohorts, each with their mice, and a flat list of logs (or nested)
  // Returning flat logs is usually easier for charting libraries, but nested mice is good for layout.

  const cohorts = experimentCohorts.map((ec) => {
    // Handle both array and object responses from Supabase joins
    const rawCohorts = ec.cohorts as
      | { id: string; name: string; color: string | null }
      | { id: string; name: string; color: string | null }[]
      | null;
    const cohortData = Array.isArray(rawCohorts) ? rawCohorts[0] : rawCohorts;
    return {
      id: cohortData?.id ?? ec.cohort_id,
      name: cohortData?.name ?? "Unknown",
      color: cohortData?.color ?? "#3b82f6",
      mice:
        mice
          ?.filter((m) => m.cohort_id === ec.cohort_id)
          .map((m) => ({
            id: m.id,
            name: m.name,
          })) ?? [],
    };
  });

  return {
    cohorts,
    logs: logs.map((log) => {
      const externalBinary = getExternalBinarySummary(log);
      return {
        id: log.id,
        mouse_id: log.mouse_id,
        cohort_id: log.cohort_id,
        stage: log.stage,
        date:
          log.capture_date || new Date(log.created_at).toISOString().split("T")[0],
        capture_date: log.capture_date,
        modality: log.modality,
        label_status: log.label_status,
        confirmation_source: log.confirmation_source,
        reference_modality: log.reference_modality,
        binary_decision_status: externalBinary?.decision_status || null,
        binary_group_suggestion:
          externalBinary?.reference_backed_binary_suggestion || null,
      };
    }),
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
  type OrgResult = {
    id: string;
    clerk_org_id: string;
    department: string | null;
    institution: string | null;
    description: string | null;
    logo_url: string | null;
    member_count: number | null;
    created_at: string;
  };
  return ((data as OrgResult[] | null) || []).map((org) => ({
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

  return (data || []).map((req) => ({
    id: req.id,
    user_id: req.user_id,
    user_email: req.user_email,
    user_name: req.user_name,
    message: req.message,
    role: req.role,
    status: req.status,
    created_at: req.created_at,
    organization: (req.organization_profiles as {
      id: string;
      clerk_org_id: string;
      department: string | null;
      institution: string | null;
      logo_url: string | null;
    } | null)
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

  type ReqResult = {
    id: string;
    user_id: string;
    user_email: string;
    user_name: string | null;
    message: string | null;
    role: string;
    created_at: string;
  };
  return ((data as ReqResult[] | null) || []).map((req) => ({
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

  const updateData: Record<string, string | boolean | number | null> = {
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
