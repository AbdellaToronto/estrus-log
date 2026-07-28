"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, FileImage, FlaskConical, Loader2, Plus, Sparkles, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_IMAGE, DEMO_SUBJECTS, DEMO_TODAY } from "@/lib/supervisor-demo-data";
import { cn } from "@/lib/utils";

type DemoBatchItem = {
  id: string;
  filename: string;
  imageUrl: string;
  subjectId: string;
  lead?: "Early group" | "Late group" | "Needs review";
  stage?: string;
  confirmed: boolean;
};

const STAGES = ["Proestrus", "Estrus", "Metestrus", "Diestrus", "Uncertain / transition"];

const initialItems = (): DemoBatchItem[] => DEMO_SUBJECTS.slice(0, 8).map((subject, index) => ({
  id: `demo-capture-${index + 1}`,
  filename: `${subject.name.toLowerCase()}_2026-07-19_external.png`,
  imageUrl: DEMO_IMAGE,
  subjectId: subject.id,
  confirmed: false,
}));

export function BatchLabClient() {
  const [items, setItems] = useState<DemoBatchItem[]>(initialItems);
  const [selectedId, setSelectedId] = useState<string>("demo-capture-1");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const selected = items.find((item) => item.id === selectedId) || items[0];
  const selectedSubject = DEMO_SUBJECTS.find((subject) => subject.id === selected?.subjectId);
  const analyzedCount = items.filter((item) => item.lead).length;
  const confirmedCount = items.filter((item) => item.confirmed).length;
  const isComplete = items.length > 0 && confirmedCount === items.length;

  const analyzeBatch = () => {
    setIsAnalyzing(true);
    setSessionSaved(false);
    window.setTimeout(() => {
      setItems((current) => current.map((item, index) => ({
        ...item,
        lead: index % 7 === 0 ? "Needs review" : index % 2 === 0 ? "Early group" : "Late group",
      })));
      setIsAnalyzing(false);
    }, 650);
  };

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const additions = Array.from(files).filter((file) => file.type.startsWith("image/")).map((file, index) => ({
      id: `local-capture-${Date.now()}-${index}`,
      filename: file.name,
      imageUrl: URL.createObjectURL(file),
      subjectId: DEMO_SUBJECTS[(items.length + index) % DEMO_SUBJECTS.length].id,
      confirmed: false,
    }));
    if (!additions.length) return;
    setItems((current) => [...current, ...additions]);
    setSelectedId(additions[0].id);
    setSessionSaved(false);
  };

  const updateSelected = (patch: Partial<DemoBatchItem>) => {
    if (!selected) return;
    setItems((current) => current.map((item) => item.id === selected.id ? { ...item, ...patch } : item));
    setSessionSaved(false);
  };

  const subjectName = (subjectId: string) => DEMO_SUBJECTS.find((subject) => subject.id === subjectId)?.name || "Unassigned";
  const reviewHint = useMemo(() => selected?.lead === "Early group" ? "The reference lead narrows this review to proestrus or estrus. You still choose the saved stage." : selected?.lead === "Late group" ? "The reference lead narrows this review to metestrus or diestrus. You still choose the saved stage." : "This example deliberately abstains. Review the photo and choose a stage without a model lead.", [selected?.lead]);

  return (
    <main className="min-h-screen bg-[#f7f4ed] text-[#292b4c]">
      <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
        <nav className="flex items-center gap-2 text-xs font-medium text-[#77736c]"><Link href="/cohort-lab" className="inline-flex items-center gap-1 hover:text-[#454a9f]"><ArrowLeft className="h-3.5 w-3.5" /> Cohort</Link><span>/</span><span>Batch capture</span></nav>
        <header className="mt-5 grid gap-6 border-b border-[#ded9cd] pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="page-eyebrow">Supervisor demo · capture session</p>
            <h1 className="mt-2 font-serif text-4xl tracking-tight text-[#292b4c] sm:text-5xl">Review a batch without losing the scientist in the queue.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#625f58]">Eight public-reference examples are ready below. Add your own images to this browser, run a clearly labelled demonstration analysis, then confirm every saved stage.</p>
          </div>
          <div className="border border-[#b8b7e1] bg-[#eeedf9] px-4 py-3 text-right"><p className="text-2xl font-semibold text-[#30345f]">{confirmedCount} / {items.length}</p><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5e5d75]">stages confirmed</p></div>
        </header>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border border-[#ded9cd] bg-[#fbfaf7] p-4">
              <div><p className="text-sm font-semibold text-[#292b4c]">{items.length} photographs · {DEMO_TODAY}</p><p className="mt-1 text-xs text-[#77736c]">{analyzedCount ? `${analyzedCount} suggestions ready for review` : "Ready to run the demo analysis"}</p></div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 border border-[#b8b7e1] bg-white px-3 text-sm font-semibold text-[#353a87] hover:bg-[#eeedf9]"><Plus className="h-4 w-4" />Add photos<input className="sr-only" type="file" accept="image/*" multiple onChange={(event) => addFiles(event.target.files)} /></label>
                <Button onClick={analyzeBatch} disabled={isAnalyzing || items.length === 0} className="h-10 bg-[#454a9f] text-white hover:bg-[#383d89]" data-testid="analyze-batch">{isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{isAnalyzing ? "Reviewing images…" : analyzedCount ? "Re-run demo analysis" : "Analyze batch"}</Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="batch-item-grid">
              {items.map((item) => {
                const subject = subjectName(item.subjectId);
                return <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} aria-pressed={selected?.id === item.id} className={cn("group overflow-hidden border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#454a9f]", selected?.id === item.id ? "border-[#454a9f] ring-1 ring-[#454a9f]" : "border-[#ded9cd]") }>
                  <div className="relative aspect-[4/3] bg-[#f0ede5]"><img src={item.imageUrl} alt={`External photo for ${subject}`} className="h-full w-full object-contain p-2" />{item.confirmed ? <span className="absolute right-2 top-2 inline-flex items-center gap-1 bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800"><Check className="h-3 w-3" />Confirmed</span> : item.lead ? <span className={cn("absolute right-2 top-2 px-2 py-1 text-[10px] font-semibold", item.lead === "Needs review" ? "bg-amber-100 text-amber-800" : "bg-[#eeedf9] text-[#454a9f]")}>{item.lead === "Needs review" ? "No lead" : item.lead}</span> : <span className="absolute right-2 top-2 bg-[#f0ede5] px-2 py-1 text-[10px] font-semibold text-[#625f58]">Ready</span>}</div>
                  <div className="p-3"><p className="truncate text-sm font-semibold text-[#292b4c]">{subject}</p><p className="mt-1 truncate text-xs text-[#77736c]">{item.filename}</p><p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#454a9f]">Review image <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></p></div>
                </button>;
              })}
            </div>
          </section>

          <aside className="border border-[#ded9cd] bg-[#fbfaf7] p-5 xl:sticky xl:top-5 xl:h-fit" aria-live="polite">
            {selected ? <>
              <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#77736c]">Image review</p><h2 className="mt-2 font-serif text-3xl text-[#292b4c]">{selectedSubject?.name}</h2><p className="mt-1 text-xs text-[#77736c]">{selected.filename}</p></div><FileImage className="h-7 w-7 text-[#454a9f]" /></div>
              <div className="mt-5 overflow-hidden border border-[#ded9cd] bg-white"><img src={selected.imageUrl} alt={`Selected external photo for ${selectedSubject?.name}`} className="max-h-72 w-full object-contain p-3" /></div>
              <label className="mt-4 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#77736c]">Assign subject<select aria-label="Assign subject" value={selected.subjectId} onChange={(event) => updateSelected({ subjectId: event.target.value })} className="mt-2 h-10 w-full border border-[#ded9cd] bg-white px-3 text-sm font-normal normal-case tracking-normal text-[#292b4c]">{DEMO_SUBJECTS.map((subject) => <option key={subject.id} value={subject.id}>{subject.name} · {subject.strain}</option>)}</select></label>
              {selected.lead ? <div className={cn("mt-4 border p-4 text-sm leading-6", selected.lead === "Needs review" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-[#c9c7e7] bg-[#eeedf9] text-[#454a9f]")}><div className="flex items-center gap-2 font-semibold"><FlaskConical className="h-4 w-4" />{selected.lead === "Needs review" ? "No model lead" : `Demo lead · ${selected.lead}`}</div><p className="mt-2">{reviewHint}</p></div> : <div className="mt-4 border border-dashed border-[#cfc9bd] bg-white p-4 text-sm text-[#625f58]">Run the demo analysis to reveal a review lead or an abstention.</div>}
              <fieldset disabled={!selected.lead} className="mt-5"><legend className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#77736c]">Scientist&apos;s saved stage</legend><div className="mt-2 grid grid-cols-2 gap-2">{STAGES.map((stage) => <button key={stage} type="button" onClick={() => updateSelected({ stage, confirmed: false })} className={cn("min-h-12 border px-3 text-left text-xs font-semibold transition", selected.stage === stage ? "border-[#454a9f] bg-[#eeedf9] text-[#353a87]" : "border-[#ded9cd] bg-white text-[#625f58] hover:border-[#b8b7e1]", stage === "Uncertain / transition" && "col-span-2")}>{stage}</button>)}</div></fieldset>
              <Button onClick={() => updateSelected({ confirmed: true })} disabled={!selected.stage || !selected.lead} className="mt-4 w-full bg-[#454a9f] text-white hover:bg-[#383d89]"><Check className="mr-2 h-4 w-4" />{selected.confirmed ? "Stage confirmed" : "Confirm saved stage"}</Button>
            </> : <div className="py-20 text-center text-sm text-[#625f58]">Choose an image to begin review.</div>}
          </aside>
        </div>

        <footer className="mt-6 flex flex-col gap-3 border-t border-[#ded9cd] pt-6 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-xs leading-5 text-[#77736c]">This is a browser-only demonstration. Added photos remain in this browser, and the analysis leads are illustrative—not a hosted production model or a saved lab record.</p><Button onClick={() => setSessionSaved(true)} disabled={!isComplete} className="bg-[#292b4c] text-white hover:bg-[#171936]">{sessionSaved ? <Check className="mr-2 h-4 w-4" /> : <UploadCloud className="mr-2 h-4 w-4" />}{sessionSaved ? "Demo session saved locally" : `Save ${items.length}-image session`}</Button></footer>
        {sessionSaved && <p role="status" className="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">All {items.length} stages are confirmed. The demo session is saved locally in this browser view.</p>}
      </div>
    </main>
  );
}
