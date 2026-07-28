import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { normalizeClassificationFeatures, normalizeConfidenceScores } from '@/lib/classification';
import {
  binaryGroupForStage,
  requestExternalBinarySuggestion,
} from '@/lib/server/external-binary';

// Define the schema for the classification result
const ImageClassificationSchema = z.object({
  estrus_stage: z.enum(['Proestrus', 'Estrus', 'Metestrus', 'Diestrus']),
  confidence_scores: z.object({
    Proestrus: z.number(),
    Estrus: z.number(),
    Metestrus: z.number(),
    Diestrus: z.number(),
  }),
  features: z.object({
    vaginal_opening: z.string(),
    tissue_color: z.string(),
    swelling: z.string(),
    moisture: z.string(),
  }),
  reasoning: z.string(),
});

const SYSTEM_PROMPT = `
You are an expert in mouse reproductive biology. Your task is to analyze images of mouse external genitalia and classify the estrus stage.

The four stages are:
1. Proestrus: Vaginal opening begins to open, tissue becomes pink and moist, swelling increases.
2. Estrus: Vaginal opening is fully open, tissue is bright pink/red, swollen, and moist.
3. Metestrus: Vaginal opening is partially closed, swelling decreases, tissue becomes pale, discharge may be present.
4. Diestrus: Vaginal opening is small/closed, tissue is pale and dry, no swelling.

Analyze the image for:
- Vaginal Opening state
- Tissue Color
- Swelling
- Moisture/Discharge

Provide confidence scores for each stage (must sum to 1.0) and a detailed reasoning for your classification.
`;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response("Authentication is required to analyze an image", { status: 401 });
    }
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const modality = formData.get('modality') || 'external_photo';
    const roiConfirmed = formData.get('roi_confirmed') === 'true';
    
    if (!file) {
      return new Response("No file provided", { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return new Response("Please upload an image file", { status: 400 });
    }
    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      return new Response("Image must be between 1 byte and 10 MB", { status: 400 });
    }
    if (modality !== 'external_photo') {
      return new Response(
        "No classifier is configured for vaginal cytology. Record a scientist-reviewed stage instead.",
        { status: 400 }
      );
    }

    // Convert the file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');
    const externalBinaryPromise = requestExternalBinarySuggestion(file, roiConfirmed);

    const { object: result } = await generateObject({
      // Keep the deployed model configurable. Different institutions may need
      // to evaluate a model in a controlled validation run before switching it.
      model: google(process.env.GOOGLE_GENERATIVE_AI_MODEL || 'gemini-3-pro'),
      schema: ImageClassificationSchema,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this image and classify the estrus stage.' },
            { type: 'image', image: base64Image }
          ]
        }
      ]
    });

    const confidenceScores = normalizeConfidenceScores(result.confidence_scores);
    const rankedStages = Object.entries(confidenceScores).sort(
      ([, left], [, right]) => right - left
    );
    const topScore = rankedStages[0]?.[1] ?? 0;
    const margin = topScore - (rankedStages[1]?.[1] ?? 0);
    const reviewReasons: string[] = [
      "Human confirmation is required: this visual model has not been calibrated to this colony and imaging protocol.",
    ];
    if (topScore < 0.55) reviewReasons.push("The model did not strongly favor one stage.");
    if (margin < 0.15) reviewReasons.push("The two leading stages were too close to distinguish reliably.");

    const canonicalFeatures = normalizeClassificationFeatures(result.features);
    const externalBinary = await externalBinaryPromise;
    const externalBinaryAgrees = externalBinary?.reference_backed_binary_suggestion
      ? externalBinary.reference_backed_binary_suggestion === binaryGroupForStage(result.estrus_stage)
      : undefined;
    if (externalBinaryAgrees === false) {
      reviewReasons.push(
        "The public binary ensemble and four-stage visual suggestion disagree."
      );
    }
    if (externalBinary?.reference_domain.out_of_reference) {
      reviewReasons.push(
        "The image falls outside the public model's training-reference range."
      );
    }
    if (externalBinary?.acquisition_domain.out_of_range) {
      reviewReasons.push(
        "The image colour or exposure falls outside the public model's acquisition range."
      );
    }
    if (externalBinary && !externalBinary.synthetic_dark_coat.agrees_with_clean) {
      reviewReasons.push(
        "The public binary suggestion changes under the synthetic dark-coat check."
      );
    }
    return Response.json({
      ...result,
      confidence_scores: confidenceScores,
      // Include legacy aliases for the existing single-entry form while new
      // saved data uses the shared opening/color/moistness vocabulary.
      features: {
        ...canonicalFeatures,
        vaginal_opening: canonicalFeatures.opening,
        tissue_color: canonicalFeatures.color,
        moisture: canonicalFeatures.moistness,
      },
      review_required: reviewReasons.length > 0,
      review_reasons: reviewReasons,
      evidence: {
        method: externalBinary
          ? 'Gemini four-stage visual assessment with S-BIAD2395 binary ensemble cross-check'
          : 'Gemini visual assessment of external genital photo',
        external_binary: externalBinary,
        external_binary_agrees_with_stage_group: externalBinaryAgrees,
        roi_confirmed: roiConfirmed,
      },
      model_version: process.env.GOOGLE_GENERATIVE_AI_MODEL || 'gemini-3-pro',
    });

  } catch (error) {
    console.error('Error in classifyImage:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
