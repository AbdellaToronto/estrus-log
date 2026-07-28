import "server-only";

import { vectorize, type Config } from "@neplex/vectorizer";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { optimize } from "svgo";

export const ICON_CANVAS_SIZE = 512;
export const ICON_PIPELINE_VERSION = "estrus-v3-gutter-detected-grid";

export type VectorizedIcon = {
  index: number;
  row: number;
  col: number;
  name: string;
  svg: string;
  previewPng: Buffer;
  pathCount: number;
  svgBytes: number;
  warnings: string[];
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function annotateSvg(svg: string, name: string, index: number) {
  return svg.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) =>
    `<svg${attrs} role="img" data-icon-index="${index}" data-icon-name="${escapeXml(name)}"><title>${escapeXml(name)}</title>`
  );
}

function ensureViewBox(svg: string) {
  if (/<svg\b[^>]*\bviewBox=/i.test(svg)) return svg;
  return svg.replace(/<svg\b/i, `<svg viewBox="0 0 ${ICON_CANVAS_SIZE} ${ICON_CANVAS_SIZE}"`);
}

function optimizeSvg(svg: string) {
  const safe = ensureViewBox(svg)
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*([\"']).*?\1/gi, "")
    .replace(/\s(?:href|xlink:href)\s*=\s*([\"'])\s*javascript:[\s\S]*?\1/gi, "");

  return optimize(safe, {
    multipass: true,
    floatPrecision: 3,
    plugins: [
      "preset-default",
      "removeDimensions",
      "removeScripts",
      "removeRasterImages",
    ],
  }).data;
}

function inspectSvg(svg: string) {
  const pathCount = svg.match(/<path\b/gi)?.length ?? 0;
  const svgBytes = Buffer.byteLength(svg, "utf8");
  const warnings: string[] = [];
  if (!pathCount) throw new Error("Vectorizer produced no path geometry");
  if (/<image\b/i.test(svg)) throw new Error("Vectorizer produced embedded raster data");
  if (pathCount > 450) warnings.push("high_path_count");
  if (svgBytes > 300_000) warnings.push("large_svg");
  return { pathCount, svgBytes, warnings };
}

type RgbColor = { r: number; g: number; b: number };

function colorDistance(a: RgbColor, b: RgbColor) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function isChromaGreen(color: RgbColor) {
  return color.g >= 180 && color.r <= 100 && color.b <= 130 && color.g - Math.max(color.r, color.b) >= 80;
}

function getPixelColor(data: Buffer, index: number): RgbColor {
  const offset = index * 4;
  return { r: data[offset] ?? 0, g: data[offset + 1] ?? 0, b: data[offset + 2] ?? 0 };
}

function getEdgePixelIndexes(width: number, height: number) {
  const indexes: number[] = [];
  for (let x = 0; x < width; x += 1) indexes.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y += 1) indexes.push(y * width, y * width + width - 1);
  return indexes;
}

function detectBackgroundColor(data: Buffer, width: number, height: number) {
  const edgeIndexes = getEdgePixelIndexes(width, height);
  const bins = new Map<string, { count: number; r: number; g: number; b: number }>();
  let opaqueEdgeCount = 0;
  let chromaEdgeCount = 0;
  for (const index of edgeIndexes) {
    const alpha = data[index * 4 + 3] ?? 255;
    if (alpha < 160) continue;
    const color = getPixelColor(data, index);
    opaqueEdgeCount += 1;
    if (isChromaGreen(color)) chromaEdgeCount += 1;
    const key = `${Math.round(color.r / 16)}:${Math.round(color.g / 16)}:${Math.round(color.b / 16)}`;
    const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bin.count += 1;
    bin.r += color.r;
    bin.g += color.g;
    bin.b += color.b;
    bins.set(key, bin);
  }
  if (!opaqueEdgeCount) return null;
  if (chromaEdgeCount / opaqueEdgeCount >= 0.08) {
    return { color: { r: 0, g: 255, b: 0 }, threshold: 98, featherThreshold: 138 };
  }
  let dominant: { count: number; r: number; g: number; b: number } | undefined;
  for (const bin of bins.values()) if (!dominant || bin.count > dominant.count) dominant = bin;
  if (!dominant || dominant.count / opaqueEdgeCount < 0.28) return null;
  return {
    color: {
      r: Math.round(dominant.r / dominant.count),
      g: Math.round(dominant.g / dominant.count),
      b: Math.round(dominant.b / dominant.count),
    },
    threshold: 42,
    featherThreshold: 70,
  };
}

/** Ported from AI Spritesheet Maker's icon-set vector export pipeline. */
async function removeFlatBackground(buffer: Buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const pixels = Buffer.from(data);
  const background = detectBackgroundColor(pixels, width, height);
  if (!background) return sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();

  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;
  const isBackgroundLike = (index: number, threshold: number) => {
    const alpha = pixels[index * 4 + 3] ?? 255;
    return alpha < 16 || colorDistance(getPixelColor(pixels, index), background.color) <= threshold;
  };
  const enqueue = (index: number) => {
    if (index < 0 || index >= totalPixels || visited[index] || !isBackgroundLike(index, background.threshold)) return;
    visited[index] = 1;
    queue[tail++] = index;
  };
  for (const index of getEdgePixelIndexes(width, height)) enqueue(index);
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }
  for (let index = 0; index < totalPixels; index += 1) {
    if (visited[index]) pixels[index * 4 + 3] = 0;
  }
  for (let index = 0; index < totalPixels; index += 1) {
    if (visited[index] || (pixels[index * 4 + 3] ?? 255) < 16) continue;
    const distance = colorDistance(getPixelColor(pixels, index), background.color);
    if (distance > background.featherThreshold) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    const touchesRemoved =
      (x > 0 && visited[index - 1]) ||
      (x + 1 < width && visited[index + 1]) ||
      (y > 0 && visited[index - width]) ||
      (y + 1 < height && visited[index + width]);
    if (!touchesRemoved) continue;
    const fade = Math.max(0, Math.min(1, (distance - background.threshold) / Math.max(1, background.featherThreshold - background.threshold)));
    pixels[index * 4 + 3] = Math.round((pixels[index * 4 + 3] ?? 255) * fade);
  }
  return sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

function smoothProjection(source: Float32Array, radius = 2) {
  const result = new Float32Array(source.length);
  for (let i = 0; i < source.length; i += 1) {
    let total = 0;
    let count = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const index = i + offset;
      if (index < 0 || index >= source.length) continue;
      total += source[index];
      count += 1;
    }
    result[i] = count ? total / count : source[i];
  }
  return result;
}

/** Uses the same alpha-projection valley contract as AI Spritesheet Maker's grid-guided detector. */
async function findGridCuts(buffer: Buffer, rows: number, cols: number) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const xAlpha = new Float32Array(info.width);
  const yAlpha = new Float32Array(info.height);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * 4 + 3] ?? 0;
      if (alpha <= 2) continue;
      xAlpha[x] += alpha;
      yAlpha[y] += alpha;
    }
  }
  const cutsForAxis = (source: Float32Array, divisions: number) => {
    const projection = smoothProjection(source, 2);
    const size = projection.length;
    const targetWidth = size / divisions;
    const globalMean = projection.reduce((sum, value) => sum + value, 0) / Math.max(1, size);
    const minSpacing = Math.max(2, Math.floor(size * 0.01));
    const searchRadius = Math.max(minSpacing * 2, Math.floor(targetWidth * 0.35));
    const cuts = [0];
    let previous = 0;
    for (let division = 1; division < divisions; division += 1) {
      const target = Math.round(division * targetWidth);
      const start = Math.max(previous + minSpacing, target - searchRadius);
      const end = Math.min(size - (divisions - division) * minSpacing, target + searchRadius);
      let bestPosition = target;
      let bestScore = Number.POSITIVE_INFINITY;
      for (let position = start; position <= end; position += 1) {
        const deviation = Math.abs(position - target) / Math.max(1, targetWidth);
        const score = projection[position] + deviation * deviation * Math.max(globalMean, 1) * 0.25;
        if (score < bestScore) {
          bestPosition = position;
          bestScore = score;
        }
      }
      cuts.push(bestPosition);
      previous = bestPosition;
    }
    cuts.push(size);
    return cuts;
  };
  return { x: cutsForAxis(xAlpha, cols), y: cutsForAxis(yAlpha, rows) };
}

