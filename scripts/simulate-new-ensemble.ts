/**
 * Simulate what the NEW smart ensemble would have predicted
 * on the existing data to estimate accuracy improvement.
 * 
 * Run with: npx tsx scripts/simulate-new-ensemble.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Stage = "Proestrus" | "Estrus" | "Metestrus" | "Diestrus";
const STAGES: Stage[] = ["Proestrus", "Estrus", "Metestrus", "Diestrus"];

// Extract ground truth from filename
function extractGroundTruth(imageUrl: string): Stage | null {
  const filename = imageUrl.split("/").pop()?.toUpperCase() || "";
  
  if (filename.includes("PROESTRUS")) return "Proestrus";
  if (filename.includes("ESTRUS") && !filename.includes("PROESTRUS") && !filename.includes("METESTRUS") && !filename.includes("DIESTRUS")) return "Estrus";
  if (filename.includes("METESTRUS")) return "Metestrus";
  if (filename.includes("DIESTRUS")) return "Diestrus";
  
  return null;
}

// Parse reasoning to extract individual model predictions and scores
function parseReasoning(reasoning: string | null | undefined): {
  knnPrediction: Stage | null;
  knnScores: Record<Stage, number> | null;
  geminiPrediction: Stage | null;
  geminiConfidence: number | null;
} {
  if (!reasoning) return { knnPrediction: null, knnScores: null, geminiPrediction: null, geminiConfidence: null };
  
  let knnPrediction: Stage | null = null;
  let knnScores: Record<Stage, number> | null = null;
  let geminiPrediction: Stage | null = null;
  let geminiConfidence: number | null = null;
  
  // Pattern: "k-NN predicted Proestrus"
  const knnMatch = reasoning.match(/k-NN predicted (\w+)/i);
  if (knnMatch) {
    const stage = knnMatch[1];
    if (STAGES.includes(stage as Stage)) {
      knnPrediction = stage as Stage;
    }
  }
  
  // Pattern: "Gemini predicted Estrus (86% confident)"
  const geminiMatch = reasoning.match(/Gemini predicted (\w+) \((\d+)% confident\)/i);
  if (geminiMatch) {
    const stage = geminiMatch[1];
    if (STAGES.includes(stage as Stage)) {
      geminiPrediction = stage as Stage;
      geminiConfidence = parseInt(geminiMatch[2]) / 100;
    }
  }
  
  return { knnPrediction, knnScores, geminiPrediction, geminiConfidence };
}

// Pair overrides mirroring src/trigger/scan-tasks.ts (only using support >= 3)
const PAIR_OVERRIDES: Partial<
  Record<
    Stage,
    Partial<Record<Stage, { stage: Stage; support: number }>>
  >
> = {
  Proestrus: {
    Diestrus: { stage: "Metestrus", support: 3 },
  },
  Estrus: {
    Proestrus: { stage: "Metestrus", support: 3 },
    Estrus: { stage: "Proestrus", support: 7 },
    Diestrus: { stage: "Estrus", support: 35 },
  },
  Metestrus: {
    Diestrus: { stage: "Proestrus", support: 3 },
  },
};

// NEW Smart ensemble logic (mirrors src/trigger/scan-tasks.ts but without raw k-NN scores)
function smartEnsemble(
  knnPrediction: Stage,
  geminiPrediction: Stage,
  geminiConfidence: number
): { prediction: Stage; method: string } {
  const pairOverride = PAIR_OVERRIDES[knnPrediction]?.[geminiPrediction];
  if (pairOverride && pairOverride.support >= 3) {
    return {
      prediction: pairOverride.stage,
      method: `Pair override (${knnPrediction}+${geminiPrediction})`,
    };
  }

  if (knnPrediction === geminiPrediction) {
    return { prediction: knnPrediction, method: "Agreement" };
  }

  if (geminiPrediction === "Diestrus" && geminiConfidence >= 0.85) {
    return { prediction: "Diestrus", method: "Gemini Diestrus override" };
  }

  if (knnPrediction === "Estrus" && geminiPrediction !== "Diestrus") {
    return { prediction: "Estrus", method: "k-NN Estrus guard" };
  }

  if (knnPrediction === "Proestrus" || knnPrediction === "Metestrus") {
    return { prediction: knnPrediction, method: `k-NN ${knnPrediction}` };
  }

  return { prediction: knnPrediction, method: "Fallback k-NN" };
}

// OLD ensemble logic (40% k-NN, 60% Gemini)
function oldEnsemble(
  knnPrediction: Stage,
  geminiPrediction: Stage,
  geminiConfidence: number
): Stage {
  // With 60% Gemini weight, Gemini usually wins unless k-NN is very strong
  // This is a simplification - the actual old logic used score combination
  // But effectively, Gemini dominated
  if (geminiConfidence > 0.5) {
    return geminiPrediction;
  }
  return knnPrediction;
}

async function simulateNewEnsemble() {
  console.log("🔍 Fetching logs to simulate new ensemble...\n");
  
  const { data: logs, error } = await supabase
    .from("estrus_logs")
    .select("id, stage, image_url, notes, data")
    .order("created_at", { ascending: false })
    .limit(500);
  
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  // Filter to logs with ground truth AND both model predictions
  const validLogs = (logs || []).filter(log => {
    const gt = extractGroundTruth(log.image_url);
    const reasoning = log.notes || (log.data as any)?.reasoning;
    const { knnPrediction, geminiPrediction } = parseReasoning(reasoning);
    return gt && knnPrediction && geminiPrediction;
  });
  
  console.log(`📊 Found ${validLogs.length} logs with ground truth and both model predictions\n`);
  
  const results = {
    oldEnsemble: { correct: 0, total: 0 },
    newEnsemble: { correct: 0, total: 0 },
    knnOnly: { correct: 0, total: 0 },
    geminiOnly: { correct: 0, total: 0 },
    methodBreakdown: {} as Record<string, { total: number; correct: number }>,
    improvements: [] as string[],
    regressions: [] as string[],
  };
  
  for (const log of validLogs) {
    const groundTruth = extractGroundTruth(log.image_url)!;
    const actualPrediction = log.stage as Stage;
    const reasoning = log.notes || (log.data as any)?.reasoning;
    const { knnPrediction, geminiPrediction, geminiConfidence } = parseReasoning(reasoning);
    
    if (!knnPrediction || !geminiPrediction || !geminiConfidence) continue;
    
    results.oldEnsemble.total++;
    results.newEnsemble.total++;
    results.knnOnly.total++;
    results.geminiOnly.total++;
    
    // Old ensemble (what actually happened)
    const oldCorrect = actualPrediction === groundTruth;
    if (oldCorrect) results.oldEnsemble.correct++;
    
    // k-NN only
    if (knnPrediction === groundTruth) results.knnOnly.correct++;
    
    // Gemini only
    if (geminiPrediction === groundTruth) results.geminiOnly.correct++;
    
    // NEW ensemble simulation
    const { prediction: newPrediction, method } = smartEnsemble(
      knnPrediction,
      geminiPrediction,
      geminiConfidence
    );
    
    const newCorrect = newPrediction === groundTruth;
    if (newCorrect) results.newEnsemble.correct++;
    
    // Track method breakdown
    if (!results.methodBreakdown[method]) {
      results.methodBreakdown[method] = { total: 0, correct: 0 };
    }
    results.methodBreakdown[method].total++;
    if (newCorrect) results.methodBreakdown[method].correct++;
    
    // Track improvements and regressions
    const filename = log.image_url.split("/").pop() || "";
    if (!oldCorrect && newCorrect) {
      results.improvements.push(`✅ ${filename}: ${actualPrediction} → ${newPrediction} (GT: ${groundTruth})`);
    } else if (oldCorrect && !newCorrect) {
      results.regressions.push(`❌ ${filename}: ${actualPrediction} → ${newPrediction} (GT: ${groundTruth})`);
    }
  }
  
  // Print results
  console.log("=" .repeat(60));
  console.log("📈 ACCURACY COMPARISON");
  console.log("=" .repeat(60));
  console.log(`Old Ensemble (40/60): ${results.oldEnsemble.correct}/${results.oldEnsemble.total} = ${(results.oldEnsemble.correct / results.oldEnsemble.total * 100).toFixed(1)}%`);
  console.log(`NEW Smart Ensemble:   ${results.newEnsemble.correct}/${results.newEnsemble.total} = ${(results.newEnsemble.correct / results.newEnsemble.total * 100).toFixed(1)}%`);
  console.log(`k-NN only:            ${results.knnOnly.correct}/${results.knnOnly.total} = ${(results.knnOnly.correct / results.knnOnly.total * 100).toFixed(1)}%`);
  console.log(`Gemini only:          ${results.geminiOnly.correct}/${results.geminiOnly.total} = ${(results.geminiOnly.correct / results.geminiOnly.total * 100).toFixed(1)}%`);
  
  const improvement = results.newEnsemble.correct - results.oldEnsemble.correct;
  const improvementPct = ((results.newEnsemble.correct / results.newEnsemble.total) - (results.oldEnsemble.correct / results.oldEnsemble.total)) * 100;
  console.log(`\n🎯 Net improvement: ${improvement > 0 ? '+' : ''}${improvement} predictions (${improvementPct > 0 ? '+' : ''}${improvementPct.toFixed(1)}%)`);
  
  console.log("\n" + "=" .repeat(60));
  console.log("📊 METHOD BREAKDOWN (New Ensemble)");
  console.log("=" .repeat(60));
  Object.entries(results.methodBreakdown)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([method, stats]) => {
      const acc = (stats.correct / stats.total * 100).toFixed(1);
      console.log(`${method.padEnd(35)} ${stats.correct}/${stats.total} = ${acc}%`);
    });
  
  if (results.improvements.length > 0) {
    console.log("\n" + "=" .repeat(60));
    console.log(`✅ IMPROVEMENTS (${results.improvements.length} predictions fixed)`);
    console.log("=" .repeat(60));
    results.improvements.slice(0, 10).forEach(s => console.log(s));
    if (results.improvements.length > 10) {
      console.log(`... and ${results.improvements.length - 10} more`);
    }
  }
  
  if (results.regressions.length > 0) {
    console.log("\n" + "=" .repeat(60));
    console.log(`❌ REGRESSIONS (${results.regressions.length} predictions broken)`);
    console.log("=" .repeat(60));
    results.regressions.slice(0, 10).forEach(s => console.log(s));
    if (results.regressions.length > 10) {
      console.log(`... and ${results.regressions.length - 10} more`);
    }
  }
}

simulateNewEnsemble().catch(console.error);

