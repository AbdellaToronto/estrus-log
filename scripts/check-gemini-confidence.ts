/**
 * Check Gemini confidence distribution
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Stage = "Proestrus" | "Estrus" | "Metestrus" | "Diestrus";

function extractGroundTruth(imageUrl: string): Stage | null {
  const filename = imageUrl.split("/").pop()?.toUpperCase() || "";
  if (filename.includes("PROESTRUS")) return "Proestrus";
  if (filename.includes("ESTRUS") && !filename.includes("PROESTRUS") && !filename.includes("METESTRUS") && !filename.includes("DIESTRUS")) return "Estrus";
  if (filename.includes("METESTRUS")) return "Metestrus";
  if (filename.includes("DIESTRUS")) return "Diestrus";
  return null;
}

function parseReasoning(reasoning: string | null | undefined) {
  if (!reasoning) return { knnPrediction: null, geminiPrediction: null, geminiConfidence: null };
  
  const knnMatch = reasoning.match(/k-NN predicted (\w+)/i);
  const geminiMatch = reasoning.match(/Gemini predicted (\w+) \((\d+)% confident\)/i);
  
  return {
    knnPrediction: knnMatch?.[1] as Stage | null,
    geminiPrediction: geminiMatch?.[1] as Stage | null,
    geminiConfidence: geminiMatch ? parseInt(geminiMatch[2]) / 100 : null,
  };
}

async function main() {
  const { data: logs } = await supabase
    .from("estrus_logs")
    .select("id, stage, image_url, notes, data")
    .limit(500);
  
  const byGeminiPrediction: Record<string, { confidences: number[], correctCount: number, total: number }> = {};
  
  for (const log of logs || []) {
    const gt = extractGroundTruth(log.image_url);
    if (!gt) continue;
    
    const reasoning = log.notes || (log.data as any)?.reasoning;
    const { geminiPrediction, geminiConfidence } = parseReasoning(reasoning);
    
    if (!geminiPrediction || !geminiConfidence) continue;
    
    if (!byGeminiPrediction[geminiPrediction]) {
      byGeminiPrediction[geminiPrediction] = { confidences: [], correctCount: 0, total: 0 };
    }
    
    byGeminiPrediction[geminiPrediction].confidences.push(geminiConfidence);
    byGeminiPrediction[geminiPrediction].total++;
    if (geminiPrediction === gt) {
      byGeminiPrediction[geminiPrediction].correctCount++;
    }
  }
  
  console.log("Gemini Confidence by Prediction:\n");
  for (const [pred, data] of Object.entries(byGeminiPrediction)) {
    const avg = data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length;
    const min = Math.min(...data.confidences);
    const max = Math.max(...data.confidences);
    const acc = (data.correctCount / data.total * 100).toFixed(1);
    console.log(`${pred}:`);
    console.log(`  Count: ${data.total}`);
    console.log(`  Confidence: min=${(min*100).toFixed(0)}%, avg=${(avg*100).toFixed(0)}%, max=${(max*100).toFixed(0)}%`);
    console.log(`  Accuracy: ${data.correctCount}/${data.total} = ${acc}%`);
    console.log();
  }
}

main().catch(console.error);

