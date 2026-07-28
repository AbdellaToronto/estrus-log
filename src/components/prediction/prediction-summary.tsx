"use client";

import { AlertTriangle, Check, ShieldCheck } from "lucide-react";
import { StageDistribution } from "@/components/prediction/stage-distribution";
import {
  getPrimaryStageConfidence,
  getPrimaryStageName,
  needsCloserPredictionReview,
  type ClassificationResult,
} from "@/lib/classification";
import { cn } from "@/lib/utils";

function binaryGuardrailLabel(result: ClassificationResult) {
  const binary = result.evidence?.external_binary;
  if (!binary) return null;
  if (binary.decision_status === "abstain") {
    return {
      icon: AlertTriangle,
      title: "Guardrail withheld its vote",
      description: "The image is outside the binary model's reliable reference range.",
      tone: "border-[#e2bf95] bg-[#fff7e9] text-[#7d4a2f]",
    };
  }

  const agreement = result.evidence?.external_binary_agrees_with_stage_group;
  const group =
    binary.reference_backed_binary_suggestion === "PROESTRUS_OR_ESTRUS"
      ? "early-cycle"
      : "late-cycle";
  return {
    icon: agreement === false ? AlertTriangle : ShieldCheck,
    title: agreement === false ? `The ${group} guardrail disagrees` : `The ${group} guardrail agrees`,
    description:
      agreement === false
        ? "Inspect this prediction before accepting it."
        : "An independently evaluated two-group model supports this stage family.",
    tone:
      agreement === false
        ? "border-[#e2bf95] bg-[#fff7e9] text-[#7d4a2f]"
        : "border-[#cddfd4] bg-[#f3faf5] text-[#356449]",
  };
}

export function PredictionSummary({
  result,
  selectedStage,
  onAccept,
  onCorrect,
  busy = false,
  className,
}: {
  result: ClassificationResult;
  selectedStage?: string;
  onAccept?: () => void;
  onCorrect?: () => void;
  busy?: boolean;
  className?: string;
}) {
  const stage = getPrimaryStageName(result);
  const support = getPrimaryStageConfidence(result);
  const guardrail = binaryGuardrailLabel(result);
  const needsCloserReview = needsCloserPredictionReview(result);
  const GuardrailIcon = guardrail?.icon;

  if (!stage) return null;

  return (
    <section
      className={cn("border border-[#c9c7e7] bg-[#fbfaff]", className)}
      aria-labelledby="ai-prediction-heading"
    >
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#595ea3]">
            AI stage prediction
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
            <h2 id="ai-prediction-heading" className="font-serif text-3xl text-[#292b4c] sm:text-4xl">
              {stage}
            </h2>
            <p className="pb-1 text-sm font-semibold text-[#555a9d]">
              {Math.round(support * 100)}% model support
            </p>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625f58]">
            This is the model&apos;s proposed four-stage record. Review the image and context, then accept it or correct it.
          </p>

          {needsCloserReview && result.review_reasons?.length ? (
            <p className="mt-3 text-xs leading-5 text-[#8a5737]">
              Needs attention: {result.review_reasons.filter((reason) => !/human confirmation is required|until this classifier is validated/i.test(reason)).join(" · ")}
            </p>
          ) : null}

          {guardrail && GuardrailIcon && (
            <div className={cn("mt-5 flex gap-3 border p-3.5", guardrail.tone)}>
              <GuardrailIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">{guardrail.title}</p>
                <p className="mt-0.5 text-xs leading-5 opacity-85">{guardrail.description}</p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[#ded9ed] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#625f58]">All stage scores</p>
            <span className="text-[10px] text-[#625f58]">relative support</span>
          </div>
          <StageDistribution scores={result.confidence_scores} predictedStage={stage} />
        </div>
      </div>

      {(onAccept || onCorrect) && (
        <div className="flex flex-col gap-2 border-t border-[#ded9ed] bg-white p-4 sm:flex-row sm:items-center sm:justify-end">
          {onCorrect && (
            <button
              type="button"
              onClick={onCorrect}
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center border border-[#cbc6bb] bg-white px-5 text-sm font-semibold text-[#45413c] hover:bg-[#f6f3ec] disabled:opacity-50"
            >
              Correct prediction
            </button>
          )}
          {onAccept && (
            <button
              type="button"
              onClick={onAccept}
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#454a9f] px-6 text-sm font-semibold text-white hover:bg-[#383d89] disabled:opacity-50"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {`Accept ${stage}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
