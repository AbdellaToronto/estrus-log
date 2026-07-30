"use client";

/**
 * Evaluate a batch of photographs in one pass.
 *
 * One upload shows the pipeline works. A batch shows whether it is any use,
 * because it surfaces the two things a single photograph cannot: how often the
 * guards decline, and how often the calls that survive are right.
 *
 * Where the filename carries the lab's own stage convention the batch is scored
 * against it, which turns the demo into a small evaluation harness rather than a
 * toy. Nothing is written to any record.
 */

import { useCallback, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Play, Upload, X } from "lucide-react";
import {
  groupForStage,
  percent,
  stageFromFilename,
  summarise,
  type BulkRow,
} from "@/lib/bulk-eval";
import type { ClassificationStage } from "@/lib/classification";
import { DEMO_SAMPLES, SAMPLE_BASE_PATH, sampleTruth } from "@/lib/demo-samples";
import { cn } from "@/lib/utils";

const MAX_FILES = 40;
const MAX_BYTES = 10 * 1024 * 1024;
/** The encoder and the ensemble are both GPU-backed; a few at a time keeps the
 *  batch moving without queueing requests that will time out waiting. */
const CONCURRENCY = 3;

const SHORT_GROUP: Record<string, string> = {
  PROESTRUS_OR_ESTRUS: "Pro / Est",
  METESTRUS_OR_DIESTRUS: "Met / Die",
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#68645d]">
      {children}
    </p>
  );
}

