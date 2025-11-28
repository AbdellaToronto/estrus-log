/**
 * Exhaustively search for the best decision rule that maps (kNN prediction, Gemini prediction)
 * to a final stage, using the current dataset as ground truth.
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

function extractGroundTruth(imageUrl: string): Stage | null {
  const filename = imageUrl.split("/").pop()?.toUpperCase() || "";
  if (filename.includes("PROESTRUS")) return "Proestrus";
  if (
    filename.includes("ESTRUS") &&
    !filename.includes("PROESTRUS") &&
    !filename.includes("METESTRUS") &&
    !filename.includes("DIESTRUS")
  )
    return "Estrus";
  if (filename.includes("METESTRUS")) return "Metestrus";
  if (filename.includes("DIESTRUS")) return "Diestrus";
  return null;
}

function parseReasoning(reasoning: string | null | undefined) {
  if (!reasoning) {
    return {
      knn: null as Stage | null,
      gemini: null as Stage | null,
    };
  }

  const knnMatch = reasoning.match(/k-NN predicted (\w+)/i);
  const geminiMatch = reasoning.match(/Gemini predicted (\w+)/i);

  const knnStage = STAGES.find(
    (s) => s.toLowerCase() === knnMatch?.[1]?.toLowerCase()
  );
  const geminiStage = STAGES.find(
    (s) => s.toLowerCase() === geminiMatch?.[1]?.toLowerCase()
  );

  return {
    knn: knnStage ?? null,
    gemini: geminiStage ?? null,
  };
}

async function main() {
  const { data: logs } = await supabase
    .from("estrus_logs")
    .select("image_url, notes, data")
    .order("created_at", { ascending: true })
    .limit(500);

  const dataset: Array<{
    gt: Stage;
    knn: Stage;
    gemini: Stage;
  }> = [];

  for (const log of logs || []) {
    const gt = extractGroundTruth(log.image_url);
    if (!gt) continue;
    const reasoning = log.notes || (log.data as any)?.reasoning;
    const parsed = parseReasoning(reasoning);
    if (!parsed.knn || !parsed.gemini) continue;
    dataset.push({ gt, knn: parsed.knn, gemini: parsed.gemini });
  }

  console.log(`Dataset size: ${dataset.length}`);

  // There are 16 possible (knn, gemini) pairs.
  const pairs: Array<[Stage, Stage]> = [];
  for (const knn of STAGES) {
    for (const gemini of STAGES) {
      pairs.push([knn, gemini]);
    }
  }

  // Exhaustive search: assign each pair to one of 4 stages.
  // That's 4^(16) combos (~4 billion) -> too many.
  // Instead greedily choose best stage per pair independently.
  // Because decision for each pair is independent given dataset (no global constraints).
  const mapping = new Map<string, Stage>();
  let totalCorrect = 0;
  const breakdown: Record<string, { total: number; bestStage: Stage; correct: number }> = {};

  for (const pair of pairs) {
    const [knn, gemini] = pair;
    const subset = dataset.filter(
      (row) => row.knn === knn && row.gemini === gemini
    );
    if (subset.length === 0) continue;

    let bestStage: Stage = "Diestrus";
    let bestCorrect = -1;
    for (const candidate of STAGES) {
      const correct = subset.filter((row) => row.gt === candidate).length;
      if (correct > bestCorrect) {
        bestCorrect = correct;
        bestStage = candidate;
      }
    }
    mapping.set(`${knn}-${gemini}`, bestStage);
    totalCorrect += bestCorrect;
    breakdown[`${knn}/${gemini}`] = {
      total: subset.length,
      bestStage,
      correct: bestCorrect,
    };
  }

  console.log("\nOptimal mapping (per pair):");
  for (const pair of pairs) {
    const key = `${pair[0]}/${pair[1]}`;
    if (breakdown[key]) {
      const info = breakdown[key];
      console.log(
        `${key.padEnd(20)} -> ${info.bestStage.padEnd(
          10
        )} (${info.correct}/${info.total})`
      );
    }
  }

  console.log("\nMax achievable accuracy with pair mapping:");
  console.log(`${totalCorrect}/${dataset.length} = ${(totalCorrect / dataset.length * 100).toFixed(1)}%`);
}

main().catch(console.error);

