"use client";

/**
 * The one part of the demo that is not illustrative.
 *
 * Every other view replays fixed data. This view sends the uploaded photograph
 * to the deployed BioCLIP encoder and classifies it against the reference
 * library in real time, so the labelling is deliberately inverted here: the
 * rest of the demo is captioned "not live inference", and this is captioned
 * "live".
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ImageUp,
  Link as LinkIcon,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { StageDistribution } from "@/components/prediction/stage-distribution";
import type { ClassificationStage } from "@/lib/classification";
import { cn } from "@/lib/utils";

type Neighbour = { label: ClassificationStage; similarity: number };

type AnalysisResponse = {
  stage: ClassificationStage;
  abstained: boolean;
  scores: Record<ClassificationStage, number>;
  neighbours: Neighbour[];
  evidence: {
    method: string;
    reference_source: "database" | "bundled";
    reference_count: number;
    nearest_similarity: number;
    mean_similarity: number;
    margin: number;
  };
  review_required: boolean;
  review_reasons: string[];
  cropped_image: string | null;
  elapsed_ms: number;
  /** Present once the analysis has been persisted; null when storage is off. */
  id: string | null;
  original_url?: string | null;
  created_at?: string;
};

type Phase = "idle" | "working" | "done" | "error";

/** Stages the route reports as it goes, in order. */
type Stage = "encoding" | "matching" | "storing";

const STAGE_SEQUENCE: readonly Stage[] = ["encoding", "matching", "storing"];

const STAGE_COPY: Record<Stage, { label: string; detail: string }> = {
  encoding: {
    label: "Segmenting and encoding",
    detail: "SAM3 and BioCLIP run together on GPU. A cold container adds up to 40 seconds.",
  },
  matching: {
    label: "Matching against references",
    detail: "Comparing the embedding to every labelled reference photograph.",
  },
  storing: {
    label: "Storing the result",
    detail: "Writing the photograph, the crop, and the scores so this stays shareable.",
  },
};

const MAX_BYTES = 10 * 1024 * 1024;

const STAGE_SWATCH: Record<ClassificationStage, string> = {
  Proestrus: "bg-[#8f83d8]",
  Estrus: "bg-[#c76f87]",
  Metestrus: "bg-[#d3a450]",
  Diestrus: "bg-[#6493ba]",
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#68645d]">
      {children}
    </p>
  );
}

/** A shared result link carries the analysis id in the fragment. */
function sharedAnalysisId(): string | null {
  if (typeof window === "undefined") return null;
  return /#analysis=([0-9a-f-]{36})/i.exec(window.location.hash)?.[1] ?? null;
}