export function BulkEvaluation() {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);
  const cancelled = useRef(false);

  const summary = summarise(rows);

  const reset = useCallback(() => {
    cancelled.current = true;
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current = [];
    setRows([]);
    setRunning(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const analyseOne = useCallback(async (file: File, id: string) => {
    const update = (patch: Partial<BulkRow>) =>
      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, ...patch } : row))
      );

    update({ status: "running" });
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/analyze", { method: "POST", body });
      if (!response.ok || !response.body) {
        update({ status: "error", error: `Request failed (${response.status})` });
        return;
      }

      // The route streams stage events then a result; only the result matters here.
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
          if (payload.event === "result") {
            const binary = payload.binary as Record<string, unknown> | null;
            update({
              status: "done",
              group: (binary?.group as BulkRow["group"]) ?? null,
              rawSuggestion: binary?.raw_suggestion as BulkRow["rawSuggestion"],
              probabilityProestrusOrEstrus:
                binary?.probability_proestrus_or_estrus as number | undefined,
              outOfReference: Boolean(binary?.out_of_reference),
              acquisitionOutOfRange: Boolean(binary?.acquisition_out_of_range),
              darkCoatAgrees: binary?.dark_coat_agrees as boolean | undefined,
              referenceStage: payload.stage as ClassificationStage,
              elapsedMs: payload.elapsed_ms as number,
            });
            settled = true;
          } else if (payload.event === "error") {
            update({ status: "error", error: String(payload.error) });
            settled = true;
          }
        }
      }
      if (!settled) update({ status: "error", error: "Stream ended with no result" });
    } catch {
      update({ status: "error", error: "Could not reach the analysis service" });
    }
  }, []);

  const start = useCallback(
    async (files: File[]) => {
      const usable = files
        .filter((file) => file.type.startsWith("image/") && file.size <= MAX_BYTES)
        .slice(0, MAX_FILES);
      if (usable.length === 0) return;

      cancelled.current = false;
      const queued: BulkRow[] = usable.map((file, index) => {
        const url = URL.createObjectURL(file);
        objectUrls.current.push(url);
        return {
          id: `${Date.now()}-${index}`,
          filename: file.name,
          previewUrl: url,
          status: "queued",
          // Filename convention first, then the bundled samples, whose truth
          // comes from the released archive rather than from their names.
          truth: stageFromFilename(file.name) ?? sampleTruth(file.name)?.stage ?? null,
        };
      });

      setRows(queued);
      setRunning(true);

      // A small worker pool: each worker pulls the next index until the queue
      // is empty, so a slow photograph does not stall the ones behind it.
      let cursor = 0;
      const worker = async () => {
        while (!cancelled.current) {
          const index = cursor;
          cursor += 1;
          if (index >= usable.length) return;
          await analyseOne(usable[index], queued[index].id);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, usable.length) }, worker)
      );
      setRunning(false);
    },
    [analyseOne]
  );

  /** Run the bundled set. Most visitors have no mouse photographs to hand, so
   *  the demo has to be able to demonstrate itself. */
  const runSamples = useCallback(async () => {
    const files = await Promise.all(
      DEMO_SAMPLES.map(async (sample) => {
        const response = await fetch(`${SAMPLE_BASE_PATH}/${sample.file}`);
        const blob = await response.blob();
        return new File([blob], sample.file, { type: blob.type || "image/png" });
      })
    );
    await start(files);
  }, [start]);

  const done = rows.length > 0 && !running;
  const progress = rows.length
    ? Math.round(((summary.analysed + summary.failed) / rows.length) * 100)
    : 0;

  return (
    <section className="mt-5 border border-[#ded9cd] bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#ded9cd] p-6">
        <div>
          <Eyebrow>Batch · live inference</Eyebrow>
          <h2 className="mt-2 font-serif text-3xl text-[#292b4c]">
            Evaluate a folder at once
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625f58]">
            A single photograph shows the pipeline runs. A batch shows whether it is
            useful — how often the guards decline, and how often what survives is
            right. Where a filename carries a stage the way this lab writes them, the
            batch is scored against it.
          </p>
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-2 border border-[#ded9cd] px-3 py-2 text-sm font-semibold text-[#292b4c] hover:bg-[#fbfaf7]"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="grid gap-px bg-[#ded9cd] lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          {/* Primary path: run the bundled set. Nobody arrives with mouse
              photographs, so the demo has to be able to demonstrate itself. */}
          <div className="bg-white p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Eyebrow>Ready to run · eight photographs</Eyebrow>
              <span className="text-[11px] text-[#625f58]">
                published stages, held-out split
              </span>
            </div>

            <ol className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-4 xl:grid-cols-8">
              {DEMO_SAMPLES.map((sample) => (
                <li key={sample.file} className="flex flex-col gap-1.5">
                  <div className="relative overflow-hidden border border-[#e8e3da] bg-[#ece8df]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${SAMPLE_BASE_PATH}/${sample.file}`}
                      alt={`${sample.stage} reference photograph`}
                      className="aspect-[83/128] w-full object-cover"
                    />
                  </div>
                  <span
                    className="block truncate text-[10px] font-semibold text-[#292b4c]"
                    title={`${sample.stage} · ${sample.source}`}
                  >
                    {sample.stage}
                  </span>
                </li>
              ))}
            </ol>

            <button
              type="button"
              onClick={runSamples}
              className="mt-5 inline-flex items-center gap-2 bg-[#454a9f] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#383d8a]"
            >
              <Play className="h-4 w-4" /> Run the batch
            </button>

            <p className="mt-3 max-w-xl text-[12px] leading-5 text-[#625f58]">
              Eight white-coated photographs from the held-out half of the published
              archive, matched to their source files by content hash so the stages
              below are the authors&apos; own rather than ours. The model has not seen
              any of them.
            </p>
          </div>

          {/* Secondary path: bring your own. */}
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              start(Array.from(event.dataTransfer.files));
            }}
            className={cn(
              "flex flex-col items-center justify-center p-6 text-center transition-colors",
              dragging ? "bg-[#eeedf9]" : "bg-[#fbfaf7]"
            )}
          >
            <Upload className="h-6 w-6 text-[#8d887e]" />
            <p className="mt-3 font-serif text-lg text-[#292b4c]">
              Or use your own
            </p>
            <p className="mt-1 max-w-xs text-xs leading-5 text-[#625f58]">
              Up to {MAX_FILES} photographs, {CONCURRENCY} at a time. Filenames like{" "}
              <span className="font-mono text-[11px]">AH09_2_EST.jpg</span> are read
              for their stage and scored automatically.
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-4 border border-[#ded9cd] bg-white px-4 py-2 text-sm font-semibold text-[#292b4c] hover:bg-white/60"
            >
              Choose files
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => start(Array.from(event.target.files ?? []))}
            />
            <p className="mt-3 text-[11px] leading-4 text-[#8d887e]">
              Nothing is written to any record.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="border-b border-[#ded9cd] px-6 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-[#292b4c]">
                {running
                  ? `Analysing ${summary.analysed + summary.failed} of ${rows.length}`
                  : `${rows.length} photographs analysed`}
              </span>
              <span className="tabular-nums text-[#625f58]">{progress}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#ebe7df]">
              <div
                className="h-full rounded-full bg-[#454a9f] transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {done && <SummaryStrip summary={summary} />}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#ded9cd] text-left text-[10px] uppercase tracking-[0.12em] text-[#68645d]">
                  <th className="px-6 py-3 font-bold">Photograph</th>
                  <th className="py-3 font-bold">Labelled</th>
                  <th className="py-3 font-bold">Model call</th>
                  <th className="py-3 font-bold">Guards</th>
                  <th className="px-6 py-3 text-right font-bold">Agreement</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <BulkRowView key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function SummaryStrip({ summary }: { summary: ReturnType<typeof summarise> }) {
  const cells: Array<{ label: string; value: string; detail: string; tone?: "good" | "warn" }> = [
    {
      label: "Guard-backed",
      value: `${summary.backed} / ${summary.analysed}`,
      detail: "calls the guards stood behind",
    },
    {
      label: "Not backed",
      value: String(summary.declined),
      detail:
        [
          summary.outOfReference > 0 && `${summary.outOfReference} outside the reference set`,
          summary.coatDependent > 0 && `${summary.coatDependent} coat-dependent`,
        ]
          .filter(Boolean)
          .join(" · ") || "all calls backed",
      tone: summary.declined > 0 ? "warn" : undefined,
    },
  ];

  if (summary.labelled > 0) {
    cells.push(
      {
        label: "Right when it committed",
        value: percent(summary.backedCorrect, summary.backedLabelled),
        detail: `${summary.backedCorrect} of ${summary.backedLabelled} guard-backed`,
        tone: "good",
      },
      {
        label: "Right overall",
        value: percent(summary.correct, summary.labelled),
        detail: `${summary.correct} of ${summary.labelled} labelled, ignoring guards`,
      }
    );
  } else {
    cells.push({
      label: "Scoring",
      value: "—",
      detail: "no filenames carried a stage label",
    });
  }

  return (
    <div className="grid gap-px border-b border-[#ded9cd] bg-[#ded9cd] sm:grid-cols-2 lg:grid-cols-4">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className={cn(
            "p-5",
            cell.tone === "good"
              ? "bg-[#f3faf5]"
              : cell.tone === "warn"
                ? "bg-[#fff7e9]"
                : "bg-white"
          )}
        >
          <Eyebrow>{cell.label}</Eyebrow>
          <p
            className={cn(
              "mt-1.5 font-serif text-3xl tabular-nums",
              cell.tone === "good"
                ? "text-[#2f5a41]"
                : cell.tone === "warn"
                  ? "text-[#7d4a2f]"
                  : "text-[#292b4c]"
            )}
          >
            {cell.value}
          </p>
          <p className="mt-1 text-[12px] leading-4 text-[#625f58]">{cell.detail}</p>
        </div>
      ))}
    </div>
  );
}

