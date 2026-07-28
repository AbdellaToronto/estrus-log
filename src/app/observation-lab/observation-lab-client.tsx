"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, FilePlus2 } from "lucide-react";
import { EstrusIcon } from "@/components/estrus-icon";
import { PreparedRoiCropper } from "@/components/prepared-roi-cropper";
import { PredictionSummary } from "@/components/prediction/prediction-summary";
import type { ClassificationResult } from "@/lib/classification";

const DEMO_PREDICTION: ClassificationResult = {
  estrus_stage: "Estrus",
  confidence_scores: {
    Proestrus: 0.22,
    Estrus: 0.61,
    Metestrus: 0.1,
    Diestrus: 0.07,
  },
  features: {
    opening: "Open",
    color: "Pink",
    swelling: "Pronounced",
    moistness: "Moist",
  },
  reasoning: "The exact-stage model gives the strongest relative support to estrus.",
  review_required: false,
  review_reasons: [],
  model_version: "illustrative-four-stage-review-v1",
};

const stages = [
  { label: "Proestrus", note: "early group", color: "#ece6f7" },
  { label: "Estrus", note: "early group", color: "#f1d7dc" },
  { label: "Metestrus", note: "late group", color: "#f1e7d4" },
  { label: "Diestrus", note: "late group", color: "#dce8ee" },
  { label: "Uncertain / transition", note: "note required", color: "#eceae4" },
];

