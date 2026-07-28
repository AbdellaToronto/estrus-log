import "server-only";

import { z } from "zod";
import type { ClassificationStage } from "@/lib/classification";

const BinaryLabelSchema = z.enum([
  "PROESTRUS_OR_ESTRUS",
  "METESTRUS_OR_DIESTRUS",
]);

export const ExternalBinarySuggestionSchema = z.object({
  task: z.literal("external_photo_binary_estrus_group"),
  binary_suggestion: BinaryLabelSchema,
  reference_backed_binary_suggestion: BinaryLabelSchema.nullable(),
  decision_status: z.enum(["reference_backed_suggestion", "abstain"]),
  abstention_reasons: z.array(z.string()),
  probability_proestrus_or_estrus: z.number().min(0).max(1),
  threshold: z.number().min(0).max(1),
  synthetic_dark_coat: z.object({
    binary_suggestion: BinaryLabelSchema,
    probability_proestrus_or_estrus: z.number().min(0).max(1),
    agrees_with_clean: z.boolean(),
    absolute_probability_shift: z.number().nonnegative(),
  }).passthrough(),
  reference_domain: z.object({
    out_of_reference: z.boolean(),
  }).passthrough(),
  acquisition_domain: z.object({
    out_of_range: z.boolean(),
    outlier_metrics: z.array(z.string()),
    severe_outlier_metrics: z.array(z.string()),
    metrics: z.record(z.string(), z.number()),
  }).passthrough(),
  review_required: z.literal(true),
  review_reasons: z.array(z.string()),
  model_version: z.string(),
}).passthrough();

export type ExternalBinarySuggestion = z.infer<typeof ExternalBinarySuggestionSchema>;

export function binaryGroupForStage(
  stage: ClassificationStage
): ExternalBinarySuggestion["binary_suggestion"] {
  return stage === "Proestrus" || stage === "Estrus"
    ? "PROESTRUS_OR_ESTRUS"
    : "METESTRUS_OR_DIESTRUS";
}

/**
 * The public model is optional corroborating evidence. An unavailable research
 * service must never make the primary review flow fail.
 */
export async function requestExternalBinarySuggestion(
  file: File,
  roiConfirmed: boolean
): Promise<ExternalBinarySuggestion | undefined> {
  const baseUrl = process.env.ESTRUS_BINARY_MODEL_API_URL?.trim();
  if (!baseUrl || !roiConfirmed) return undefined;

  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("modality", "external_photo");
  formData.append("roi_confirmed", "true");

  const token = process.env.ESTRUS_BINARY_API_TOKEN?.trim();
  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/classify-external-binary`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
        signal: AbortSignal.timeout(45_000),
        cache: "no-store",
      }
    );
    if (!response.ok) {
      console.warn("External binary research model declined the image", response.status);
      return undefined;
    }
    const parsed = ExternalBinarySuggestionSchema.safeParse(await response.json());
    if (!parsed.success) {
      console.warn("External binary research model returned an invalid payload");
      return undefined;
    }
    return parsed.data;
  } catch (error) {
    console.warn("External binary research model unavailable", error);
    return undefined;
  }
}
