/**
 * Server-only k-NN classifier over BioCLIP reference embeddings.
 *
 * Two things distinguish this from the earlier inline implementation in
 * src/trigger/scan-tasks.ts:
 *
 * 1. It reads the Supabase reference library when that is reachable and falls
 *    back to a bundled reference bank otherwise, so single-image analysis keeps
 *    working when the database is paused or unconfigured.
 * 2. Neighbour votes are weighted by similarity through a softmax rather than
 *    counted. A plain count over k=3 can only ever emit 0%, 33%, 67% or 100%,
 *    which reads as false precision — "100% confident" from three neighbours is
 *    not a claim the evidence supports.
 *
 * The resulting scores are relative model support, not calibrated
 * probabilities. See src/lib/classification.ts for the shared contract.
 */

import {
  ESTRUS_STAGES,
  isClassificationStage,
  type ClassificationStage,
} from "@/lib/classification";
import bundledBank from "@/lib/reference-bank.json";
import whiteBinaryBank from "@/lib/white-binary-bank.json";

export type ReferenceNeighbour = {
  label: ClassificationStage;
  similarity: number;
  imagePath: string | null;
};

export type ReferenceSource = "database" | "bundled";

export type ReferenceClassification = {
  stage: ClassificationStage;
  scores: Record<ClassificationStage, number>;
  neighbours: ReferenceNeighbour[];
  source: ReferenceSource;
  referenceCount: number;
  nearestSimilarity: number;
  meanSimilarity: number;
  margin: number;
  reviewReasons: string[];
};

/** Neighbours considered per query. Large enough that one atypical reference
 *  cannot swing the vote, small enough to stay local to the query image. */
const NEIGHBOUR_COUNT = 15;

/** Softmax temperature over cosine similarity. Cosine distances between
 *  same-stage BioCLIP embeddings cluster tightly, so a small temperature is
 *  needed for the weighting to separate neighbours at all. */
const TEMPERATURE = 0.04;

/** Below this top-stage support the prediction is too diffuse to present as a
 *  single answer, and the demo surfaces it as an abstention. */
const ABSTAIN_BELOW = 0.45;

/** A near-tie between the top two stages needs a human even when support for
 *  the leader looks reasonable. */
const NARROW_MARGIN = 0.15;

/** Below this the query image does not resemble the reference library at all —
 *  usually a different imaging setup, or not a mouse. */
const OUT_OF_DOMAIN_SIMILARITY = 0.6;

type BundledBank = {
  labels: string[];
  vectors: string;
  dimensions: number;
  count: number;
};

type DecodedBank = {
  labels: ClassificationStage[];
  /** Row-major, L2-normalised, `count` rows of `dimensions` floats. */
  matrix: Float32Array;
  dimensions: number;
};

let decodedBank: DecodedBank | null = null;

/** Decode an int8 bank and re-normalise each row so cosine similarity is a plain
 *  dot product. Labels are kept as raw strings; callers narrow them. */
function decodeInt8Bank(
  base64Vectors: string,
  labels: string[],
  dimensions: number
): { labels: string[]; matrix: Float32Array; dimensions: number } {
  const raw = Buffer.from(base64Vectors, "base64");
  const rows = labels.length;
  const matrix = new Float32Array(rows * dimensions);

  for (let row = 0; row < rows; row += 1) {
    const offset = row * dimensions;
    let sumOfSquares = 0;
    for (let column = 0; column < dimensions; column += 1) {
      // Buffer bytes are unsigned; recover the signed int8 value.
      const byte = raw[offset + column];
      const value = byte > 127 ? byte - 256 : byte;
      matrix[offset + column] = value;
      sumOfSquares += value * value;
    }
    const norm = Math.sqrt(sumOfSquares) || 1;
    for (let column = 0; column < dimensions; column += 1) {
      matrix[offset + column] /= norm;
    }
  }

  return { labels, matrix, dimensions };
}

/** Decode the four-stage bank once per process. */
function getBundledBank(): DecodedBank {
  if (decodedBank) return decodedBank;

  const bank = bundledBank as unknown as BundledBank;
  const decoded = decodeInt8Bank(bank.vectors, bank.labels, bank.dimensions);

  decodedBank = {
    labels: decoded.labels.filter(isClassificationStage) as ClassificationStage[],
    matrix: decoded.matrix,
    dimensions: decoded.dimensions,
  };
  return decodedBank;
}

function normalise(vector: number[]): Float32Array {
  const result = new Float32Array(vector.length);
  let sumOfSquares = 0;
  for (let i = 0; i < vector.length; i += 1) sumOfSquares += vector[i] * vector[i];
  const norm = Math.sqrt(sumOfSquares) || 1;
  for (let i = 0; i < vector.length; i += 1) result[i] = vector[i] / norm;
  return result;
}

