"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CheckCircle2, Loader2, Rat, Sparkles } from "lucide-react";
import { createCohort } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PRESET_CONFIGS } from "@/lib/config-types";

type Step = "details" | "ready";

export function OnboardingFlow({
  onComplete,
  labMode = false,
}: {
  onComplete?: () => void;
  labMode?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [cohortName, setCohortName] = useState("");
  const [cohortDescription, setCohortDescription] = useState("");
  const [createdCohortId, setCreatedCohortId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const estrusPreset = PRESET_CONFIGS.estrus_tracking;

  async function createFirstCohort() {
    if (!cohortName.trim()) return;
    setIsCreating(true);
    setError("");
    try {
      if (labMode) {
        setCreatedCohortId("00000000-0000-4000-8000-000000000901");
      } else {
        const formData = new FormData();
        formData.set("name", cohortName.trim());
        formData.set("description", cohortDescription.trim());
        formData.set("type", estrusPreset.type);
        formData.set("subject_config", JSON.stringify(estrusPreset.subjectConfig));
        formData.set("log_config", JSON.stringify(estrusPreset.logConfig));
        const cohort = await createCohort(formData);
        setCreatedCohortId(cohort.id);
      }
      setStep("ready");
    } catch (cause) {
      console.error("Failed to create cohort:", cause);
      setError("The cohort could not be created. Your entries are still here; try again.");
    } finally {
      setIsCreating(false);
    }
  }

  function openCohort() {
    if (labMode) return;
    if (createdCohortId) {
      router.push(`/cohorts/${createdCohortId}#subjects`);
      return;
    }
    onComplete?.();
  }

  function returnToDashboard() {
    if (labMode) return;
    if (onComplete) onComplete();
    else router.push("/dashboard");
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-[#f7f4ed] px-4 py-6 text-[#292b4c] sm:px-6 lg:py-10">
      <div className="mx-auto flex min-h-full w-full max-w-5xl items-center justify-center">
        {step === "details" ? (
          <section className="grid w-full overflow-hidden rounded-[2rem] border border-[#ded9cd] bg-[#fbfaf7] shadow-[0_24px_80px_rgba(39,36,26,0.12)] lg:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-[#ded9cd] bg-[#eeedf9] p-6 sm:p-9 lg:border-b-0 lg:border-r lg:p-12">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a4f35]">First setup · 1 of 2</p>
              <Rat className="mt-6 h-16 w-16 text-[#454a9f]" strokeWidth={1.5} />
              <h1 className="mt-6 font-serif text-4xl tracking-[-0.04em] text-[#292b4c] sm:text-5xl">
                Name your first mouse cohort
              </h1>
              <p className="mt-4 max-w-md text-base leading-7 text-[#5e5d75]">
                A cohort connects mouse identities, analyzed photographs, AI proposals, and reviewed stage records under one protocol.
              </p>

              <div className="mt-8 border-t border-[#c9c7e7] pt-6">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#555a9d]">Already configured</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {estrusPreset.logConfig.stages.map((stage) => (
                    <span key={stage.name} className="rounded-full border border-[#c9c7e7] bg-white/70 px-2.5 py-1 text-xs font-medium text-[#353a87]">
                      {stage.name}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-[#5e5d75]">
                  Each mouse can record coat colour and strain so later model evaluation can be subgroup-aware.
                </p>
                <div className="mt-5 flex gap-3 border border-[#b8b7e1] bg-white/70 p-3 text-sm text-[#353a87]">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="leading-5">After setup, upload photographs and Estrus Log will propose exact stages for you to review.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center p-6 sm:p-9 lg:p-12">
              <div className="max-w-lg">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#66627a]">Cohort details</p>
                <h2 className="mt-2 font-serif text-3xl text-[#292b4c]">What group are you starting with?</h2>
                <p className="mt-2 text-sm leading-6 text-[#77736c]">You can add experiments and extra protocol fields later.</p>

                <div className="mt-8 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="first-cohort-name" className="font-semibold text-[#353a87]">Cohort name</Label>
                    <Input
                      id="first-cohort-name"
                      value={cohortName}
                      onChange={(event) => setCohortName(event.target.value)}
                      placeholder="e.g. Control · North colony"
                      className="h-12 rounded-xl border-[#d7d1c5] bg-white text-base"
                      autoFocus
                    />
                    <p className="text-xs text-[#77736c]">Required · use the name your team already recognizes.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="first-cohort-note" className="font-semibold text-[#353a87]">Study note <span className="font-normal text-[#77736c]">(optional)</span></Label>
                    <Textarea
                      id="first-cohort-note"
                      value={cohortDescription}
                      onChange={(event) => setCohortDescription(event.target.value)}
                      placeholder="Protocol, treatment, or housing context"
                      rows={4}
                      className="rounded-xl border-[#d7d1c5] bg-white"
                    />
                  </div>
                </div>

                {error && (
                  <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
                )}

                <Button
                  onClick={createFirstCohort}
                  disabled={!cohortName.trim() || isCreating}
                  className="mt-8 h-11 w-full bg-[#454a9f] text-white hover:bg-[#383d89] sm:w-auto"
                >
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isCreating ? "Creating cohort…" : "Create mouse cohort"}
                  {!isCreating ? <ArrowRight className="h-4 w-4" /> : null}
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <section className="w-full max-w-3xl rounded-[2rem] border border-[#ded9cd] bg-[#fbfaf7] p-6 text-center shadow-[0_24px_80px_rgba(39,36,26,0.12)] sm:p-10 lg:p-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a4f35]">First setup · 2 of 2</p>
            <div className="mx-auto mt-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#eeedf9]">
              <CheckCircle2 className="h-12 w-12 text-[#454a9f]" strokeWidth={1.6} />
            </div>
            <h1 className="mt-5 font-serif text-4xl tracking-[-0.04em] text-[#292b4c] sm:text-5xl">Cohort ready</h1>
            <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-[#77736c]">
              <strong className="text-[#292b4c]">{cohortName}</strong> is ready. Add mouse identities, then let the AI prepare the first prediction inbox.
            </p>

            <ol className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
              {[
                ["1", "Add subjects", "Mouse ID, coat colour, and strain"],
                ["2", "Analyze photos", "Single observation or a daily batch"],
                ["3", "Review predictions", "Accept, correct, or mark uncertain"],
              ].map(([number, title, description]) => (
                <li key={number} className="rounded-2xl border border-[#ded9cd] bg-[#f7f4ed] p-4">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#454a9f] text-xs font-bold text-white">{number}</span>
                  <strong className="mt-3 block text-sm text-[#292b4c]">{title}</strong>
                  <span className="mt-1 block text-xs leading-5 text-[#625f58]">{description}</span>
                </li>
              ))}
            </ol>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button onClick={openCohort} className="bg-[#454a9f] text-white hover:bg-[#383d89]">
                Add mouse subjects <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={returnToDashboard}>
                <Check className="h-4 w-4" /> Return to dashboard
              </Button>
            </div>
            <p className="mt-5 text-xs text-[#625f58]">Bulk capture appears in the cohort workspace once subject identities are available.</p>
          </section>
        )}
      </div>
    </div>
  );
}