export function ObservationLabClient() {
  const searchParams = useSearchParams();
  const subjectName = searchParams.get("subject") || "AH09";
  const [stage, setStage] = useState("");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [paired, setPaired] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingStage, setEditingStage] = useState(false);
  const [demoFile, setDemoFile] = useState<File | null>(null);

  useEffect(() => {
    let active = true;
    void fetch('/assets/generated/observation-lab/public-prepared-roi.png')
      .then((response) => response.blob())
      .then((blob) => {
        if (active) setDemoFile(new File([blob], 's-biad2395-public-test-roi.png', { type: blob.type || 'image/png' }));
      });
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f4ed] text-[#292b4c]">
      <div className="mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[152px_minmax(0,1fr)]">
        <aside className="border-b border-[#ded9cd] bg-[#f3efe6] px-5 py-7 lg:border-b-0 lg:border-r">
          <a href="/workflow-lab" className="flex items-center gap-2 text-xs text-[#5f5c56]"><ArrowLeft className="h-3.5 w-3.5" /> Journey map</a>
          <div className="mt-8 font-serif text-2xl tracking-[-0.05em] text-[#30345f]">Estrus</div>
          <div className="mt-12 space-y-4"><EstrusIcon name="notes" className="h-7 w-7" /><EstrusIcon name="microscope" className="h-7 w-7" /><EstrusIcon name="evidence" className="h-7 w-7" /></div>
          <p className="mt-20 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#625f58]">Research workspace</p>
        </aside>

        <section className="px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-[#ded9cd] pb-7">
            <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#625f58]">Lab / North colony / Mouse {subjectName}</p>
              <h1 className="mt-3 font-serif text-4xl tracking-[-0.06em] text-[#292b4c] sm:text-5xl">AI prediction review</h1>
              <p className="mt-2 text-sm text-[#5f5c56]">External photo · public test ROI · framing confirmed</p>
            </div>
            <div data-testid="observation-stepper" className="flex items-center gap-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
              <span className="text-[#5f5c56]">01 Capture</span><span className="h-px w-6 bg-[#cfc9bc]" /><span className={!stage ? "text-[#454a9f]" : "text-[#5f5c56]"}>02 Review</span><span className="h-px w-6 bg-[#cfc9bc]" /><span className={stage ? "text-[#9c452f]" : "text-[#625f58]"}>03 Confirm</span>
            </div>
          </header>

          <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,0.94fr)_minmax(420px,1.06fr)]">
            <div className="space-y-5">
              <section data-testid="observation-image-panel">
                <div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#625f58]">External photo</p><h2 className="mt-2 font-serif text-2xl">Prepared model ROI</h2></div><span className="text-xs text-[#5f5c56]">S-BIAD2395 · test image</span></div>
                <div className="mt-4">{demoFile ? <PreparedRoiCropper file={demoFile} onPrepared={() => undefined} onFramingChange={() => { setAcknowledged(false); setSaved(false); }} /> : <div className="min-h-[420px] animate-pulse border border-[#ded9cd] bg-[#e9e4d9]" aria-label="Loading ROI preparation tool" />}</div>
              </section>
              <label className="block border border-[#ded9cd] bg-[#fbfaf7] p-4">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#625f58]">Observation note <span className="font-normal">(optional)</span></span>
                <textarea defaultValue="External photo is clear and centered." className="mt-3 min-h-24 w-full resize-none border border-[#ded9cd] bg-[#f7f4ed] p-3 text-sm leading-6 outline-none focus:border-[#454a9f]" aria-label="Observation note" />
              </label>
            </div>

            <div className="space-y-5">
              <div data-testid="model-suggestion-panel">
                <PredictionSummary
                  result={DEMO_PREDICTION}
                  selectedStage={stage}
                  onAccept={() => {
                    setStage(DEMO_PREDICTION.estrus_stage);
                    setEditingStage(false);
                    setAcknowledged(false);
                    setSaved(false);
                  }}
                  onCorrect={() => setEditingStage(true)}
                />
              </div>

              {editingStage && <fieldset className="space-y-3 border border-[#454a9f] bg-[#fbfaf7] p-4">
                <legend className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#454a9f]">Scientist correction</legend>
                <div className="flex items-center justify-between gap-3"><h2 className="font-serif text-xl">Choose a different stage</h2><span className="text-xs text-[#5f5c56]">The override is retained</span></div>
                <div className="grid grid-cols-2 gap-2">
                  {stages.map((item) => <button key={item.label} type="button" aria-pressed={stage === item.label} onClick={() => { setStage(item.label); setEditingStage(false); setAcknowledged(false); setSaved(false); }} className={`min-h-16 border p-3 text-left transition-colors ${item.label === "Uncertain / transition" ? "col-span-2" : ""}`} style={{ background: stage === item.label ? item.color : "#ffffff", borderColor: stage === item.label ? "#454a9f" : "#ded9cd" }}><span className="flex items-center justify-between text-sm font-semibold">{item.label}{stage === item.label && <Check className="h-4 w-4 text-[#454a9f]" />}</span><span className="mt-1 block text-xs text-[#5f5c56]">{item.note}</span></button>)}
                </div>
              </fieldset>}

              <fieldset data-testid="paired-cytology-panel" className="space-y-3 border border-[#ded9cd] bg-[#fbfaf7] p-4">
                <legend className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#625f58]">Confirmation source</legend>
                <label className={`flex cursor-pointer items-start gap-3 border p-3 text-sm ${!paired ? "border-[#454a9f] bg-white" : "border-[#ded9cd]"}`}><input type="radio" checked={!paired} onChange={() => { setPaired(false); setAcknowledged(false); setSaved(false); }} className="mt-0.5" /><span><span className="block font-medium">Scientist visual review</span><span className="mt-1 block text-xs text-[#5f5c56]">Valid observation; not cytology-grounded.</span></span></label>
                <label className={`flex cursor-pointer items-start gap-3 border p-3 text-sm ${paired ? "border-[#454a9f] bg-[#eeedf9]" : "border-[#ded9cd]"}`}><input type="radio" checked={paired} onChange={() => { setPaired(true); setAcknowledged(false); setSaved(false); }} className="mt-0.5" /><span><span className="block font-medium">Paired vaginal cytology</span><span className="mt-1 block text-xs text-[#5f5c56]">Link the smear used for this decision.</span></span><EstrusIcon name="paired-images" className="ml-auto h-9 w-9 shrink-0" /></label>
                {paired && <button type="button" className="inline-flex items-center gap-2 border border-[#b8b7e1] bg-[#eeedf9] px-3 py-2 text-xs font-semibold text-[#454a9f]"><FilePlus2 className="h-3.5 w-3.5" />Cytology linked · {subjectName}-2026-07-19-A</button>}
              </fieldset>

              <details data-testid="model-evidence-disclosure" open={evidenceOpen} onToggle={(event) => setEvidenceOpen(event.currentTarget.open)} className="border border-[#ded9cd] bg-[#fbfaf7] p-4 text-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-[#454a9f]">Why this result?<ChevronDown className={`h-4 w-4 transition-transform ${evidenceOpen ? "rotate-180" : ""}`} /></summary>
                <div className="mt-4 space-y-4 border-t border-[#ded9cd] pt-4 text-xs leading-5 text-[#5f5c56]">
                  <section data-testid="legacy-four-stage-disclosure"><p className="font-semibold uppercase tracking-[0.14em] text-[#454a9f]">Exact-stage model proposal</p><p className="mt-2"><span className="font-semibold text-[#292b4c]">Estrus · 61% relative support</span> · all four stage scores remain attached to the review.</p><p className="mt-1 font-mono">illustrative-four-stage-review-v1</p></section>
                  <section className="border-t border-[#ded9cd] pt-4"><p className="font-semibold uppercase tracking-[0.14em] text-[#625f58]">Independent guardrail</p><p className="mt-2">Early-cycle family agrees · dark-coat stable · within reference and acquisition ranges.</p></section>
                </div>
              </details>

              <label className="flex cursor-pointer items-start gap-3 border border-[#d8b28d] bg-[#fff4df] p-3 text-sm text-[#64432d]"><input type="checkbox" disabled={!stage} checked={acknowledged} onChange={(event) => { setAcknowledged(event.target.checked); setSaved(false); }} className="mt-0.5" /><span>I reviewed this image and want to save <strong>{stage || "the selected stage"}</strong> as the lab record.</span></label>
              <button type="button" disabled={!stage || !acknowledged} onClick={() => setSaved(true)} className="flex w-full items-center justify-center gap-2 bg-[#454a9f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#383d89] disabled:cursor-not-allowed disabled:opacity-40"><EstrusIcon name="confirm" className="h-6 w-6" />{saved ? `Saved as ${stage}` : "Save confirmed stage"}</button>
              {saved && <p role="status" className="text-center text-xs text-[#454a9f]">Confirmed locally · evidence attached to the lab record</p>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