function bundledNeighbours(embedding: number[], limit: number): ReferenceNeighbour[] {
  const bank = getBundledBank();
  if (embedding.length !== bank.dimensions) {
    throw new Error(
      `Embedding has ${embedding.length} dimensions, reference bank has ${bank.dimensions}`
    );
  }

  const query = normalise(embedding);
  const scored: ReferenceNeighbour[] = bank.labels.map((label, row) => {
    const offset = row * bank.dimensions;
    let dot = 0;
    for (let column = 0; column < bank.dimensions; column += 1) {
      dot += query[column] * bank.matrix[offset + column];
    }
    return { label, similarity: dot, imagePath: null };
  });

  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

type DatabaseNeighbourRow = {
  label: string;
  similarity: number;
  image_path: string | null;
};

async function databaseNeighbours(
  embedding: number[],
  limit: number
): Promise<ReferenceNeighbour[] | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  try {
    const { getServiceSupabase } = await import("@/lib/supabase-admin");
    const client = getServiceSupabase();
    const { data, error } = await (
      client as unknown as {
        rpc: (
          name: string,
          args: Record<string, unknown>
        ) => Promise<{ data: DatabaseNeighbourRow[] | null; error: unknown }>;
      }
    ).rpc("match_reference_images", {
      query_embedding: embedding,
      match_threshold: 0,
      match_count: limit,
    });

    if (error || !data?.length) return null;

    const neighbours = data
      .filter((row) => isClassificationStage(row.label))
      .map((row) => ({
        label: row.label as ClassificationStage,
        similarity: row.similarity,
        imagePath: row.image_path,
      }));

    return neighbours.length > 0 ? neighbours : null;
  } catch {
    // A paused project, a DNS failure, or a missing RPC all mean the same thing
    // here: use the bundled bank instead of failing the request.
    return null;
  }
}

/** Similarity-weighted vote. Weights are a softmax over cosine similarity,
 *  shifted by the maximum for numerical stability. */
function tally(neighbours: ReferenceNeighbour[]): Record<ClassificationStage, number> {
  const scores: Record<ClassificationStage, number> = {
    Proestrus: 0,
    Estrus: 0,
    Metestrus: 0,
    Diestrus: 0,
  };
  if (neighbours.length === 0) return scores;

  const best = neighbours[0].similarity;
  let total = 0;

  for (const neighbour of neighbours) {
    const weight = Math.exp((neighbour.similarity - best) / TEMPERATURE);
    scores[neighbour.label] += weight;
    total += weight;
  }

  if (total > 0) {
    for (const stage of ESTRUS_STAGES) scores[stage] /= total;
  }
  return scores;
}

/**
 * Classify a BioCLIP embedding against the reference library.
 *
 * @param embedding 512-d BioCLIP image embedding.
 * @param options.preferDatabase Set false to force the bundled bank.
 */
export async function classifyEmbedding(
  embedding: number[],
  options: { preferDatabase?: boolean } = {}
): Promise<ReferenceClassification> {
  const { preferDatabase = true } = options;

  const fromDatabase = preferDatabase
    ? await databaseNeighbours(embedding, NEIGHBOUR_COUNT)
    : null;

  const source: ReferenceSource = fromDatabase ? "database" : "bundled";
  const neighbours = fromDatabase ?? bundledNeighbours(embedding, NEIGHBOUR_COUNT);

  const scores = tally(neighbours);
  const ranked = [...ESTRUS_STAGES].sort((a, b) => scores[b] - scores[a]);
  const stage = ranked[0];
  const margin = scores[ranked[0]] - scores[ranked[1]];

  const nearestSimilarity = neighbours[0]?.similarity ?? 0;
  const meanSimilarity =
    neighbours.reduce((sum, neighbour) => sum + neighbour.similarity, 0) /
    (neighbours.length || 1);

  const reviewReasons: string[] = [];
  if (scores[stage] < ABSTAIN_BELOW) {
    reviewReasons.push(
      `Support is spread across stages (${Math.round(scores[stage] * 100)}% for the leader).`
    );
  }
  if (margin < NARROW_MARGIN) {
    reviewReasons.push(
      `${ranked[0]} and ${ranked[1]} are within ${Math.round(margin * 100)} points.`
    );
  }
  if (nearestSimilarity < OUT_OF_DOMAIN_SIMILARITY) {
    reviewReasons.push(
      `Closest reference image only matches at ${Math.round(nearestSimilarity * 100)}%; this photograph may sit outside the reference library.`
    );
  }
  if (source === "bundled") {
    reviewReasons.push(
      "Matched against the bundled reference bank rather than the live library."
    );
  }

  return {
    stage,
    scores,
    neighbours,
    source,
    referenceCount: neighbours.length,
    nearestSimilarity,
    meanSimilarity,
    margin,
    reviewReasons,
  };
}