function BulkRowView({ row }: { row: BulkRow }) {
  const called = row.group ?? row.rawSuggestion;
  const agrees =
    row.truth && called ? called === groupForStage(row.truth) : null;

  return (
    <tr className="border-b border-[#f0ece3] align-middle">
      <td className="px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-8 shrink-0 overflow-hidden bg-[#ece8df]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={row.previewUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <span className="max-w-[15rem] truncate text-[#292b4c]" title={row.filename}>
            {row.filename}
          </span>
        </div>
      </td>

      <td className="py-3">
        {row.truth ? (
          <span className="text-[#292b4c]">{row.truth}</span>
        ) : (
          <span className="text-[#8d887e]">unlabelled</span>
        )}
      </td>

      <td className="py-3">
        {row.status === "queued" && <span className="text-[#8d887e]">queued</span>}
        {row.status === "running" && (
          <span className="flex items-center gap-2 text-[#625f58]">
            <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
            analysing
          </span>
        )}
        {row.status === "error" && (
          <span className="text-[#a8613c]">{row.error}</span>
        )}
        {row.status === "done" && (
          <span className={cn(row.group ? "font-semibold text-[#292b4c]" : "text-[#8d887e]")}>
            {row.group
              ? SHORT_GROUP[row.group]
              : `declined (${SHORT_GROUP[row.rawSuggestion ?? ""] ?? "—"})`}
          </span>
        )}
      </td>

      <td className="py-3">
        {row.status === "done" && (
          <span className="flex flex-wrap gap-1">
            {row.outOfReference && (
              <span className="bg-[#fbeee0] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7d4a2f]">
                out of reference
              </span>
            )}
            {row.acquisitionOutOfRange && (
              <span className="bg-[#fbeee0] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7d4a2f]">
                exposure
              </span>
            )}
            {/* The only guard that fires on an otherwise in-range photograph:
                the call flipped under the darkened view, so it was leaning on
                coat brightness. Without this tag a declined row looks unexplained. */}
            {row.darkCoatAgrees === false && (
              <span
                className="bg-[#efece5] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#68645d]"
                title="The call changed when the coat was synthetically darkened"
              >
                coat-dependent
              </span>
            )}
            {!row.outOfReference &&
              !row.acquisitionOutOfRange &&
              row.darkCoatAgrees !== false && (
                <span className="bg-[#dcece2] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#2f5a41]">
                  in range
                </span>
              )}
          </span>
        )}
      </td>

      <td className="px-6 py-3 text-right">
        {agrees === null ? (
          <span className="text-[#8d887e]">—</span>
        ) : agrees ? (
          <span className="inline-flex items-center gap-1 text-[#356449]">
            <Check className="h-3.5 w-3.5" /> agrees
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[#a8613c]">
            <AlertTriangle className="h-3.5 w-3.5" /> differs
          </span>
        )}
      </td>
    </tr>
  );
}

