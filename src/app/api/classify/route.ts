import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest } from 'next/server';

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
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response("No file provided", { status: 400 });
    }

    // Convert the file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    const { object: result } = await generateObject({
      model: google('gemini-2.0-flash-001', {
        structuredOutputs: true,
      }),
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

    return Response.json(result);

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