/** Exposed so the API route and evaluation script agree on what counts as an
 *  abstention. */
export function shouldAbstain(classification: ReferenceClassification): boolean {
  return (
    classification.scores[classification.stage] < ABSTAIN_BELOW ||
    classification.margin < NARROW_MARGIN
  );
}

export const CLASSIFIER_SETTINGS = {
  NEIGHBOUR_COUNT,
  TEMPERATURE,
  ABSTAIN_BELOW,
  NARROW_MARGIN,
  OUT_OF_DOMAIN_SIMILARITY,
} as const;

// ---------------------------------------------------------------------------
// White-coat binary task
// ---------------------------------------------------------------------------

/**
 * The demo's validated scope is white-coated mice, but the four-stage bank above
 * is built from this lab's dark-coated photographs. A white upload lands far from
 * every dark reference and abstains — correct, but it leaves the reviewer with
 * nothing.
 *
 * This is a second bank over the public white-coated benchmark, on the binary
 * task the published protocol actually validates: proestrus-or-estrus against
 * metestrus-or-diestrus. It scores 52/76 (68.4% balanced) on the sealed test.
 * That is well clear of the 50% chance line and well behind the promoted DINOv2
 * eight-head ensemble's 66/76, which is the point — it is a nearest-neighbour
 * floor, shown when the GPU ensemble is unreachable.
 */
export type BinaryGroup = "PROESTRUS_OR_ESTRUS" | "METESTRUS_OR_DIESTRUS";

export type BinaryClassification = {
  group: BinaryGroup;
  scores: Record<BinaryGroup, number>;
  nearestSimilarity: number;
  referenceCount: number;
  method: string;
  sealedTest: { records: number; correct: number; balancedAccuracy: number };
  /** True when the photograph resembles the white-coat reference set at all. */
  inReferenceDomain: boolean;
};

const BINARY_GROUPS: readonly BinaryGroup[] = [
  "PROESTRUS_OR_ESTRUS",
  "METESTRUS_OR_DIESTRUS",
];

type WhiteBank = {
  labels: string[];
  vectors: string;
  dimensions: number;
  settings: { k: number; temperature: number };
  sealed_test: { records: number; correct: number; balanced_accuracy: number };
};

let decodedWhiteBank: { labels: string[]; matrix: Float32Array; dimensions: number } | null =
  null;

function getWhiteBank() {
  if (decodedWhiteBank) return decodedWhiteBank;
  const bank = whiteBinaryBank as unknown as WhiteBank;
  decodedWhiteBank = decodeInt8Bank(bank.vectors, bank.labels, bank.dimensions);
  return decodedWhiteBank;
}

export function classifyWhiteCoatBinary(embedding: number[]): BinaryClassification | null {
  const bank = whiteBinaryBank as unknown as WhiteBank;
  const decoded = getWhiteBank();
  if (embedding.length !== decoded.dimensions) return null;

  const { k, temperature } = bank.settings;
  const query = normalise(embedding);

  const scored = decoded.labels.map((label, row) => {
    const offset = row * decoded.dimensions;
    let dot = 0;
    for (let column = 0; column < decoded.dimensions; column += 1) {
      dot += query[column] * decoded.matrix[offset + column];
    }
    return { label, similarity: dot };
  });

  const nearest = scored.sort((a, b) => b.similarity - a.similarity).slice(0, k);
  const best = nearest[0].similarity;

  const scores: Record<BinaryGroup, number> = {
    PROESTRUS_OR_ESTRUS: 0,
    METESTRUS_OR_DIESTRUS: 0,
  };
  let total = 0;
  for (const neighbour of nearest) {
    if (!BINARY_GROUPS.includes(neighbour.label as BinaryGroup)) continue;
    const weight = Math.exp((neighbour.similarity - best) / temperature);
    scores[neighbour.label as BinaryGroup] += weight;
    total += weight;
  }
  if (total > 0) {
    for (const group of BINARY_GROUPS) scores[group] /= total;
  }

  const group =
    scores.PROESTRUS_OR_ESTRUS >= scores.METESTRUS_OR_DIESTRUS
      ? "PROESTRUS_OR_ESTRUS"
      : "METESTRUS_OR_DIESTRUS";

  return {
    group,
    scores,
    nearestSimilarity: best,
    referenceCount: nearest.length,
    method: `BioCLIP embedding + similarity-weighted k-NN (k=${k}) over the white-coat public benchmark`,
    sealedTest: {
      records: bank.sealed_test.records,
      correct: bank.sealed_test.correct,
      balancedAccuracy: bank.sealed_test.balanced_accuracy,
    },
    inReferenceDomain: best >= OUT_OF_DOMAIN_SIMILARITY,
  };
}
