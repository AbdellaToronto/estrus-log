import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

// Schema for the classification result
const ClassificationSchema = z.object({
  stage: z.enum(['Proestrus', 'Estrus', 'Metestrus', 'Diestrus', 'Uncertain']),
  confidence: z.number().min(0).max(1).describe("Confidence score between 0 and 1"),
  features: z.object({
    swelling: z.enum(['None', 'Mild', 'Moderate', 'Severe']).describe("Degree of swelling of the vaginal opening"),
    color: z.enum(['Pale', 'Pink', 'Red', 'Dark Red', 'Purple']).describe("Color of the tissue"),
    opening: z.enum(['Closed', 'Open', 'Wide Open']).describe("State of the vaginal opening"),
    moistness: z.enum(['Dry', 'Moist', 'Wet']).describe("Apparent moistness or discharge")
  }),
  reasoning: z.string().describe("Concise explanation of the classification based on visual evidence")
});

export async function POST(req: Request) {
  try {
    const { image } = await req.json(); // Expecting base64 data URI

    if (!image) {
      return new Response('Missing image data', { status: 400 });
    }

    // Gemini 3 Pro preview delivers improved reasoning + multimodal accuracy.
    // Ref: https://ai-sdk.dev/cookbook/guides/gemini#gemini-3
    const result = await generateObject({
      model: google('gemini-3-pro-preview'),
      schema: ClassificationSchema,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'You are an expert rodent estrus cycle classifier. Analyze this image of a mouse and determine the estrus stage. Be precise about visual features like swelling, color, and the opening state.' },
            { type: 'image', image }
          ]
        }
      ]
    });

    return Response.json(result.object);
  } catch (error) {
    console.error('Classification error:', error);
    return new Response('Failed to classify image', { status: 500 });
  }
}
