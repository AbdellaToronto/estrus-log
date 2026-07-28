import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { vectorizeGrid, ICON_PIPELINE_VERSION } from "@/lib/asset-studio/vector-pipeline";

export const runtime = "nodejs";

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "icon";
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ESTRUS_ASSET_STUDIO !== "true") {
    return NextResponse.json({ error: "Asset Studio is local-only." }, { status: 404 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const rows = Math.min(8, Math.max(1, Number(form.get("rows") || 4)));
    const cols = Math.min(8, Math.max(1, Number(form.get("cols") || 4)));
    const prompt = String(form.get("prompt") || "");
    const names = String(form.get("names") || "").split("\n").map((value) => value.trim()).filter(Boolean);
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PNG or JPEG grid first." }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "The source must be an image." }, { status: 400 });
    if (file.size > 16 * 1024 * 1024) return NextResponse.json({ error: "The source image must be smaller than 16 MB." }, { status: 400 });

    const runId = crypto.randomUUID();
    const outputRoot = path.join(process.cwd(), "public", "assets", "generated", "asset-studio", runId);
    await mkdir(path.join(outputRoot, "icons"), { recursive: true });
    await mkdir(path.join(outputRoot, "previews"), { recursive: true });
    const sourceBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(outputRoot, "source.png"), sourceBuffer);
    const icons = await vectorizeGrid({ buffer: sourceBuffer, rows, cols, names });
    const zip = new JSZip();
    const manifestIcons = [];
    for (const icon of icons) {
      const baseName = `${String(icon.index + 1).padStart(2, "0")}-${safeName(icon.name)}`;
      const svgFile = `icons/${baseName}.svg`;
      const previewFile = `previews/${baseName}.png`;
      await writeFile(path.join(outputRoot, svgFile), icon.svg, "utf8");
      await writeFile(path.join(outputRoot, previewFile), icon.previewPng);
      zip.file(svgFile, icon.svg);
      zip.file(previewFile, icon.previewPng);
      manifestIcons.push({
        index: icon.index,
        row: icon.row,
        col: icon.col,
        name: icon.name,
        svgPath: `/${path.posix.join("assets/generated/asset-studio", runId, svgFile)}`,
        previewPath: `/${path.posix.join("assets/generated/asset-studio", runId, previewFile)}`,
        vectorStatus: "success" as const,
        vectorProvider: "local_vtracer" as const,
        pathCount: icon.pathCount,
        svgBytes: icon.svgBytes,
        warnings: icon.warnings,
      });
    }
    const manifest = {
      kind: "estrus_icon_set",
      runId,
      gridRows: rows,
      gridCols: cols,
      iconCount: icons.length,
      sourcePrompt: prompt || null,
      generationEngine: "Codex ImageGen handoff",
      modelUsed: "ImageGen (agent-side)",
      vectorProvider: "local_vtracer",
      vectorPipeline: {
        version: ICON_PIPELINE_VERSION,
        vectorizer: "@neplex/vectorizer (VTracer)",
        optimizer: "svgo",
        previewRenderer: "@resvg/resvg-js",
        backgroundCleanup: "AI Spritesheet Maker edge-color removal plus alpha-projection grid extraction",
      },
      exportedAt: new Date().toISOString(),
      icons: manifestIcons,
    };
    const readme = `# Estrus Asset Studio export\n\nGenerated with the Codex ImageGen handoff, then vectorized locally with VTracer-compatible tooling.\n\nThe manifest records source prompt, grid position, path counts, and warnings for auditability.\n`;
    await writeFile(path.join(outputRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
    await writeFile(path.join(outputRoot, "README.md"), readme);
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    zip.file("README.md", readme);
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    await writeFile(path.join(outputRoot, "estrus-icon-set-vector.zip"), zipBuffer);

    return NextResponse.json({
      manifest,
      sourcePath: `/${path.posix.join("assets/generated/asset-studio", runId, "source.png")}`,
      zipPath: `/${path.posix.join("assets/generated/asset-studio", runId, "estrus-icon-set-vector.zip")}`,
    });
  } catch (error) {
    console.error("Asset Studio vectorization failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not vectorize this grid." }, { status: 500 });
  }
}
