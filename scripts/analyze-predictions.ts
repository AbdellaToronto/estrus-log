/**
 * Analyze prediction accuracy: k-NN vs Gemini vs Ensemble
 * 
 * Run with: npx tsx scripts/analyze-predictions.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Need service role to bypass RLS
);

type Stage = "Proestrus" | "Estrus" | "Metestrus" | "Diestrus";

interface LogData {
  id: string;
  stage: string;
  image_url: string;
  notes: string | null; // Contains reasoning with k-NN and Gemini info
  data: {
    confidence_scores?: Record<string, number>;
    features?: Record<string, string>;
    reasoning?: string;
  } | null;
}

// Extract ground truth from filename
function extractGroundTruth(imageUrl: string): Stage | null {
  const filename = imageUrl.split("/").pop()?.toUpperCase() || "";
  
  if (filename.includes("PROESTRUS")) return "Proestrus";
  if (filename.includes("ESTRUS") && !filename.includes("PROESTRUS") && !filename.includes("METESTRUS") && !filename.includes("DIESTRUS")) return "Estrus";
  if (filename.includes("METESTRUS")) return "Metestrus";
  if (filename.includes("DIESTRUS")) return "Diestrus";
  
  return null;
}

// Parse reasoning to extract individual model predictions
function parseReasoning(reasoning: string | null | undefined): {
  knnPrediction: Stage | null;
  geminiPrediction: Stage | null;
  geminiConfidence: number | null;
} {
  if (!reasoning) return { knnPrediction: null, geminiPrediction: null, geminiConfidence: null };
  
  let knnPrediction: Stage | null = null;
  let geminiPrediction: Stage | null = null;
  let geminiConfidence: number | null = null;
  
  // Pattern: "k-NN predicted Proestrus"
  const knnMatch = reasoning.match(/k-NN predicted (\w+)/i);
  if (knnMatch) {
    const stage = knnMatch[1];
    if (["Proestrus", "Estrus", "Metestrus", "Diestrus"].includes(stage)) {
      knnPrediction = stage as Stage;
    }
  }
  
  // Pattern: "Gemini predicted Estrus (86% confident)"
  const geminiMatch = reasoning.match(/Gemini predicted (\w+) \((\d+)% confident\)/i);
  if (geminiMatch) {
    const stage = geminiMatch[1];
    if (["Proestrus", "Estrus", "Metestrus", "Diestrus"].includes(stage)) {
      geminiPrediction = stage as Stage;
      geminiConfidence = parseInt(geminiMatch[2]) / 100;
    }
  }
  
  return { knnPrediction, geminiPrediction, geminiConfidence };
}

async function analyzePredictions() {
  console.log("🔍 Fetching logs with ground truth labels...\n");
  
  // Fetch all logs
  const { data: logs, error } = await supabase
    .from("estrus_logs")
    .select("id, stage, image_url, notes, data")
    .order("created_at", { ascending: false })
    .limit(500);
  
  if (error) {
    console.error("Error fetching logs:", error);
    return;
  }
  
  console.log(`📊 Found ${logs?.length || 0} total logs\n`);
  
  // Filter to logs with ground truth
  const logsWithGroundTruth = (logs || []).filter(log => {
    const gt = extractGroundTruth(log.image_url);
    return gt !== null;
  });
  
  console.log(`✅ ${logsWithGroundTruth.length} logs have ground truth labels in filename\n`);
  
  // Analyze each prediction
  const results = {
    total: 0,
    ensemble: { correct: 0, total: 0 },
    knn: { correct: 0, total: 0 },
    gemini: { correct: 0, total: 0 },
    byStage: {} as Record<Stage, { gt: number; ensembleCorrect: number; knnCorrect: number; geminiCorrect: number }>,
    confusionMatrix: {
      ensemble: {} as Record<string, Record<string, number>>,
      knn: {} as Record<string, Record<string, number>>,
      gemini: {} as Record<string, Record<string, number>>,
    },
    geminiConfidenceWhenCorrect: [] as number[],
    geminiConfidenceWhenWrong: [] as number[],
    knnAgreesWithGemini: 0,
    knnDisagreesWithGemini: 0,
    whenDisagree: {
      knnCorrect: 0,
      geminiCorrect: 0,
      bothWrong: 0,
    },
  };
  
  // Initialize stages
  const stages: Stage[] = ["Proestrus", "Estrus", "Metestrus", "Diestrus"];
  stages.forEach(s => {
    results.byStage[s] = { gt: 0, ensembleCorrect: 0, knnCorrect: 0, geminiCorrect: 0 };
    results.confusionMatrix.ensemble[s] = {};
    results.confusionMatrix.knn[s] = {};
    results.confusionMatrix.gemini[s] = {};
    stages.forEach(s2 => {
      results.confusionMatrix.ensemble[s][s2] = 0;
      results.confusionMatrix.knn[s][s2] = 0;
      results.confusionMatrix.gemini[s][s2] = 0;
    });
  });
  
  for (const log of logsWithGroundTruth) {
    const groundTruth = extractGroundTruth(log.image_url)!;
    const ensemblePrediction = log.stage as Stage;
    const reasoning = log.notes || (log.data as any)?.reasoning;
    const { knnPrediction, geminiPrediction, geminiConfidence } = parseReasoning(reasoning);
    
    results.total++;
    results.byStage[groundTruth].gt++;
    
    // Ensemble accuracy
    results.ensemble.total++;
    if (ensemblePrediction === groundTruth) {
      results.ensemble.correct++;
      results.byStage[groundTruth].ensembleCorrect++;
    }
    results.confusionMatrix.ensemble[groundTruth][ensemblePrediction] = 
      (results.confusionMatrix.ensemble[groundTruth][ensemblePrediction] || 0) + 1;
    
    // k-NN accuracy
    if (knnPrediction) {
      results.knn.total++;
      if (knnPrediction === groundTruth) {
        results.knn.correct++;
        results.byStage[groundTruth].knnCorrect++;
      }
      results.confusionMatrix.knn[groundTruth][knnPrediction] = 
        (results.confusionMatrix.knn[groundTruth][knnPrediction] || 0) + 1;
    }
    
    // Gemini accuracy
    if (geminiPrediction) {
      results.gemini.total++;
      if (geminiPrediction === groundTruth) {
        results.gemini.correct++;
        results.byStage[groundTruth].geminiCorrect++;
        if (geminiConfidence) results.geminiConfidenceWhenCorrect.push(geminiConfidence);
      } else {
        if (geminiConfidence) results.geminiConfidenceWhenWrong.push(geminiConfidence);
      }
      results.confusionMatrix.gemini[groundTruth][geminiPrediction] = 
        (results.confusionMatrix.gemini[groundTruth][geminiPrediction] || 0) + 1;
    }
    
    // Agreement analysis
    if (knnPrediction && geminiPrediction) {
      if (knnPrediction === geminiPrediction) {
        results.knnAgreesWithGemini++;
      } else {
        results.knnDisagreesWithGemini++;
        if (knnPrediction === groundTruth) {
          results.whenDisagree.knnCorrect++;
        } else if (geminiPrediction === groundTruth) {
          results.whenDisagree.geminiCorrect++;
        } else {
          results.whenDisagree.bothWrong++;
        }
      }
    }
  }
  
  // Print results
  console.log("=" .repeat(60));
  console.log("📈 OVERALL ACCURACY");
  console.log("=" .repeat(60));
  console.log(`Ensemble:  ${results.ensemble.correct}/${results.ensemble.total} = ${(results.ensemble.correct / results.ensemble.total * 100).toFixed(1)}%`);
  console.log(`k-NN only: ${results.knn.correct}/${results.knn.total} = ${(results.knn.correct / results.knn.total * 100).toFixed(1)}%`);
  console.log(`Gemini:    ${results.gemini.correct}/${results.gemini.total} = ${(results.gemini.correct / results.gemini.total * 100).toFixed(1)}%`);
  
  console.log("\n" + "=" .repeat(60));
  console.log("📊 ACCURACY BY STAGE");
  console.log("=" .repeat(60));
  stages.forEach(stage => {
    const s = results.byStage[stage];
    if (s.gt > 0) {
      console.log(`\n${stage} (n=${s.gt}):`);
      console.log(`  Ensemble: ${s.ensembleCorrect}/${s.gt} = ${(s.ensembleCorrect / s.gt * 100).toFixed(1)}%`);
      console.log(`  k-NN:     ${s.knnCorrect}/${s.gt} = ${(s.knnCorrect / s.gt * 100).toFixed(1)}%`);
      console.log(`  Gemini:   ${s.geminiCorrect}/${s.gt} = ${(s.geminiCorrect / s.gt * 100).toFixed(1)}%`);
    }
  });
  
  console.log("\n" + "=" .repeat(60));
  console.log("🤝 MODEL AGREEMENT ANALYSIS");
  console.log("=" .repeat(60));
  const totalComparable = results.knnAgreesWithGemini + results.knnDisagreesWithGemini;
  console.log(`Models agree: ${results.knnAgreesWithGemini}/${totalComparable} = ${(results.knnAgreesWithGemini / totalComparable * 100).toFixed(1)}%`);
  console.log(`Models disagree: ${results.knnDisagreesWithGemini}/${totalComparable} = ${(results.knnDisagreesWithGemini / totalComparable * 100).toFixed(1)}%`);
  
  if (results.knnDisagreesWithGemini > 0) {
    console.log(`\nWhen models DISAGREE (n=${results.knnDisagreesWithGemini}):`);
    console.log(`  k-NN correct:   ${results.whenDisagree.knnCorrect} (${(results.whenDisagree.knnCorrect / results.knnDisagreesWithGemini * 100).toFixed(1)}%)`);
    console.log(`  Gemini correct: ${results.whenDisagree.geminiCorrect} (${(results.whenDisagree.geminiCorrect / results.knnDisagreesWithGemini * 100).toFixed(1)}%)`);
    console.log(`  Both wrong:     ${results.whenDisagree.bothWrong} (${(results.whenDisagree.bothWrong / results.knnDisagreesWithGemini * 100).toFixed(1)}%)`);
  }
  
  console.log("\n" + "=" .repeat(60));
  console.log("🎯 GEMINI CONFIDENCE ANALYSIS");
  console.log("=" .repeat(60));
  if (results.geminiConfidenceWhenCorrect.length > 0) {
    const avgCorrect = results.geminiConfidenceWhenCorrect.reduce((a, b) => a + b, 0) / results.geminiConfidenceWhenCorrect.length;
    console.log(`Avg confidence when CORRECT: ${(avgCorrect * 100).toFixed(1)}% (n=${results.geminiConfidenceWhenCorrect.length})`);
  }
  if (results.geminiConfidenceWhenWrong.length > 0) {
    const avgWrong = results.geminiConfidenceWhenWrong.reduce((a, b) => a + b, 0) / results.geminiConfidenceWhenWrong.length;
    console.log(`Avg confidence when WRONG:   ${(avgWrong * 100).toFixed(1)}% (n=${results.geminiConfidenceWhenWrong.length})`);
  }
  
  console.log("\n" + "=" .repeat(60));
  console.log("🔀 CONFUSION MATRIX (Ensemble)");
  console.log("=" .repeat(60));
  console.log("\nRows = Ground Truth, Columns = Prediction");
  console.log("         Pro   Est   Met   Die");
  stages.forEach(gt => {
    const row = stages.map(pred => 
      String(results.confusionMatrix.ensemble[gt][pred] || 0).padStart(5)
    ).join(" ");
    console.log(`${gt.substring(0, 3).padEnd(8)} ${row}`);
  });
  
  console.log("\n" + "=" .repeat(60));
  console.log("💡 RECOMMENDATIONS");
  console.log("=" .repeat(60));
  
  // Determine which model is better
  const knnAcc = results.knn.correct / results.knn.total;
  const geminiAcc = results.gemini.correct / results.gemini.total;
  const ensembleAcc = results.ensemble.correct / results.ensemble.total;
  
  if (knnAcc > geminiAcc && knnAcc > ensembleAcc) {
    console.log("📌 k-NN alone is outperforming! Consider:");
    console.log("   - Reducing Gemini weight or removing it");
    console.log("   - Using Gemini only for low-confidence k-NN predictions");
  } else if (geminiAcc > knnAcc && geminiAcc > ensembleAcc) {
    console.log("📌 Gemini alone is outperforming! Consider:");
    console.log("   - Increasing Gemini weight");
    console.log("   - Using k-NN only as a tiebreaker");
  } else if (ensembleAcc >= knnAcc && ensembleAcc >= geminiAcc) {
    console.log("✅ Ensemble is working well!");
    
    if (results.knnDisagreesWithGemini > 0) {
      const geminiWinsWhenDisagree = results.whenDisagree.geminiCorrect / results.knnDisagreesWithGemini;
      const knnWinsWhenDisagree = results.whenDisagree.knnCorrect / results.knnDisagreesWithGemini;
      
      if (geminiWinsWhenDisagree > knnWinsWhenDisagree) {
        console.log(`   - When models disagree, Gemini is right ${(geminiWinsWhenDisagree * 100).toFixed(0)}% of the time`);
        console.log("   - Consider increasing Gemini weight from 60% to 70%");
      } else {
        console.log(`   - When models disagree, k-NN is right ${(knnWinsWhenDisagree * 100).toFixed(0)}% of the time`);
        console.log("   - Consider increasing k-NN weight from 40% to 50%");
      }
    }
  }
  
  // Check for stage-specific issues
  console.log("\n📌 Stage-specific issues:");
  stages.forEach(stage => {
    const s = results.byStage[stage];
    if (s.gt >= 5) {
      const ensembleStageAcc = s.ensembleCorrect / s.gt;
      if (ensembleStageAcc < 0.3) {
        console.log(`   - ${stage}: Very low accuracy (${(ensembleStageAcc * 100).toFixed(0)}%). May need more training examples.`);
      }
    }
  });
}

analyzePredictions().catch(console.error);

