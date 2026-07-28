'use client';

import Image from 'next/image';
import { useEffect, useId, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ClassificationEvidence } from "@/lib/classification";
import { EstrusIcon } from "@/components/estrus-icon";
import { PreparedRoiCropper, type PreparedRoiMetadata } from "@/components/prepared-roi-cropper";
import { AlertCircle, Check, ChevronDown, ImagePlus, Loader2, RotateCcw, Upload } from "lucide-react";
import { getUploadUrl, createLog } from "@/app/actions";

const STAGES = ['Proestrus', 'Estrus', 'Metestrus', 'Diestrus'] as const;
const UNCERTAIN_STAGE = 'Uncertain / transition' as const;
const SAVED_STAGES = [...STAGES, UNCERTAIN_STAGE] as const;
const MODALITIES = {
  external_photo: 'External genital photo',
  vaginal_cytology: 'Vaginal cytology / smear',
} as const;
type ObservationModality = keyof typeof MODALITIES;
type GroundTruthSource = 'external_visual_review' | 'paired_vaginal_cytology';

const localDateKey = () => {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const stageClass: Record<string, string> = {
  Proestrus: 'stage-proestrus',
  Estrus: 'stage-estrus',
  Metestrus: 'stage-metestrus',
  Diestrus: 'stage-diestrus',
  [UNCERTAIN_STAGE]: 'stage-unknown',
};

type ClassificationResult = {
  estrus_stage: (typeof STAGES)[number];
  confidence_scores: Record<string, number>;
  features: {
    vaginal_opening: string;
    tissue_color: string;
    swelling: string;
    moisture: string;
  };
  reasoning: string;
  thoughts?: string;
  review_required?: boolean;
  review_reasons?: string[];
  evidence?: ClassificationEvidence;
  model_version?: string;
};

export function LogEntryModal({
  subjectId,
  onLogCreated,
  initialOpen = false,
}: {
  subjectId: string;
  onLogCreated: () => void;
  initialOpen?: boolean;
}) {
  const inputId = useId();
  const referenceInputId = useId();
  const [open, setOpen] = useState(initialOpen);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparedRoiFile, setPreparedRoiFile] = useState<File | null>(null);
  const [preparedRoiPreview, setPreparedRoiPreview] = useState<string | null>(null);
  const [preparedRoiMetadata, setPreparedRoiMetadata] = useState<PreparedRoiMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [manualReview, setManualReview] = useState(false);
  const [modality, setModality] = useState<ObservationModality>('external_photo');
  const [roiConfirmed, setRoiConfirmed] = useState(false);
  const [groundTruthSource, setGroundTruthSource] = useState<GroundTruthSource>('external_visual_review');
  const [cytologyReferenceFile, setCytologyReferenceFile] = useState<File | null>(null);
  const [cytologyReferencePreview, setCytologyReferencePreview] = useState<string | null>(null);
  const [referenceSampleId, setReferenceSampleId] = useState('');
  const [captureDate, setCaptureDate] = useState(localDateKey);
  const [notes, setNotes] = useState('');
  const [captureSession, setCaptureSession] = useState('');
  const [imagingDevice, setImagingDevice] = useState('');
  const [magnification, setMagnification] = useState('');
  const [stainOrPreparation, setStainOrPreparation] = useState('');
  const [confirmedStage, setConfirmedStage] = useState<string>('');
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => () => {
    if (cytologyReferencePreview) URL.revokeObjectURL(cytologyReferencePreview);
  }, [cytologyReferencePreview]);

  useEffect(() => () => {
    if (preparedRoiPreview) URL.revokeObjectURL(preparedRoiPreview);
  }, [preparedRoiPreview]);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setPreparedRoiFile(null);
    setPreparedRoiPreview(null);
    setPreparedRoiMetadata(null);
    setResult(null);
    setManualReview(false);
    setModality('external_photo');
    setRoiConfirmed(false);
    setGroundTruthSource('external_visual_review');
    setCytologyReferenceFile(null);
    setCytologyReferencePreview(null);
    setReferenceSampleId('');
    setCaptureDate(localDateKey());
    setNotes('');
    setCaptureSession('');
    setImagingDevice('');
    setMagnification('');
    setStainOrPreparation('');
    setConfirmedStage('');
    setReviewAcknowledged(false);
    setError(null);
    setLoading(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    if (!nextFile.type.startsWith('image/')) {
      setError('Choose an image file (JPG, PNG, or another supported image format).');
      return;
    }
    if (nextFile.size > 10 * 1024 * 1024) {
      setError('This image is larger than 10 MB. Choose a smaller file and try again.');
      return;
    }

    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
    setPreparedRoiFile(null);
    setPreparedRoiPreview(null);
    setPreparedRoiMetadata(null);
    setResult(null);
    setManualReview(false);
    setRoiConfirmed(false);
    setGroundTruthSource('external_visual_review');
    setCytologyReferenceFile(null);
    setCytologyReferencePreview(null);
    setReferenceSampleId('');
    setConfirmedStage('');
    setReviewAcknowledged(false);
    setError(null);
  };

  const handleCytologyReferenceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    if (!nextFile.type.startsWith('image/')) {
      setError('Choose an image file for the paired cytology reference.');
      return;
    }
    if (nextFile.size > 10 * 1024 * 1024) {
      setError('The paired cytology image is larger than 10 MB.');
      return;
    }
    setCytologyReferenceFile(nextFile);
    setCytologyReferencePreview(URL.createObjectURL(nextFile));
    setReviewAcknowledged(false);
    setError(null);
  };

  const handleClassify = async () => {
    if (!file) return;
    if (modality === 'vaginal_cytology') {
      handleManualReview();
      return;
    }
    if (!roiConfirmed || !preparedRoiFile) {
      setError('Prepare the crop and confirm that the external genital region is inside the model field.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', preparedRoiFile, preparedRoiFile.name);
      formData.append('modality', modality);
      formData.append('roi_confirmed', String(roiConfirmed));
      const response = await fetch('/api/classify', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Classification failed');
      const data = (await response.json()) as ClassificationResult;
      setResult(data);
      setManualReview(false);
      setConfirmedStage('');
      setReviewAcknowledged(false);
    } catch (caught) {
      console.error(caught);
      setError('We could not analyze this image. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualReview = () => {
    if (!file) return;
    setResult(null);
    setManualReview(true);
    setConfirmedStage('');
    setReviewAcknowledged(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!file || (!result && !manualReview) || !confirmedStage) return;
    if (confirmedStage === UNCERTAIN_STAGE && !notes.trim()) {
      setError('Add a brief observation note when saving an uncertain or transition finding.');
      return;
    }
    if (groundTruthSource === 'paired_vaginal_cytology' && !cytologyReferenceFile) {
      setError('Add the paired cytology image used to confirm this stage.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const mainUpload = await getUploadUrl(file.name, file.type);
      const roiUpload = result && modality === 'external_photo' && preparedRoiFile
        ? await getUploadUrl(`model-input-${preparedRoiFile.name}`, preparedRoiFile.type)
        : null;
      const referenceUpload = cytologyReferenceFile && groundTruthSource === 'paired_vaginal_cytology'
        ? await getUploadUrl(`cytology-reference-${cytologyReferenceFile.name}`, cytologyReferenceFile.type)
        : null;
      const uploadResponses = await Promise.all([
        fetch(mainUpload.url, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        }),
        ...(roiUpload && preparedRoiFile
          ? [fetch(roiUpload.url, {
              method: 'PUT',
              body: preparedRoiFile,
              headers: { 'Content-Type': preparedRoiFile.type },
            })]
          : []),
        ...(referenceUpload && cytologyReferenceFile
          ? [fetch(referenceUpload.url, {
              method: 'PUT',
              body: cytologyReferenceFile,
              headers: { 'Content-Type': cytologyReferenceFile.type },
            })]
          : []),
      ]);
      if (uploadResponses.some((response) => !response.ok)) throw new Error('Upload failed');

      await createLog({
        subjectId,
        stage: confirmedStage,
        confidence: result?.confidence_scores[confirmedStage] ?? 0,
        features: result?.features,
        imageUrl: mainUpload.objectUrl,
        notes,
        observationContext: {
          modality,
          captureDate,
          labelStatus: confirmedStage === UNCERTAIN_STAGE ? 'uncertain_or_transition' : 'confirmed',
          confirmationSource: groundTruthSource === 'paired_vaginal_cytology'
            ? 'paired_cytology_review'
            : 'scientist_review',
        },
        groundTruthReference: referenceUpload
          ? {
              modality: 'vaginal_cytology',
              imageUrl: referenceUpload.objectUrl,
              sampleId: referenceSampleId,
            }
          : undefined,
        captureMetadata: {
          capture_session: captureSession,
          imaging_device: imagingDevice,
          magnification,
          stain_or_preparation: stainOrPreparation,
        },
        flexibleData: {
          confidence_scores: result?.confidence_scores ?? {},
          suggested_stage: result?.estrus_stage ?? null,
          confirmed_stage: confirmedStage,
          reasoning: result?.reasoning ?? null,
          thoughts: result?.thoughts ?? null,
          review_required: Boolean(result?.review_required) || manualReview,
          review_reasons: result?.review_reasons ?? (manualReview ? ['Cytology observations require a scientist stage decision; no cytology classifier is configured.'] : []),
          evidence: result?.evidence ?? { method: 'Scientist manual review' },
          model_version: result?.model_version ?? null,
          model_input_reference: roiUpload
            ? {
                modality: 'external_photo_prepared_roi',
                image_object_reference: roiUpload.objectUrl,
                source_image_object_reference: mainUpload.objectUrl,
                crop: preparedRoiMetadata,
              }
            : null,
          ground_truth_reference: referenceUpload
            ? {
                modality: 'vaginal_cytology',
                image_object_reference: referenceUpload.objectUrl,
                sample_id: referenceSampleId.trim() || null,
                confirmed_stage: confirmedStage,
                paired_capture_date: captureDate,
              }
            : {
                modality: 'external_photo',
                confirmation_basis: 'scientist_visual_review',
              },
          observation_context: {
            modality,
            capture_date: captureDate,
            label_status: confirmedStage === UNCERTAIN_STAGE ? 'uncertain_or_transition' : 'confirmed',
            confirmation_source: groundTruthSource === 'paired_vaginal_cytology'
              ? 'paired_cytology_review'
              : 'scientist_review',
          },
        },
      });
      onLogCreated();
      setOpen(false);
      reset();
    } catch (caught) {
      console.error('Error saving log:', caught);
      setError('The entry could not be saved. Your image and notes are still here—please try again.');
    } finally {
      setLoading(false);
    }
  };

  const suggestedConfidence = result
    ? Math.round((result.confidence_scores[result.estrus_stage] ?? 0) * 100)
    : 0;
  const reviewing = Boolean(result) || manualReview;
  const needsAcknowledgement = Boolean(result?.review_required) || manualReview;
  const binaryEvidence = result?.evidence?.external_binary;
  const binaryGroupLabel = binaryEvidence?.reference_backed_binary_suggestion === 'PROESTRUS_OR_ESTRUS'
    ? 'Proestrus / estrus group'
    : binaryEvidence?.reference_backed_binary_suggestion === 'METESTRUS_OR_DIESTRUS'
      ? 'Metestrus / diestrus group'
      : 'No reference-backed group';
  const binaryDecisionLabel = binaryEvidence?.decision_status === 'reference_backed_suggestion'
    ? 'Reference-backed lead'
    : 'Abstained safely';

  const selectModality = (nextModality: ObservationModality) => {
    setModality(nextModality);
    setRoiConfirmed(false);
    setGroundTruthSource('external_visual_review');
    setCytologyReferenceFile(null);
    setCytologyReferencePreview(null);
    setReferenceSampleId('');
    setResult(null);
    setManualReview(false);
    setConfirmedStage('');
    setReviewAcknowledged(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-[#454a9f] text-white hover:bg-[#383d89]">Record observation</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto border-[#ded9cd] bg-[#f7f4ed] p-0 text-[#292b4c] shadow-[0_24px_80px_rgba(39,36,26,0.18)]">
        <DialogHeader className="border-b border-[#ded9cd] px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b65d43]">{reviewing ? 'Observation review' : 'Observation capture'}</p>
              <DialogTitle className="mt-2 font-serif text-3xl tracking-[-0.045em] text-[#292b4c]">{reviewing ? 'One observation' : 'Capture one observation'}</DialogTitle>
            </div>
            <div data-testid="observation-stepper" className="flex items-center gap-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b887e]">
              <span className={!reviewing ? 'text-[#454a9f]' : ''}>01 Capture</span><span className="h-px w-5 bg-[#cfc9bc]" /><span className={reviewing && !confirmedStage ? 'text-[#454a9f]' : ''}>02 Review</span><span className="h-px w-5 bg-[#cfc9bc]" /><span className={confirmedStage ? 'text-[#b65d43]' : ''}>03 Confirm</span>
            </div>
          </div>
          <DialogDescription>
            {result
              ? 'Review the model lead, then choose the exact stage you want saved.'
              : manualReview
                ? modality === 'vaginal_cytology'
                  ? 'Record your cytology interpretation. No automated cytology classifier is configured in this app.'
                  : 'Review the external photo and choose the exact stage without a model lead.'
                : 'Add one clear image. You will choose the stage before anything is saved.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div role="alert" className="mx-5 mt-5 flex gap-3 rounded-none border border-[#d79a84] bg-[#fff1eb] p-3 text-sm text-[#8e3927] sm:mx-8">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {!reviewing ? (
          <div className="space-y-5 px-5 py-6 sm:px-8">
            <Label
              htmlFor={inputId}
              className={cn("group flex cursor-pointer flex-col items-center justify-center border border-dashed border-[#cfc9bc] bg-[#fbfaf7] p-4 text-center transition-colors hover:border-[#454a9f] hover:bg-[#f0effb]", preview ? "min-h-36" : "min-h-72")}
            >
              {preview ? (
                <Image src={preview} alt="Original selected image" width={640} height={640} unoptimized className="max-h-44 w-auto max-w-full object-contain shadow-sm" />
              ) : (
                <>
                  <div className="mb-3 rounded-xl bg-[#eeedf9] p-2"><EstrusIcon name="camera" className="h-12 w-12" /></div>
                  <span className="font-medium">Choose an image</span>
                  <span className="mt-1 text-sm text-muted-foreground">JPG, PNG, or HEIC up to 10 MB</span>
                </>
              )}
              <Input id={inputId} type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
            </Label>
            {file && <p className="text-center text-sm text-muted-foreground">{file.name}</p>}
            <fieldset className="space-y-3 border border-[#ded9cd] bg-[#fbfaf7] p-4">
              <legend className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b887e]">Image type</legend>
              <label className={cn('flex cursor-pointer items-start gap-3 border p-3 text-sm', modality === 'external_photo' ? 'border-[#454a9f] bg-[#eeedf9]' : 'border-[#ded9cd] bg-white')}>
                <input
                  type="radio"
                  name="observation-modality"
                  value="external_photo"
                  checked={modality === 'external_photo'}
                  onChange={() => selectModality('external_photo')}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="block font-medium">{MODALITIES.external_photo}</span>
                  <span className="text-muted-foreground">Model review is available after crop confirmation.</span>
                </span>
              </label>
              <details className="group border-t border-[#ded9cd] pt-3" open={modality === 'vaginal_cytology' ? true : undefined}>
                <summary className="cursor-pointer list-none text-xs font-semibold text-[#625f58] hover:text-[#353a87]">
                  Other image types <ChevronDown className="ml-1 inline h-3.5 w-3.5 transition group-open:rotate-180" />
                </summary>
                <label className={cn('mt-3 flex cursor-pointer items-start gap-3 border p-3 text-sm', modality === 'vaginal_cytology' ? 'border-[#454a9f] bg-[#eeedf9]' : 'border-[#ded9cd] bg-white')}>
                  <input
                    type="radio"
                    name="observation-modality"
                    value="vaginal_cytology"
                    checked={modality === 'vaginal_cytology'}
                    onChange={() => selectModality('vaginal_cytology')}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    <span className="block font-medium">{MODALITIES.vaginal_cytology}</span>
                    <span className="text-muted-foreground">Manual scientist interpretation only.</span>
                  </span>
                </label>
              </details>
            </fieldset>
            {file && modality === 'external_photo' && (
              <PreparedRoiCropper
                file={file}
                onFramingChange={() => setRoiConfirmed(false)}
                onPrepared={(prepared, metadata) => {
                  setPreparedRoiFile(prepared);
                  setPreparedRoiMetadata(metadata);
                  setPreparedRoiPreview(URL.createObjectURL(prepared));
                }}
              />
            )}
            {file && modality === 'external_photo' && (
              <label className={cn('flex cursor-pointer items-start gap-3 border p-3 text-sm', roiConfirmed ? 'border-[#454a9f] bg-[#eeedf9]' : 'border-[#d8b28d] bg-[#fff4df]')}>
                <input
                  type="checkbox"
                  checked={roiConfirmed}
                  disabled={!preparedRoiFile}
                  onChange={(event) => setRoiConfirmed(event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="block font-medium">Confirm model field</span>
                  <span className="mt-1 block leading-5 text-[#5f5c56]">Anatomy is centered inside the dashed frame. Changing the crop clears this.</span>
                </span>
              </label>
            )}
            <div className="space-y-2">
              <Label htmlFor="capture-date">Capture date</Label>
              <Input id="capture-date" type="date" value={captureDate} onChange={(event) => setCaptureDate(event.target.value)} />
            </div>
            {file && (
              <div className="space-y-2">
                <Button onClick={handleClassify} disabled={loading || (modality === 'external_photo' && (!roiConfirmed || !preparedRoiFile))} className="w-full bg-[#454a9f] hover:bg-[#383d89]" size="lg">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {loading ? 'Running model review…' : modality === 'external_photo' ? 'Run model review' : 'Review and log manually'}
                </Button>
                {modality === 'external_photo' && (
                  <Button onClick={handleManualReview} disabled={loading} variant="outline" className="w-full" size="lg">
                    Review and log manually
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-6 px-5 py-6 sm:px-8 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="space-y-4">
              <div data-testid="observation-image-panel" className="border border-[#ded9cd] bg-[#e9e4d9] p-3">
                <div className="flex items-center justify-between gap-3 px-1 pb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#625f58]"><span>{preparedRoiPreview && result ? 'Prepared model ROI' : 'Reviewed image'}</span><span>{preparedRoiPreview && result ? '415 × 640 · 83:128' : 'Original'}</span></div>
                <div className="relative aspect-square overflow-hidden bg-[#d8d2c5]">
                  {(preparedRoiPreview && result) ? <Image src={preparedRoiPreview} alt="Prepared model ROI" width={640} height={640} unoptimized className="h-full w-full object-contain" /> : preview && <Image src={preview} alt="Reviewed sample" width={640} height={640} unoptimized className="h-full w-full object-contain" />}
                  {preparedRoiPreview && result && <div className="pointer-events-none absolute inset-[6.25%] border border-dashed border-[#fff8e7] shadow-[0_0_0_999px_rgba(25,24,20,0.12)]" aria-hidden="true" />}
                </div>
              </div>
              {preparedRoiPreview && result && preview && <details className="border border-[#ded9cd] bg-[#fbfaf7] p-3 text-xs"><summary className="cursor-pointer font-medium text-[#454a9f]">Compare original photo</summary><Image src={preview} alt="Original uploaded photo" width={640} height={640} unoptimized className="mt-3 max-h-64 w-full object-contain" /></details>}
              <div className="space-y-2">
                <Label htmlFor="entry-notes">Observation notes <span className="font-normal text-muted-foreground">{confirmedStage === UNCERTAIN_STAGE ? '(required for uncertain / transition)' : '(optional)'}</span></Label>
                <Textarea id="entry-notes" placeholder="What informed this decision—cell types, handling, treatment, transition signs, or an observation the image cannot capture…" value={notes} onChange={(event) => setNotes(event.target.value)} />
              </div>
              <details className="border border-[#ded9cd] bg-[#fbfaf7] p-4 text-sm">
                <summary className="cursor-pointer font-medium">Capture protocol <span className="font-normal text-muted-foreground">(optional)</span></summary>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">These details make later comparison across cameras, microscope settings, and preparations possible.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label htmlFor="capture-session" className="text-xs">Session / collection ID</Label><Input id="capture-session" value={captureSession} onChange={(event) => setCaptureSession(event.target.value)} /></div>
                  <div className="space-y-1"><Label htmlFor="imaging-device" className="text-xs">Camera or microscope</Label><Input id="imaging-device" value={imagingDevice} onChange={(event) => setImagingDevice(event.target.value)} /></div>
                  <div className="space-y-1"><Label htmlFor="magnification" className="text-xs">Magnification</Label><Input id="magnification" placeholder="e.g. 10×" value={magnification} onChange={(event) => setMagnification(event.target.value)} /></div>
                  <div className="space-y-1"><Label htmlFor="stain-preparation" className="text-xs">Stain / preparation</Label><Input id="stain-preparation" value={stainOrPreparation} onChange={(event) => setStainOrPreparation(event.target.value)} /></div>
                </div>
              </details>
            </div>

            <div className="space-y-5">
              {result ? (
                <section data-testid="model-suggestion-panel" className={cn('border p-5', binaryEvidence?.decision_status === 'reference_backed_suggestion' ? 'border-[#b8b7e1] bg-[#eeedf9]' : 'border-[#d8b28d] bg-[#fff4df]')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#454a9f]">New model lead · early vs late only</p>
                      <p className="mt-2 font-serif text-3xl text-[#30345f]">
                        {binaryEvidence ? binaryGroupLabel : 'No new-model lead'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <EstrusIcon name={binaryEvidence?.decision_status === 'reference_backed_suggestion' ? 'evidence' : 'review-needed'} className="h-10 w-10" />
                      <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold', binaryEvidence?.decision_status === 'reference_backed_suggestion' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900')}>
                        {binaryEvidence ? binaryDecisionLabel : 'Service unavailable'}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-[#5e5d75]">
                    {binaryEvidence?.decision_status === 'reference_backed_suggestion'
                      ? 'Use this group as a review aid, then choose the exact stage below.'
                      : binaryEvidence
                        ? 'The model withheld its lead. Review the image and choose a stage without model guidance.'
                        : 'The public-photo model did not run. You can still complete a valid scientist-reviewed observation.'}
                  </p>
                </section>
              ) : (
                <section className="border border-[#d8b28d] bg-[#fff4df] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8e5d2f]">Scientist review · no model lead</p>
                  <p className="mt-2 text-sm leading-6 text-[#64432d]">{modality === 'vaginal_cytology' ? 'Interpret the smear and choose the stage below.' : 'Review the image and choose the stage below.'}</p>
                </section>
              )}

              <fieldset className="space-y-3 border border-[#454a9f] bg-[#fbfaf7] p-4">
                <legend className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#454a9f]">Your decision · required</legend>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-serif text-xl text-[#292b4c]">Choose the exact stage</p>
                  <span className="text-xs text-[#77736c]">Only your choice is saved</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SAVED_STAGES.map((stage) => {
                    const selected = confirmedStage === stage;
                    return (
                      <button
                        key={stage}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setConfirmedStage(stage);
                          setReviewAcknowledged(false);
                        }}
                        className={cn(
                          'flex min-h-11 items-center justify-between rounded-xl border px-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          selected ? `${stageClass[stage]} border-transparent` : 'border-border bg-background hover:bg-muted'
                        )}
                      >
                        {stage}
                        {selected && <Check className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {modality === 'external_photo' && (
                <fieldset className="space-y-3 border border-[#ded9cd] bg-[#fbfaf7] p-4">
                  <legend className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b887e]">Confirmation source</legend>
                  <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm', groundTruthSource === 'external_visual_review' ? 'border-primary/40 bg-background' : 'border-border bg-background/60')}>
                    <input
                      type="radio"
                      name="ground-truth-source"
                      value="external_visual_review"
                      checked={groundTruthSource === 'external_visual_review'}
                      onChange={() => {
                        setGroundTruthSource('external_visual_review');
                        setReviewAcknowledged(false);
                      }}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span><span className="block font-medium">Scientist visual review</span><span className="mt-1 block leading-5 text-muted-foreground">Valid observation; not cytology-grounded.</span></span>
                  </label>
                  <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm', groundTruthSource === 'paired_vaginal_cytology' ? 'border-primary/40 bg-primary/[0.04]' : 'border-border bg-background/60')}>
                    <input
                      type="radio"
                      name="ground-truth-source"
                      value="paired_vaginal_cytology"
                      checked={groundTruthSource === 'paired_vaginal_cytology'}
                      onChange={() => {
                        setGroundTruthSource('paired_vaginal_cytology');
                        setReviewAcknowledged(false);
                      }}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span><span className="block font-medium">Paired vaginal cytology</span><span className="mt-1 block leading-5 text-muted-foreground">Link the smear used for this decision.</span></span>
                  </label>

                  {groundTruthSource === 'paired_vaginal_cytology' && (
                    <div data-testid="paired-cytology-panel" className="space-y-3 border border-[#b8b7e1] bg-[#eeedf9] p-3">
                      <div className="flex items-center justify-between gap-3"><Label htmlFor={referenceInputId}>Paired cytology image <span className="text-destructive">required</span></Label><EstrusIcon name="paired-images" className="h-10 w-10 shrink-0" /></div>
                      <label htmlFor={referenceInputId} className="flex min-h-28 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-sky-300 bg-white/80 p-3 text-sm text-sky-950">
                        {cytologyReferencePreview ? (
                          <Image src={cytologyReferencePreview} alt="Paired cytology preview" width={96} height={80} unoptimized className="h-20 w-24 rounded-lg object-cover" />
                        ) : (
                          <div className="rounded-lg bg-sky-100 p-3 text-sky-700"><ImagePlus className="h-5 w-5" /></div>
                        )}
                        <span><span className="block font-medium">{cytologyReferenceFile?.name || 'Choose the smear image'}</span><span className="mt-1 block text-xs text-sky-800">Stored as private reference evidence.</span></span>
                        <Input id={referenceInputId} type="file" className="sr-only" onChange={handleCytologyReferenceChange} accept="image/*" />
                      </label>
                      <div className="space-y-1">
                        <Label htmlFor="reference-sample-id" className="text-xs">Slide / sample ID <span className="font-normal text-muted-foreground">(recommended)</span></Label>
                        <Input id="reference-sample-id" value={referenceSampleId} onChange={(event) => setReferenceSampleId(event.target.value)} placeholder="e.g. AH09-2026-07-19-A" />
                      </div>
                    </div>
                  )}
                </fieldset>
              )}

              {needsAcknowledgement && (
                <label className="flex cursor-pointer items-start gap-3 border border-[#d8b28d] bg-[#fff4df] p-3 text-sm text-[#64432d]">
                  <input
                    type="checkbox"
                    checked={reviewAcknowledged}
                    onChange={(event) => setReviewAcknowledged(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-amber-400 text-primary focus:ring-primary"
                  />
                  <span>
                    {groundTruthSource === 'paired_vaginal_cytology'
                      ? <>I reviewed the paired cytology and want to save <strong>{confirmedStage || 'the selected stage'}</strong> as the cytology-confirmed lab record.</>
                      : <>I reviewed this image and want to save <strong>{confirmedStage || 'the selected stage'}</strong> as the lab record.</>}
                  </span>
                </label>
              )}

              {result && <details data-testid="model-evidence-disclosure" className="border border-[#ded9cd] bg-[#fbfaf7] p-4 text-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-[#454a9f]">
                  Why this result?
                  <ChevronDown className="h-4 w-4" />
                </summary>
                <div className="mt-4 space-y-5 border-t border-[#ded9cd] pt-4">
                  <section>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#454a9f]">New model evidence</p>
                    {binaryEvidence ? (
                      <>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[#292b4c]">{binaryGroupLabel}</span>
                          <span className="text-xs text-[#5e5d75]">{Math.round(binaryEvidence.probability_proestrus_or_estrus * 100)}% raw early-group support</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className={cn('rounded-full px-2.5 py-1 font-medium', binaryEvidence.synthetic_dark_coat.agrees_with_clean ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900')}>
                            {binaryEvidence.synthetic_dark_coat.agrees_with_clean ? 'Dark-coat stable' : 'Dark-coat unstable'}
                          </span>
                          <span className={cn('rounded-full px-2.5 py-1 font-medium', binaryEvidence.reference_domain.out_of_reference ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900')}>
                            {binaryEvidence.reference_domain.out_of_reference ? 'Outside reference domain' : 'Within reference domain'}
                          </span>
                          <span className={cn('rounded-full px-2.5 py-1 font-medium', binaryEvidence.acquisition_domain.out_of_range ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800')}>
                            {binaryEvidence.acquisition_domain.out_of_range ? 'Acquisition out of range' : 'Acquisition in range'}
                          </span>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-[#77736c]">Two-group research model; never an exact stage. <span className="font-mono">{binaryEvidence.model_version}</span></p>
                      </>
                    ) : (
                      <p className="mt-2 text-xs leading-5 text-[#77736c]">No external binary evidence was returned for this image.</p>
                    )}
                  </section>

                  <section data-testid="legacy-four-stage-disclosure" className="border-t border-[#ded9cd] pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b887e]">Legacy four-stage comparison</p>
                      <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', stageClass[result.estrus_stage])}>{result.estrus_stage} · {suggestedConfidence}% relative support</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#77736c]">Secondary visual reference only; its support score is not a calibrated probability.</p>
                    {result.review_reasons && result.review_reasons.length > 0 && (
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-[#77736c]">
                        {result.review_reasons.map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                    )}
                  </section>

                  <section className="border-t border-[#ded9cd] pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b887e]">Visual observations</p>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-muted-foreground">
                      <p><span className="block text-xs font-medium text-foreground">Opening</span>{result.features.vaginal_opening || 'Not reported'}</p>
                      <p><span className="block text-xs font-medium text-foreground">Color</span>{result.features.tissue_color || 'Not reported'}</p>
                      <p><span className="block text-xs font-medium text-foreground">Swelling</span>{result.features.swelling || 'Not reported'}</p>
                      <p><span className="block text-xs font-medium text-foreground">Moisture</span>{result.features.moisture || 'Not reported'}</p>
                      {result.reasoning && <p className="col-span-2 border-t border-border pt-3 leading-6">{result.reasoning}</p>}
                    </div>
                  </section>
                </div>
              </details>}

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => { setResult(null); setManualReview(false); }} disabled={loading}>
                  <RotateCcw className="h-4 w-4" /> Choose another image
                </Button>
                <Button onClick={handleSave} disabled={loading || !confirmedStage || (needsAcknowledgement && !reviewAcknowledged) || (confirmedStage === UNCERTAIN_STAGE && !notes.trim()) || (groundTruthSource === 'paired_vaginal_cytology' && !cytologyReferenceFile)}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {!loading && <EstrusIcon name="confirm" className="h-6 w-6" />}
                  Save confirmed stage
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