async function prepareCell(buffer: Buffer) {
  let cleaned: Buffer;
  try {
    cleaned = await removeFlatBackground(buffer);
  } catch {
    cleaned = await sharp(buffer).ensureAlpha().png().toBuffer();
  }
  let trimmed: Buffer;
  try {
    trimmed = await sharp(cleaned).trim({ threshold: 8 }).png().toBuffer();
  } catch {
    trimmed = cleaned;
  }
  const contained = await sharp(trimmed)
    .resize(Math.round(ICON_CANVAS_SIZE * 0.76), Math.round(ICON_CANVAS_SIZE * 0.76), { fit: "inside" })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: ICON_CANVAS_SIZE,
      height: ICON_CANVAS_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: contained, gravity: "center" }]).png().toBuffer();
}

const vectorConfig: Config = {
  colorMode: 0,
  hierarchical: 0,
  filterSpeckle: 10,
  colorPrecision: 5,
  layerDifference: 10,
  mode: 2,
  cornerThreshold: 70,
  lengthThreshold: 8,
  maxIterations: 3,
  spliceThreshold: 45,
  pathPrecision: 2,
};

export async function vectorizeGrid(input: {
  buffer: Buffer;
  rows: number;
  cols: number;
  names?: string[];
}) {
  const metadata = await sharp(input.buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) throw new Error("Could not read source image dimensions");
  const cleanedSheet = await removeFlatBackground(input.buffer);
  const cuts = await findGridCuts(cleanedSheet, input.rows, input.cols);
  const icons: VectorizedIcon[] = [];
  for (let index = 0; index < input.rows * input.cols; index += 1) {
    const row = Math.floor(index / input.cols);
    const col = index % input.cols;
    const left = cuts.x[col] ?? 0;
    const top = cuts.y[row] ?? 0;
    const right = cuts.x[col + 1] ?? width;
    const bottom = cuts.y[row + 1] ?? height;
    const cell = await sharp(cleanedSheet).extract({ left, top, width: right - left, height: bottom - top }).png().toBuffer();
    const prepared = await prepareCell(cell);
    const rawSvg = await vectorize(prepared, vectorConfig);
    const name = input.names?.[index]?.trim() || `Icon ${String(index + 1).padStart(2, "0")}`;
    const svg = annotateSvg(optimizeSvg(rawSvg), name, index);
    const inspected = inspectSvg(svg);
    const previewPng = new Resvg(svg, {
      fitTo: { mode: "width", value: ICON_CANVAS_SIZE },
      background: "rgba(0, 0, 0, 0)",
      font: { loadSystemFonts: false },
    }).render().asPng();
    icons.push({ index, row, col, name, svg, previewPng, ...inspected });
  }
  return icons;
}