export function LiveAnalysis() {
  // Start in the loading state when arriving on a shared link, so the effect
  // that fetches it does not have to set state synchronously.
  const [phase, setPhase] = useState<Phase>(() =>
    sharedAnalysisId() ? "working" : "idle"
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<Stage | null>(() =>
    sharedAnalysisId() ? "storing" : null
  );
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  // Both endpoints are GPU-backed and scale to zero. Warming them while the
  // reviewer is still reading the page turns a ~35 s cold start into a
  // few-second analysis.
  useEffect(() => {
    fetch("/api/analyze").catch(() => undefined);
  }, []);

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    []
  );

  // A running clock while work is in flight. Without it a forty-second cold
  // start is indistinguishable from a hang.
  useEffect(() => {
    if (phase !== "working") return;
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => clearInterval(timer);
  }, [phase]);

  const reset = useCallback(() => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPhase("idle");
    setPreview(null);
    setFilename("");
    setResult(null);
    setError(null);
    setStage(null);
    setCopied(false);
    if (inputRef.current) inputRef.current.value = "";
    if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const copyPermalink = useCallback(async () => {
    if (!result?.id) return;
    const url = `${window.location.origin}${window.location.pathname}#analysis=${result.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission can be denied; the address bar still carries the id.
    }
  }, [result]);

  const analyze = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("That file is not an image.");
      setPhase("error");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Images must be 10 MB or smaller.");
      setPhase("error");
      return;
    }

    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const objectUrl = URL.createObjectURL(file);
    previewRef.current = objectUrl;

    setPreview(objectUrl);
    setFilename(file.name);
    setResult(null);
    setError(null);
    setStage(null);
    setCopied(false);
    setPhase("working");

    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/analyze", { method: "POST", body });

      if (!response.ok || !response.body) {
        let message = `Analysis failed (${response.status}).`;
        try {
          const payload = await response.json();
          if (payload?.error) message = payload.error;
        } catch {
          // Non-JSON error body; the status message above is enough.
        }
        setError(message);
        setPhase("error");
        return;
      }

      // Newline-delimited JSON: one stage event per step, then the result.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let settled = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(line);
          } catch {
            continue;
          }

          if (payload.event === "stage") {
            setStage(payload.stage as Stage);
          } else if (payload.event === "result") {
            setResult(payload as unknown as AnalysisResponse);
            setPhase("done");
            settled = true;
            if (typeof payload.id === "string") {
              window.history.replaceState(null, "", `#analysis=${payload.id}`);
            }
          } else if (payload.event === "error") {
            setError(String(payload.error ?? "Analysis failed."));
            setPhase("error");
            settled = true;
          }
        }
      }

      if (!settled) {
        setError("The analysis stream ended before returning a result.");
        setPhase("error");
      }
    } catch {
      setError("Could not reach the analysis service. Check your connection and retry.");
      setPhase("error");
    }
  }, []);

  // Restore a shared analysis from #analysis=<id>. Phase and stage were already
  // seeded from the fragment, so nothing is set synchronously here.
  useEffect(() => {
    const id = sharedAnalysisId();
    if (!id) return;
    let cancelled = false;

    fetch(`/api/analyze/${id}`)
      .then(async (response) => {
        if (cancelled) return;
        const payload = await response.json();
        if (!response.ok) {
          setError(payload?.error ?? "That shared analysis is no longer available.");
          setPhase("error");
          return;
        }
        setResult(payload as AnalysisResponse);
        setPreview(payload.original_url ?? null);
        setFilename(payload.id ? `Shared analysis ${payload.id.slice(0, 8)}` : "Shared analysis");
        setPhase("done");
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load that shared analysis.");
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) analyze(file);
    },
    [analyze]
  );

  const working = phase === "working";

  return (
    <main className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-12">
      <div className="border-b border-[#d9d4c8] pb-6">
        <Eyebrow>Live inference · not illustrative</Eyebrow>
        <div className="mt-2 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
          <div>
            <h1 className="font-serif text-4xl tracking-tight text-[#292b4c] sm:text-5xl">
              Analyze a photograph
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625f58]">
              Drop a photograph and it runs through the same encoder the batch pipeline
              uses. The result is produced live, unlike the worked examples in the rest
              of this demo. The validated scope is white-coated mice, following the
              published protocol this work reproduces; other coat colours are the
              expansion target, not a current claim.
            </p>
          </div>
          <div className="border border-[#ded9cd] bg-white p-4">
            <Eyebrow>How the answer is produced</Eyebrow>
            <p className="mt-2 text-xs leading-5 text-[#625f58]">
              SAM3 segments the animal for display. BioCLIP turns the photograph into a
              512-dimension embedding. That embedding is compared against a library of
              labelled reference photographs, and the nearest matches vote — weighted by
              how similar they are.
            </p>
            <p className="mt-2 text-xs leading-5 text-[#625f58]">
              The reference library is this lab&apos;s own dark-coated photographs, so a
              white-coated upload will often land far from every reference and abstain.
              That is the domain guard working, not a failure.
            </p>
          </div>
        </div>
      </div>

      <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
        {/* Upload / source column */}
        <div className="border border-[#ded9cd] bg-white">
          <div className="flex items-center justify-between border-b border-[#ded9cd] px-4 py-3">
            <Eyebrow>Photograph</Eyebrow>
            {preview && (
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1 text-xs font-semibold text-[#625f58] hover:text-[#454a9f]"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>

          {!preview ? (
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "m-4 flex flex-col items-center justify-center border border-dashed px-6 py-14 text-center transition-colors",
                dragging
                  ? "border-[#454a9f] bg-[#eeedf9]"
                  : "border-[#cfc9bb] bg-[#fbfaf7]"
              )}
            >
              <ImageUp className="h-8 w-8 text-[#8d887e]" />
              <p className="mt-4 font-serif text-xl text-[#292b4c]">
                Drop a photograph
              </p>
              <p className="mt-1 text-xs leading-5 text-[#625f58]">
                JPEG, PNG or WebP · up to 10 MB
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-5 bg-[#454a9f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#383d8a]"
              >
                Choose a file
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) analyze(file);
                }}
              />
            </div>
          ) : (
            <div className="p-4">
              <div className="relative overflow-hidden bg-[#ece8df]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt={filename || "Uploaded photograph"}
                  className="mx-auto max-h-[360px] w-auto object-contain"
                />
                {working && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#f7f4ed]/85">
                    <Loader2 className="h-6 w-6 animate-spin text-[#454a9f] motion-reduce:animate-none" />
                    <p className="text-xs font-semibold text-[#292b4c]">
                      Encoding and matching…
                    </p>
                    <p className="max-w-[240px] text-center text-[11px] leading-4 text-[#625f58]">
                      A cold GPU can take up to 40 seconds on the first photograph.
                    </p>
                  </div>
                )}
              </div>
              <p className="mt-3 truncate text-xs text-[#625f58]" title={filename}>
                {filename}
              </p>

              {result?.cropped_image && (
                <div className="mt-4 border-t border-[#e8e3da] pt-4">
                  <Eyebrow>Segmented by SAM3</Eyebrow>
                  <div className="mt-2 bg-[#1c1b19]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.cropped_image}
                      alt="Animal segmented from the background"
                      className="mx-auto max-h-[220px] w-auto object-contain"
                    />
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-[#625f58]">
                    Shown for orientation. The classifier reads the photograph as
                    supplied, which is the framing the reference library was built from.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Result column */}
        <div className="border border-[#ded9cd] bg-white">
          {phase === "idle" && (
            <div className="flex min-h-[420px] flex-col items-center justify-center px-8 text-center">
              <Sparkles className="h-6 w-6 text-[#b4afa4]" />
              <p className="mt-4 font-serif text-2xl text-[#292b4c]">
                No photograph yet
              </p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[#625f58]">
                The stage proposal, all four support scores, and the reference
                photographs that drove the answer will appear here.
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="flex min-h-[420px] flex-col items-center justify-center px-8 text-center">
              <AlertTriangle className="h-6 w-6 text-[#a8613c]" />
              <p className="mt-4 font-serif text-2xl text-[#292b4c]">
                That did not go through
              </p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[#625f58]">{error}</p>
              <button
                type="button"
                onClick={reset}
                className="mt-5 flex items-center gap-2 border border-[#ded9cd] px-4 py-2 text-sm font-semibold text-[#292b4c] hover:bg-[#fbfaf7]"
              >
                <RotateCcw className="h-4 w-4" /> Try another photograph
              </button>
            </div>
          )}

          {working && (
            <div className="flex min-h-[420px] flex-col justify-center p-8">
              <div className="flex items-baseline justify-between">
                <p className="font-serif text-2xl text-[#292b4c]">Analyzing</p>
                <p className="text-sm tabular-nums text-[#625f58]">
                  {(elapsed / 1000).toFixed(1)}s
                </p>
              </div>

              <ol className="mt-6 space-y-1">
                {STAGE_SEQUENCE.map((candidate) => {
                  const position = stage ? STAGE_SEQUENCE.indexOf(stage) : -1;
                  const index = STAGE_SEQUENCE.indexOf(candidate);
                  const state =
                    position > index ? "done" : position === index ? "active" : "waiting";

                  return (
                    <li
                      key={candidate}
                      className={cn(
                        "flex gap-3 border-l-2 py-3 pl-4",
                        state === "active"
                          ? "border-[#454a9f]"
                          : state === "done"
                          ? "border-[#9ec2ab]"
                          : "border-[#e4dfd5]"
                      )}
                    >
                      <span className="mt-0.5 shrink-0">
                        {state === "done" ? (
                          <Check className="h-4 w-4 text-[#356449]" />
                        ) : state === "active" ? (
                          <Loader2 className="h-4 w-4 animate-spin text-[#454a9f] motion-reduce:animate-none" />
                        ) : (
                          <span className="block h-4 w-4 rounded-full border border-[#d9d4c8]" />
                        )}
                      </span>
                      <span>
                        <span
                          className={cn(
                            "block text-sm font-semibold",
                            state === "waiting" ? "text-[#8d887e]" : "text-[#292b4c]"
                          )}
                        >
                          {STAGE_COPY[candidate].label}
                        </span>
                        {state !== "waiting" && (
                          <span className="mt-0.5 block text-xs leading-5 text-[#625f58]">
                            {STAGE_COPY[candidate].detail}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {phase === "done" && result && (
            <div>
              <div className="border-b border-[#ded9cd] p-6">
                <Eyebrow>
                  {result.abstained ? "Model abstained" : "Model proposal"}
                </Eyebrow>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-4xl text-[#292b4c]">
                      {result.abstained
                        ? "No confident stage"
                        : `Closest to ${result.stage}`}
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-[#555a9d]">
                      {Math.round(result.scores[result.stage] * 100)}% relative support
                      {" · "}
                      {(result.elapsed_ms / 1000).toFixed(1)}s
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between">
                  <Eyebrow>All stage scores</Eyebrow>
                  <span className="text-[10px] text-[#625f58]">
                    relative model support
                  </span>
                </div>
                <StageDistribution
                  className="mt-5 max-w-2xl"
                  scores={result.scores}
                  predictedStage={result.stage}
                />

                <div className="mt-6 border-t border-[#e8e3da] pt-5">
                  <div className="flex items-center justify-between">
                    <Eyebrow>Nearest reference photographs</Eyebrow>
                    <span className="text-[10px] text-[#625f58]">cosine similarity</span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {result.neighbours.map((neighbour, index) => (
                      <li
                        key={`${neighbour.label}-${index}`}
                        className="grid grid-cols-[88px_minmax(0,1fr)_46px] items-center gap-3"
                      >
                        <span className="flex items-center gap-2 text-sm text-[#292b4c]">
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              STAGE_SWATCH[neighbour.label]
                            )}
                          />
                          {neighbour.label}
                        </span>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#ebe7df]">
                          <div
                            className={cn("h-full rounded-full", STAGE_SWATCH[neighbour.label])}
                            // Similarities live in a narrow band near 1.0, so the bar is
                            // stretched across 0.5–1.0 to make differences legible.
                            style={{
                              width: `${Math.max(
                                4,
                                Math.min(100, (neighbour.similarity - 0.5) * 200)
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-right text-sm tabular-nums text-[#625f58]">
                          {(neighbour.similarity * 100).toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div
                  className={cn(
                    "mt-6 flex gap-2 border px-4 py-3 text-sm",
                    result.abstained
                      ? "border-[#e2bf95] bg-[#fff7e9] text-[#7d4a2f]"
                      : "border-[#cddfd4] bg-[#f3faf5] text-[#356449]"
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {result.abstained
                        ? "Support is too spread out to propose one stage"
                        : "A scientist still confirms this stage"}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-[13px] leading-5">
                      {result.review_reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <dl className="mt-6 grid gap-x-6 gap-y-3 border-t border-[#e8e3da] pt-5 text-xs sm:grid-cols-2">
                  {[
                    ["Method", result.evidence.method],
                    [
                      "Reference library",
                      `${result.evidence.reference_count} nearest of the ${
                        result.evidence.reference_source === "database"
                          ? "live library"
                          : "bundled bank"
                      }`,
                    ],
                    [
                      "Nearest match",
                      `${(result.evidence.nearest_similarity * 100).toFixed(1)}%`,
                    ],
                    [
                      "Margin over runner-up",
                      `${(result.evidence.margin * 100).toFixed(1)} points`,
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="font-bold uppercase tracking-[0.13em] text-[#68645d]">
                        {label}
                      </dt>
                      <dd className="mt-1 text-[#292b4c]">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={reset}
                    className="flex items-center gap-2 border border-[#ded9cd] px-4 py-2 text-sm font-semibold text-[#292b4c] hover:bg-[#fbfaf7]"
                  >
                    <RotateCcw className="h-4 w-4" /> Analyze another
                  </button>
                  {result.id && (
                    <button
                      type="button"
                      onClick={copyPermalink}
                      className="flex items-center gap-2 border border-[#ded9cd] px-4 py-2 text-sm font-semibold text-[#292b4c] hover:bg-[#fbfaf7]"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 text-[#356449]" /> Link copied
                        </>
                      ) : (
                        <>
                          <LinkIcon className="h-4 w-4" /> Copy link to this result
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 border border-[#ded9cd] bg-white">
        <div className="flex gap-3 border-b border-[#ded9cd] bg-[#f3faf5] p-5 text-[#356449]">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">
              Proof of concept, scoped to white-coated mice.
            </p>
            <p className="mt-1 text-sm leading-6">
              Within that scope the guarded binary model reaches 66 of 76 on the sealed
              public test, ahead of the paper&apos;s own 63 of 76, at ROC-AUC 0.914.
              Everything below holds each mouse out of its own training set — an
              image-level split leaks and inflates the same data to 53.3%.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <caption className="mb-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-[#68645d]">
              Held out by mouse · balanced accuracy
            </caption>
            <thead>
              <tr className="border-b border-[#ded9cd] text-left text-[11px] uppercase tracking-[0.1em] text-[#68645d]">
                <th className="pb-2 font-bold">Coat</th>
                <th className="pb-2 font-bold">Photographs</th>
                <th className="pb-2 font-bold">Method</th>
                <th className="pb-2 text-right font-bold">Binary</th>
                <th className="pb-2 text-right font-bold">Four-stage</th>
              </tr>
            </thead>
            <tbody className="text-[#292b4c]">
              {[
                {
                  coat: "White",
                  data: "Public sealed test",
                  method: "DINOv2 eight-head ensemble",
                  binary: "86.8%",
                  four: "not yet built",
                  tone: "in-scope" as const,
                },
                {
                  coat: "Dark",
                  data: "222 whole-animal · 11 mice",
                  method: "DINOv2-base + logistic",
                  binary: "55.2%",
                  four: "28.2%",
                  tone: "future" as const,
                },
                {
                  coat: "Dark",
                  data: "222 whole-animal · 11 mice",
                  method: "BioCLIP + similarity k-NN",
                  binary: "—",
                  four: "27.7%",
                  tone: "future" as const,
                },
                {
                  coat: "Dark",
                  data: "56 tight ROI · 14 mice",
                  method: "DINOv2-base + logistic",
                  binary: "51.7%",
                  four: "22.8%",
                  tone: "future" as const,
                },
              ].map((row) => (
                <tr
                  key={row.coat + row.data + row.method}
                  className={cn(
                    "border-b border-[#f0ece3]",
                    row.tone === "in-scope" ? "bg-[#f3faf5]" : "text-[#6f6b64]"
                  )}
                >
                  <td className="py-2 pr-4">
                    <span
                      className={cn(
                        "inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]",
                        row.tone === "in-scope"
                          ? "bg-[#dcece2] text-[#2f5a41]"
                          : "bg-[#efece5] text-[#68645d]"
                      )}
                    >
                      {row.coat}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{row.data}</td>
                  <td className="py-2 pr-4 text-[#625f58]">{row.method}</td>
                  <td
                    className={cn(
                      "py-2 text-right tabular-nums",
                      row.tone === "in-scope" && "font-semibold text-[#292b4c]"
                    )}
                  >
                    {row.binary}
                  </td>
                  <td className="py-2 text-right tabular-nums">{row.four}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-5 grid gap-5 border-t border-[#e8e3da] pt-5 md:grid-cols-2">
            <div>
              <Eyebrow>Where the concept stands</Eyebrow>
              <p className="mt-2 text-sm leading-6 text-[#625f58]">
                On white mice the binary task — proestrus-or-estrus against
                metestrus-or-diestrus — is reproduced and slightly improved over the
                published baseline, with guards that abstain rather than guess when a
                photograph sits outside the reference set. That is the claim this demo
                makes, and no more than that.
              </p>
            </div>
            <div>
              <Eyebrow>What expansion needs</Eyebrow>
              <p className="mt-2 text-sm leading-6 text-[#625f58]">
                The greyed rows are the next frontier, not a verdict on the method. Dark
                coats sit near chance under both backbones and both framings, so the
                limit is data rather than architecture: cytology-grounded labels across
                more coat colours and more mice. Chance is 50% binary and 25% four-stage.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
