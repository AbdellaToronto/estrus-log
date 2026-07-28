"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowDownToLine, Check, Copy, Download, FileImage, Loader2, Sparkles, WandSparkles } from "lucide-react";

const DEFAULT_SOURCE = "/assets/generated/estrus-cycle-icons/source-grid.png";
const DEFAULT_PROMPT = "Quiet Cycle Atlas lab iconography: bone paper, muted indigo ink, restrained rust accent, flat screenprint geometry, no text, no anatomy, generous padding, vector-friendly.";
const DEFAULT_NAMES = [
  "Animal subject", "Capture date", "Microscope", "Sample vial", "Inspect", "Camera", "Upload", "Cycle", "Confirm", "Review needed", "Evidence", "Sample tag", "Scale", "Exposure", "Paired images", "Notes",
];

type ExportManifest = {
  runId: string;
  iconCount: number;
  vectorPipeline: { version: string; vectorizer: string; optimizer: string };
  icons: Array<{ index: number; row: number; col: number; name: string; svgPath: string; previewPath: string; pathCount: number; svgBytes: number; warnings: string[] }>;
};

export function AssetStudioClient() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [names, setNames] = useState(DEFAULT_NAMES.join("\n"));
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<ExportManifest | null>(null);
  const [sourcePath, setSourcePath] = useState(DEFAULT_SOURCE);
  const [zipPath, setZipPath] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const sourceLabel = useMemo(() => sourceFile?.name || "Codex ImageGen seed grid", [sourceFile]);

  async function exportVectors() {
    setExporting(true);
    setError(null);
    try {
      const form = new FormData();
      if (sourceFile) form.append("file", sourceFile);
      else {
        const response = await fetch(DEFAULT_SOURCE);
        form.append("file", await response.blob(), "estrus-cycle-icons.png");
      }
      form.append("rows", "4");
      form.append("cols", "4");
      form.append("prompt", prompt);
      form.append("names", names);
      const response = await fetch("/api/asset-studio/vectorize", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Vector export failed.");
      setManifest(payload.manifest);
      setSourcePath(payload.sourcePath);
      setZipPath(payload.zipPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Vector export failed.");
    } finally {
      setExporting(false);
    }
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="min-h-screen bg-[#f7f4ed] text-[#242536]">
      <div className="mx-auto grid min-h-screen max-w-[1480px] lg:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="border-b border-[#ded9cd] bg-[#f3efe6] px-6 py-7 lg:border-b-0 lg:border-r">
          <div className="font-serif text-2xl tracking-[-0.04em] text-[#30345f]">Estrus</div>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8b887e]">Internal tools</p>
          <nav className="mt-12 space-y-2 text-sm">
            <a className="flex items-center gap-3 rounded-full bg-[#454a9f] px-3 py-2 text-white" href="/asset-studio"><WandSparkles className="h-4 w-4" /> Asset Studio</a>
            <a className="flex items-center gap-3 px-3 py-2 text-[#6b6970]" href="/workflow-lab"><FileImage className="h-4 w-4" /> Workflow canvas</a>
          </nav>
          <div className="mt-16 border-t border-[#ded9cd] pt-4 text-xs leading-5 text-[#77736c]">Local-only surface. Nothing here writes to production or calls the deployed app.</div>
        </aside>

        <section className="px-6 py-8 sm:px-10 lg:px-16 lg:py-12">
          <div className="flex flex-wrap items-start justify-between gap-6 border-b border-[#ded9cd] pb-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b65d43]">ImageGen → SVG</p>
              <h1 className="mt-3 font-serif text-4xl tracking-[-0.055em] text-[#262846] sm:text-5xl">Asset Studio</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#6e6b68]">Turn a generated icon grid into named, inspectable SVG paths with the same vector handoff contract as the spritesheet-maker app.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#77736c]"><span className="h-2 w-2 rounded-full bg-[#b65d43]" /> AI Spritesheet Maker extraction · v3</div>
          </div>

          <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(330px,0.9fr)]">
            <div className="space-y-8">
              <section className="border border-[#ded9cd] bg-[#fbfaf7] p-4 shadow-[0_16px_50px_rgba(49,44,30,0.05)] sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8b887e]">01 · Source grid</p><h2 className="mt-2 font-serif text-2xl text-[#2c2e55]">Generated iconography</h2></div>
                  <button type="button" className="inline-flex items-center gap-2 border border-[#cbc5b8] px-3 py-2 text-xs font-semibold text-[#454a9f]" onClick={() => fileRef.current?.click()}><ArrowDownToLine className="h-3.5 w-3.5" /> Replace grid</button>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => setSourceFile(event.target.files?.[0] || null)} />
                </div>
                <div className="mt-5 overflow-hidden border border-[#ded9cd] bg-[#f4f0e7] p-3"><img src={sourceFile ? URL.createObjectURL(sourceFile) : sourcePath} alt="Generated scientific workflow icon grid" className="w-full object-contain" /></div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#77736c]"><span>{sourceLabel}</span><span>4 × 4 · {manifest ? `${manifest.iconCount} vectors exported` : "ready for vector export"}</span></div>
              </section>

              {manifest && <section className="border border-[#ded9cd] bg-[#fbfaf7] p-4 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8b887e]">03 · Vector set</p><h2 className="mt-2 font-serif text-2xl text-[#2c2e55]">Named SVG paths</h2></div>{zipPath && <a href={zipPath} download className="inline-flex items-center gap-2 bg-[#454a9f] px-3 py-2 text-xs font-semibold text-white"><Download className="h-3.5 w-3.5" /> Download ZIP</a>}</div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{manifest.icons.map((icon) => <a key={icon.index} href={icon.svgPath} download className="group border border-[#ded9cd] bg-[#f6f3eb] p-3"><div className="flex aspect-square items-center justify-center bg-[#fdfcf9]"><img src={icon.previewPath} alt={icon.name} className="h-full w-full object-contain" /></div><p className="mt-2 truncate text-[11px] font-semibold text-[#454a9f]">{icon.name}</p><p className="mt-1 text-[10px] text-[#8b887e]">{icon.pathCount} paths · {icon.svgBytes} B</p></a>)}</div></section>}
            </div>

            <aside className="space-y-5">
              <section className="border border-[#ded9cd] bg-[#eeedf9] p-5"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#454a9f]"><Sparkles className="h-3.5 w-3.5" /> 02 · Prompt contract</div><h2 className="mt-3 font-serif text-2xl text-[#2c2e55]">Keep the visual language repeatable</h2><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} className="mt-4 min-h-32 w-full resize-y border border-[#d5d2e5] bg-[#fbfaf7] p-3 text-sm leading-6 text-[#45445e] outline-none focus:border-[#454a9f]" aria-label="Image generation prompt" /><div className="mt-3 flex gap-2"><button type="button" onClick={copyPrompt} className="inline-flex items-center gap-2 border border-[#c9c6da] px-3 py-2 text-xs font-semibold text-[#454a9f]">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy prompt"}</button></div></section>
              <section className="border border-[#ded9cd] bg-[#fbfaf7] p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8b887e]">Naming map</p><p className="mt-2 text-sm leading-6 text-[#6e6b68]">One label per line, in reading order. Names become SVG titles and download-safe filenames.</p><textarea value={names} onChange={(event) => setNames(event.target.value)} className="mt-4 min-h-40 w-full resize-y border border-[#ded9cd] bg-[#f6f3eb] p-3 text-xs leading-5 text-[#45445e] outline-none focus:border-[#454a9f]" aria-label="Icon naming map" /></section>
              <section className="border border-[#ded9cd] bg-[#2c2e55] p-5 text-[#f7f4ed]"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d9d7f4]">Export gate</p><p className="mt-3 text-sm leading-6 text-[#efede6]">Vector output is checked for real path geometry, no embedded raster images, path count, byte size, and a rendered preview.</p><button type="button" onClick={exportVectors} disabled={exporting} className="mt-5 inline-flex w-full items-center justify-center gap-2 bg-[#c36a4d] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}{exporting ? "Vectorizing…" : "Export SVG set"}</button>{error && <p role="alert" className="mt-3 text-xs leading-5 text-[#ffd7c8]">{error}</p>}</section>
              {manifest && <div className="text-xs leading-5 text-[#77736c]">Run <span className="font-mono text-[#454a9f]">{manifest.runId.slice(0, 8)}</span> · {manifest.vectorPipeline.vectorizer} · {manifest.vectorPipeline.optimizer}</div>}
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
