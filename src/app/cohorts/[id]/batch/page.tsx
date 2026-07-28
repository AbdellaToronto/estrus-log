"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  UploadCloud,
  Check,
  Loader2,
  ArrowLeft,
  Trash2,
  Minimize2,
  FileUp,
  Cloud,
  CloudLightning,
  Sparkles,
  X,
  AlertTriangle,
} from "lucide-react";
import { CycleWheel, ConfidenceBars } from "@/components/analysis";
import Link from "next/link";
import {
  getUploadUrls,
  batchSaveLogs,
  createScanSession,
  createScanItemsBulk,
  updateScanItem,
  getScanSession,
  getScanItems,
  deleteScanItem,
  startScanSessionAnalysis,
  startScanSessionRoiProposal,
  getCohort,
  updateScanSessionContext,
} from "@/app/actions";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  ClassificationResult,
  getPrimaryStageConfidence,
  getPrimaryStageName,
  getPrimaryStagePrediction,
} from "@/lib/classification";
import { useParsedCohortConfig } from "@/lib/cohort-config-context";
import {
  DINO_FIELD_FRACTION_X,
  DINO_FIELD_FRACTION_Y,
  EXTERNAL_ROI_ASPECT_RATIO,
  EXTERNAL_ROI_OUTPUT_HEIGHT,
  EXTERNAL_ROI_OUTPUT_WIDTH,
  PreparedRoiCropper,
  getExternalRoiDefaultZoom,
  type PreparedRoiMetadata,
} from "@/components/prepared-roi-cropper";

type CropReview = {
  method?: string;
  prompt?: string;
  confirmed?: boolean;
  analyzed_as_model_input?: boolean;
  quality_score?: number;
  requires_intervention?: boolean;
  review_reason?: string;
  metadata?: PreparedRoiMetadata;
};

type ScanItem = {
  id: string; // Local ID for UI
  scanItemId?: string; // DB ID
  file?: File; // Optional because restored items won't have it
  filename: string;
  previewUrl: string;
  status:
    | "pending"
    | "uploading"
    | "uploaded"
    | "proposing_roi"
    | "roi_review"
    | "roi_confirmed"
    | "crop_error"
    | "analyzing"
    | "complete"
    | "error"
    | "saved";
  gcsUrl?: string;
  croppedImageUrl?: string; // Segmented/cropped image
  maskImageUrl?: string; // Segmentation mask for visualization
  result?: ClassificationResult;
  cropReview?: CropReview;
  confirmedStage?: string;
  assignedSubjectId?: string;
  newSubjectName?: string;
  notes?: string;
};

type SubjectOption = {
  id: string;
  name: string;
};

type BatchModality = "external_photo" | "vaginal_cytology";

const STATUS_LABELS: Record<ScanItem["status"], string> = {
  pending: "Pending upload",
  uploading: "Uploading",
  uploaded: "Uploaded",
  proposing_roi: "Suggesting crop",
  roi_review: "Review crop",
  roi_confirmed: "Crop confirmed",
  crop_error: "Crop needs attention",
  analyzing: "Analyzing",
  complete: "Analyzed",
  error: "Needs attention",
  saved: "Saved",
};

const UNASSIGNED_SELECT_VALUE = "__none";
const LOCAL_CROP_QUALITY_THRESHOLD = 0.045;

const localDateKey = () => {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const suggestLocalTrainingFrameAnchor = (source: HTMLImageElement) => {
  const width = 192;
  const height = 256;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { centerX: 0.47, centerY: 0.45, score: 0 };
  context.drawImage(source, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const raw = new Float32Array(width * height);
  for (let index = 0; index < raw.length; index += 1) {
    const offset = index * 4;
    const red = pixels[offset] / 255;
    const green = pixels[offset + 1] / 255;
    const blue = pixels[offset + 2] / 255;
    const warm = Math.max(0, red - (green + blue) / 2);
    const pink = Math.max(0, red - blue) * Math.max(0, 1 - Math.abs(red - green) * 1.5);
    const lightness = (red + green + blue) / 3;
    const middleExposure = Math.max(0, Math.min(1, 1 - Math.abs(lightness - 0.45) * 2.2));
    raw[index] = (warm * 0.7 + pink * 0.8) * (0.25 + 0.75 * middleExposure);
  }

  const integralWidth = width + 1;
  const integral = new Float32Array(integralWidth * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowTotal = 0;
    for (let x = 0; x < width; x += 1) {
      rowTotal += raw[y * width + x];
      integral[(y + 1) * integralWidth + x + 1] =
        integral[y * integralWidth + x + 1] + rowTotal;
    }
  }

  const radius = 4;
  let bestScore = 0;
  let bestX = Math.round(width * 0.47);
  let bestY = Math.round(height * 0.45);
  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width - 1, x + radius);
      const area = (right - left + 1) * (bottom - top + 1);
      const localTotal =
        integral[(bottom + 1) * integralWidth + right + 1] -
        integral[top * integralWidth + right + 1] -
        integral[(bottom + 1) * integralWidth + left] +
        integral[top * integralWidth + left];
      const normalizedX = x / (width - 1);
      const normalizedY = y / (height - 1);
      const protocolPrior = Math.exp(
        -0.5 * Math.pow((normalizedX - 0.47) / 0.12, 2) -
        0.5 * Math.pow((normalizedY - 0.45) / 0.07, 2)
      );
      const score = (localTotal / area) * protocolPrior;
      if (score > bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
      }
    }
  }
  return {
    centerX: bestX / (width - 1),
    centerY: bestY / (height - 1),
    score: bestScore,
  };
};

const createLocalAutomaticCrop = async (file: File) => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Could not read ${file.name}`));
      image.src = objectUrl;
    });
    const baseCropWidth = Math.min(
      source.naturalWidth,
      source.naturalHeight * EXTERNAL_ROI_ASPECT_RATIO
    );
    const anchor = suggestLocalTrainingFrameAnchor(source);
    const suggestedZoom = getExternalRoiDefaultZoom(source.naturalWidth, source.naturalHeight);
    const cropWidth = baseCropWidth / suggestedZoom;
    const cropHeight = cropWidth / EXTERNAL_ROI_ASPECT_RATIO;
    const left = Math.min(
      Math.max(anchor.centerX * source.naturalWidth - cropWidth / 2, 0),
      source.naturalWidth - cropWidth
    );
    const top = Math.min(
      Math.max(anchor.centerY * source.naturalHeight - cropHeight / 2, 0),
      source.naturalHeight - cropHeight
    );
    const horizontalPosition = left / (source.naturalWidth - cropWidth);
    const verticalPosition = top / (source.naturalHeight - cropHeight);
    const canvas = document.createElement("canvas");
    canvas.width = EXTERNAL_ROI_OUTPUT_WIDTH;
    canvas.height = EXTERNAL_ROI_OUTPUT_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The browser could not prepare a crop canvas");
    context.drawImage(
      source,
      left,
      top,
      cropWidth,
      cropHeight,
      0,
      0,
      EXTERNAL_ROI_OUTPUT_WIDTH,
      EXTERNAL_ROI_OUTPUT_HEIGHT
    );
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error("The crop could not be encoded")),
        "image/jpeg",
        0.95
      );
    });
    const stem = file.name.replace(/\.[^.]+$/, "") || "capture";
    return {
      file: new File([blob], `${stem}-suggested-roi.jpg`, { type: "image/jpeg" }),
      metadata: {
        source_width: source.naturalWidth,
        source_height: source.naturalHeight,
        output_width: EXTERNAL_ROI_OUTPUT_WIDTH,
        output_height: EXTERNAL_ROI_OUTPUT_HEIGHT,
        zoom: suggestedZoom,
        horizontal_position: horizontalPosition,
        vertical_position: verticalPosition,
        processor_field_fraction: DINO_FIELD_FRACTION_X,
        processor_field_fraction_x: DINO_FIELD_FRACTION_X,
        processor_field_fraction_y: DINO_FIELD_FRACTION_Y,
        crop_aspect_ratio: EXTERNAL_ROI_ASPECT_RATIO,
        proposal_quality_score: anchor.score,
        proposal_quality_gate: anchor.score >= LOCAL_CROP_QUALITY_THRESHOLD ? "pass" : "intervention",
        crop_box_pixels: [left, top, left + cropWidth, top + cropHeight].map(Math.round) as [number, number, number, number],
      } satisfies PreparedRoiMetadata,
      qualityScore: anchor.score,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

type DbScanItem = {
  id: string;
  image_url: string;
  status: string | null;
  ai_result: (Partial<ClassificationResult> & {
    scientist_confirmed_stage?: string;
    crop_review?: CropReview;
  }) | null;
  created_at: string;
  mouse_id: string | null;
  cropped_image_url: string | null;
  mask_image_url: string | null;
};

const mapDbStatus = (status: string | null): ScanItem["status"] => {
  switch (status) {
    case "pending":
    case null:
      return "pending";
    case "uploading":
      return "uploading";
    case "uploaded":
      return "uploaded";
    case "proposing_roi":
      return "proposing_roi";
    case "roi_review":
      return "roi_review";
    case "roi_confirmed":
      return "roi_confirmed";
    case "crop_error":
      return "crop_error";
    case "analyzing":
      return "analyzing";
    case "complete":
      return "complete";
    case "saved":
      return "saved";
    case "error":
      return "error";
    default:
      return "pending";
  }
};

const deserializeServerItem = (item: DbScanItem): ScanItem => {
  const baseUrl = item.image_url?.split("?")[0] || item.image_url;
  const filename = baseUrl
    ? decodeURIComponent(baseUrl.split("/").pop() || "capture")
    : "capture";
  return {
    id: Math.random().toString(36).substring(7),
    scanItemId: item.id,
    filename,
    previewUrl: item.image_url,
    status: mapDbStatus(item.status),
    gcsUrl: item.image_url,
    croppedImageUrl: item.cropped_image_url || undefined,
    maskImageUrl: item.mask_image_url || undefined,
    result: item.ai_result?.confidence_scores
      ? (item.ai_result as ClassificationResult)
      : undefined,
    cropReview: item.ai_result?.crop_review,
    confirmedStage: item.ai_result?.scientist_confirmed_stage || undefined,
    assignedSubjectId: item.mouse_id || undefined,
  };
};

export default function BatchUploadPage() {
  const params = useParams();
  const router = useRouter();
  const cohortId = params.id as string;

  const [items, setItems] = useState<ScanItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [reviewAcknowledgedFor, setReviewAcknowledgedFor] = useState<string | null>(null);
  const [batchReviewAcknowledgedFor, setBatchReviewAcknowledgedFor] = useState<string | null>(null);
  const [batchModality, setBatchModality] = useState<BatchModality | null>("external_photo");
  const [captureDate, setCaptureDate] = useState(localDateKey);
  const [contextError, setContextError] = useState<string | null>(null);
  const [editingRoiId, setEditingRoiId] = useState<string | null>(null);
  const [roiEditorFile, setRoiEditorFile] = useState<File | null>(null);
  const [preparedRoi, setPreparedRoi] = useState<{
    file: File;
    metadata: PreparedRoiMetadata;
  } | null>(null);
  const [isSavingRoi, setIsSavingRoi] = useState(false);
  const [cohort, setCohort] = useState<{
    type?: string | null;
    log_config?: unknown;
    subject_config?: unknown;
  } | null>(null);

  // Load cohort config
  useEffect(() => {
    getCohort(cohortId).then(setCohort).catch(console.error);
  }, [cohortId]);

  // Get config from cohort
  const { stages, stageNames, getColor, getGradient, subjectLabel } = useParsedCohortConfig(cohort);
  const subjectNoun = subjectLabel.toLowerCase();
  const subjectNounPlural = subjectNoun === "mouse" ? "mice" : `${subjectNoun}s`;

  const selectedItem = items.find((i) => i.id === selectedId);
  const reviewOrderedItems = useMemo(
    () => [...items].sort((left, right) => Number(right.status === "crop_error") - Number(left.status === "crop_error")),
    [items]
  );
  const hasItems = items.length > 0;
  const completeCount = items.filter(
    (i) => i.status === "complete" || i.status === "saved"
  ).length;
  const uploadedCount = items.filter((i) =>
    ["uploaded", "proposing_roi", "roi_review", "roi_confirmed", "analyzing", "complete", "saved"].includes(i.status)
  ).length;
  const progress = useMemo(
    () => (items.length ? (completeCount / items.length) * 100 : 0),
    [items.length, completeCount]
  );
  const hasActiveAnalysis = useMemo(
    () =>
      items.some((i) => i.status === "proposing_roi" || i.status === "analyzing"),
    [items]
  );
  const hasAnalyzableItems = useMemo(
    () =>
      items.some((i) => i.status === "roi_confirmed") &&
      items.every((i) => ["roi_confirmed", "complete", "saved"].includes(i.status)),
    [items]
  );
  const hasCropProposalItems = useMemo(
    () => items.some((item) => item.status === "uploaded" || item.status === "crop_error"),
    [items]
  );
  const selectedItemSource = selectedItem?.gcsUrl?.split("?")[0];
  const selectedStageName = getPrimaryStageName(selectedItem?.result);
  const selectedStageConfidence = getPrimaryStageConfidence(
    selectedItem?.result
  );
  const selectedBinaryEvidence = selectedItem?.result?.evidence?.external_binary;
  const selectedBinaryLabel = !selectedBinaryEvidence || selectedBinaryEvidence.decision_status === "abstain"
    ? "Abstain"
    : selectedBinaryEvidence.reference_backed_binary_suggestion === "PROESTRUS_OR_ESTRUS"
      ? "Early group"
      : "Late group";
  const selectedAcquisitionLabel = !selectedBinaryEvidence
    ? "Not available"
    : selectedBinaryEvidence.acquisition_domain.out_of_range
      ? "Acquisition check"
      : selectedBinaryEvidence.reference_domain.out_of_reference
        ? "Outside reference"
        : "Within reference";
  const subjectNameMap = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject.name])),
    [subjects]
  );

  const getAssignmentLabel = useCallback(
    (item?: ScanItem | null) => {
      if (!item) return null;
      if (item.newSubjectName) return item.newSubjectName;
      if (item.assignedSubjectId) {
        return subjectNameMap.get(item.assignedSubjectId) || null;
      }
      return null;
    },
    [subjectNameMap]
  );
  const selectedAssignmentName = getAssignmentLabel(selectedItem);
  const toFeaturePayload = useCallback(
    (features?: ClassificationResult["features"] | null) => {
      if (!features) return undefined;
      const entries = Object.entries(features).reduce<Record<string, string>>(
        (acc, [key, value]) => {
          if (typeof value === "string" && value.length > 0) {
            acc[key] = value;
          }
          return acc;
        },
        {}
      );
      return Object.keys(entries).length > 0 ? entries : undefined;
    },
    []
  );
  const selectedItemMeta = selectedItem
    ? [
        selectedItem.file
          ? `${(selectedItem.file.size / 1024).toFixed(1)} KB`
          : "Cloud asset",
        STATUS_LABELS[selectedItem.status],
        selectedAssignmentName
          ? `Assigned: ${selectedAssignmentName}`
          : undefined,
      ]
        .filter(Boolean)
        .join(" • ")
    : "";

  const loadSubjects = useCallback(async () => {
    setSubjectsLoading(true);
    try {
      const response = await fetch(`/api/cohorts/${cohortId}/subjects`, {
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error("Failed to load subjects");
      }
      const data = await response.json();
      setSubjects(data.subjects ?? []);
      setSubjectsError(null);
    } catch (error) {
      console.error("Failed to load subjects", error);
      setSubjectsError("Unable to load subjects");
    } finally {
      setSubjectsLoading(false);
    }
  }, [cohortId]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  // --- Resume Logic ---
  useEffect(() => {
    async function loadSession() {
      try {
        const session = await getScanSession(cohortId);
        if (session) {
          setSessionId(session.id);
          setBatchModality(
            session.modality === "external_photo" || session.modality === "vaginal_cytology"
              ? session.modality
              : null
          );
          setCaptureDate(session.capture_date || "");
          const dbItems = await getScanItems(session.id);
          if (dbItems && dbItems.length > 0) {
            // Cast to unknown first if types don't perfectly align (e.g. Json vs concrete type)
            // but prefer explicit type assertion over 'any'
            const restored: ScanItem[] = dbItems
              .filter((i) => i.status !== "pending")
              .map((i) => deserializeServerItem(i as unknown as DbScanItem));
            // React Strict Mode can run this hydration effect twice in local
            // development. Merge by the persistent scan-item id so a resumed
            // batch never shows duplicate photos.
            setItems((prev) => {
              const merged = new Map<string, ScanItem>();
              prev.forEach((item) => {
                if (item.scanItemId) merged.set(item.scanItemId, item);
              });
              restored.forEach((item) => {
                if (item.scanItemId && !merged.has(item.scanItemId)) {
                  merged.set(item.scanItemId, item);
                }
              });
              const localOnly = prev.filter((item) => !item.scanItemId);
              return [...localOnly, ...merged.values()];
            });
            if (restored.length > 0) {
              setSelectedId((current) => current || restored[0].id);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load session", e);
      }
    }
    loadSession();
  }, [cohortId]);

  // --- File Handling ---

  const ensureSession = async () => {
    if (sessionId) return sessionId;
    if (!batchModality || !captureDate) {
      setContextError("Choose the specimen modality and capture date before uploading.");
      return null;
    }
    try {
      const session = await createScanSession(cohortId, {
        modality: batchModality,
        captureDate,
      });
      setSessionId(session.id);
      return session.id;
    } catch (e) {
      console.error("Failed to create session", e);
      return null;
    }
  };

  useEffect(() => {
    if (!sessionId || !batchModality || !captureDate) return;
    updateScanSessionContext(sessionId, { modality: batchModality, captureDate })
      .then(() => setContextError(null))
      .catch((error) => {
        console.error("Failed to save batch observation context", error);
        setContextError("The batch context could not be saved. Try again before starting analysis.");
      });
  }, [sessionId, batchModality, captureDate]);

  const refreshItemsFromServer = useCallback(async () => {
    if (!sessionId) return;
    try {
      const latest = await getScanItems(sessionId);
      setItems((prev) => {
        const serverMap = new Map(
          latest.map((item) => [item.id, item as unknown as DbScanItem])
        );
        const next: ScanItem[] = prev.map((item) => {
          if (!item.scanItemId) return item;
          const server = serverMap.get(item.scanItemId);
          if (!server) return item;

          // Only use server URL if it's a valid HTTP URL (not a "pending/..." placeholder)
          const serverUrl = server.image_url;
          const isValidServerUrl = serverUrl && serverUrl.startsWith("http");
          const serverAssignedId = server.mouse_id ?? undefined;

          return {
            ...item,
            status: mapDbStatus(server.status),
            gcsUrl: isValidServerUrl ? serverUrl : item.gcsUrl,
            previewUrl: isValidServerUrl ? serverUrl : item.previewUrl,
            croppedImageUrl: server.cropped_image_url || item.croppedImageUrl,
            maskImageUrl: server.mask_image_url || item.maskImageUrl,
            result: server.ai_result?.confidence_scores
              ? (server.ai_result as ClassificationResult)
              : item.result,
            cropReview: server.ai_result?.crop_review || item.cropReview,
            confirmedStage: server.ai_result?.scientist_confirmed_stage || item.confirmedStage,
            assignedSubjectId:
              serverAssignedId || item.assignedSubjectId || undefined,
          };
        });

        const knownIds = new Set(
          next.map((item) => item.scanItemId).filter(Boolean)
        );
        latest.forEach((server) => {
          const typedServer = server as unknown as DbScanItem;
          if (
            !knownIds.has(typedServer.id) &&
            typedServer.status !== "pending"
          ) {
            next.push(deserializeServerItem(typedServer));
          }
        });

        return next;
      });
    } catch (e) {
      console.error("Failed to refresh scan items", e);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !hasActiveAnalysis) return;
    const id = setInterval(() => {
      refreshItemsFromServer();
    }, 6000);
    return () => clearInterval(id);
  }, [sessionId, hasActiveAnalysis, refreshItemsFromServer]);

  const handleFiles = async (files: File[]) => {
    const currentSessionId = await ensureSession();
    if (!currentSessionId) {
      alert("Could not start scan session. Please try again.");
      return;
    }

    const filesToProcess: File[] = [];

    // 1. Extract Files
    for (const file of files) {
      if (file.name.endsWith(".zip")) {
        try {
          const zip = new JSZip();
          const contents = await zip.loadAsync(file);
          for (const filename of Object.keys(contents.files)) {
            if (
              !contents.files[filename].dir &&
              filename.match(/\.(jpg|jpeg|png|webp)$/i)
            ) {
              const blob = await contents.files[filename].async("blob");
              const imgFile = new File([blob], filename, {
                type: "image/jpeg",
              });
              filesToProcess.push(imgFile);
            }
          }
        } catch (e) {
          console.error("Failed to unzip", e);
        }
      } else if (file.type.startsWith("image/")) {
        filesToProcess.push(file);
      }
    }

    // 2. Create UI Items
    const newUIItems: ScanItem[] = filesToProcess.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      filename: file.name,
      previewUrl: URL.createObjectURL(file),
      status: "pending",
    }));

    setItems((prev) => [...prev, ...newUIItems]);
    if (!selectedId && newUIItems.length > 0) setSelectedId(newUIItems[0].id);

    // 3. Bulk Create DB Items
    // We use a temporary path "pending/filename"
    const dbPayload = newUIItems.map((i) => ({
      imageUrl: `pending/${i.filename}`,
    }));

    createScanItemsBulk(currentSessionId, dbPayload)
      .then((dbItems) => {
        if (dbItems) {
          // Match back to UI items by index (preserved order)
          setItems((prev) => {
            const updated = [...prev];
            // We need to find the items we just added.
            // Since we appended, they are at the end.
            // This is slightly risky if user added more files rapidly.
            // Better: map newUIItems to updated ones.
            newUIItems.forEach((uiItem, idx) => {
              const match = updated.find((u) => u.id === uiItem.id);
              if (match && dbItems[idx]) {
                match.scanItemId = dbItems[idx].id;
              }
            });
            return updated;
          });
        }
      })
      .catch(console.error);
  };

  const assignExistingSubject = useCallback(
    (itemId: string, subjectId?: string) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                assignedSubjectId: subjectId || undefined,
                newSubjectName: subjectId ? undefined : item.newSubjectName,
              }
            : item
        )
      );
    },
    []
  );

  const assignNewSubjectName = useCallback((itemId: string, name: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              newSubjectName: name || undefined,
              assignedSubjectId: name ? undefined : item.assignedSubjectId,
            }
          : item
      )
    );
  }, []);

  const confirmItemStage = useCallback((itemId: string, stage: string) => {
    setBatchReviewAcknowledgedFor(null);
    setReviewAcknowledgedFor(null);
    const currentItem = items.find((item) => item.id === itemId);
    setItems((previous) => previous.map((item) =>
      item.id === itemId ? { ...item, confirmedStage: stage } : item
    ));
    // Keep server mutations outside the React state updater. The server action
    // may revalidate a route, which React correctly rejects during render.
    if (currentItem?.scanItemId && currentItem.result) {
      void updateScanItem(currentItem.scanItemId, {
        status: currentItem.status,
        result: { ...currentItem.result, scientist_confirmed_stage: stage },
      }).catch((error) => console.error("Failed to persist confirmed stage", error));
    }
  }, [items]);

  const updateItemNotes = useCallback((itemId: string, notes: string) => {
    setItems((previous) => previous.map((item) => item.id === itemId ? { ...item, notes } : item));
  }, []);

  const analyzedItems = useMemo(
    () =>
      items.filter(
        (i) =>
          i.status === "complete" &&
          i.result &&
          getPrimaryStagePrediction(i.result)
      ),
    [items]
  );

  const analyzedMissingAssignments = useMemo(
    () =>
      analyzedItems.filter((i) => !(i.assignedSubjectId || i.newSubjectName)),
    [analyzedItems]
  );
  const analyzedMissingStageDecisions = useMemo(
    () => analyzedItems.filter((item) => !item.confirmedStage),
    [analyzedItems]
  );

  const reviewRequiredItems = useMemo(
    () => analyzedItems.filter((item) => item.result?.review_required),
    [analyzedItems]
  );
  const reviewKey = reviewRequiredItems.map((item) => item.id).sort().join(",");
  const hasAcknowledgedReviews = reviewRequiredItems.length === 0 || reviewAcknowledgedFor === reviewKey;
  const batchReviewKey = analyzedItems
    .map((item) => `${item.id}:${item.confirmedStage || ""}`)
    .sort()
    .join(",");
  const hasAcknowledgedBatchReview = Boolean(batchReviewKey) && batchReviewAcknowledgedFor === batchReviewKey;
  const canSave = analyzedItems.length > 0
    && analyzedMissingAssignments.length === 0
    && analyzedMissingStageDecisions.length === 0
    && hasAcknowledgedReviews
    && hasAcknowledgedBatchReview;
  const canAnalyze = batchModality === "external_photo" && Boolean(captureDate) && !contextError;

  // --- Action: Upload ---

  const handleUpload = async () => {
    setIsProcessing(true);
    try {
      const pendingItems = items.filter(
        (i) => i.status === "pending" && i.file
      );
      if (pendingItems.length === 0) return;

      // Batch get signed URLs
      const fileMetas = pendingItems.map((i) => ({
        filename: i.filename,
        contentType: i.file!.type,
      }));
      const uploadUrls = await getUploadUrls(fileMetas, cohortId);

      // Map filename to url
      const urlMap = new Map(uploadUrls.map((u) => [u.filename, u]));

      // Upload in chunks (concurrency: 5)
      const chunkSize = 5;
      for (let i = 0; i < pendingItems.length; i += chunkSize) {
        const chunk = pendingItems.slice(i, i + chunkSize);

        await Promise.all(
          chunk.map(async (item) => {
            const urlData = urlMap.get(item.filename);
            if (!urlData) return;
            if (!urlData.readUrl) {
              throw new Error("A readable upload URL could not be created");
            }

            updateItemState(item.id, "uploading");

            await fetch(urlData.url, {
              method: "PUT",
              body: item.file,
              headers: { "Content-Type": item.file!.type },
            });

            updateItemState(item.id, "uploaded", { gcsUrl: urlData.readUrl });

            if (item.scanItemId) {
              await updateScanItem(item.scanItemId, {
                status: "uploaded",
                imageUrl: urlData.objectUrl,
              });
            }
          })
        );
      }
    } catch (e) {
      console.error("Upload failed", e);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Action: Prepare and analyze ---

  const handleProposeRois = async () => {
    setIsProcessing(true);
    try {
      const currentSessionId = await ensureSession();
      if (!currentSessionId) throw new Error("No active session found");

      if (process.env.NEXT_PUBLIC_ESTRUS_LOCAL_TEST_IDENTITY === "true") {
        const candidates = items.filter(
          (item) => item.status === "uploaded" || item.status === "crop_error"
        );
        const proposals = await Promise.all(candidates.map(async (item) => {
          if (!item.scanItemId) throw new Error(`Missing database item for ${item.filename}`);
          const sourceFile = item.file ?? new File(
            [await (await fetch(item.previewUrl)).blob()],
            item.filename,
            { type: "image/jpeg" }
          );
          const prepared = await createLocalAutomaticCrop(sourceFile);
          const [upload] = await getUploadUrls(
            [{ filename: prepared.file.name, contentType: prepared.file.type }],
            cohortId
          );
          if (!upload?.readUrl) throw new Error(`No crop destination for ${item.filename}`);
          const response = await fetch(upload.url, {
            method: "PUT",
            body: prepared.file,
            headers: { "Content-Type": prepared.file.type },
          });
          if (!response.ok) throw new Error(`Crop upload failed for ${item.filename}`);
          const requiresIntervention = prepared.qualityScore < LOCAL_CROP_QUALITY_THRESHOLD;
          const proposalStatus: ScanItem["status"] = requiresIntervention ? "crop_error" : "roi_review";
          const cropReview: CropReview = {
            method: "Automatic 83:128 training-frame proposal",
            prompt: "Label-blind local acquisition anchor; scientist confirmation required",
            confirmed: false,
            quality_score: prepared.qualityScore,
            requires_intervention: requiresIntervention,
            review_reason: requiresIntervention
              ? "The acquisition anchor is weak; inspect the original and adjust or recapture."
              : undefined,
            metadata: prepared.metadata,
          };
          await updateScanItem(item.scanItemId, {
            status: proposalStatus,
            croppedImageUrl: upload.objectUrl,
            result: { crop_review: cropReview },
          });
          return {
            itemId: item.id,
            status: proposalStatus,
            croppedImageUrl: upload.readUrl,
            cropReview,
          };
        }));
        const proposalMap = new Map(proposals.map((proposal) => [proposal.itemId, proposal]));
        setItems((previous) => previous.map((item) => {
          const proposal = proposalMap.get(item.id);
          return proposal
            ? {
                ...item,
                status: proposal.status,
                croppedImageUrl: proposal.croppedImageUrl,
                cropReview: proposal.cropReview,
              }
            : item;
        }));
        return;
      }

      await startScanSessionRoiProposal(currentSessionId);
      setItems((previous) =>
        previous.map((item) =>
          item.status === "uploaded" || item.status === "crop_error"
            ? { ...item, status: "proposing_roi" }
            : item
        )
      );
    } catch (error) {
      console.error("Failed to queue ROI proposals", error);
      alert("Failed to start automatic crop suggestions. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmSuggestedRoi = useCallback(async (item: ScanItem) => {
    if (!item.croppedImageUrl || !item.scanItemId) return;
    const cropReview: CropReview = {
      ...item.cropReview,
      method: item.cropReview?.method || "SAM3 text-prompt proposal",
      confirmed: true,
    };
    try {
      await updateScanItem(item.scanItemId, {
        status: "roi_confirmed",
        result: { crop_review: cropReview },
      });
      setItems((previous) => previous.map((candidate) =>
        candidate.id === item.id
          ? { ...candidate, status: "roi_confirmed", cropReview }
          : candidate
      ));
    } catch (error) {
      console.error("Failed to confirm suggested ROI", error);
      await refreshItemsFromServer();
    }
  }, [refreshItemsFromServer]);

  const confirmAllSuggestedRois = async () => {
    setIsProcessing(true);
    try {
      await Promise.all(
        items
          .filter((item) => item.status === "roi_review" && item.croppedImageUrl)
          .map(confirmSuggestedRoi)
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const beginRoiAdjustment = async (item: ScanItem) => {
    try {
      const file = item.file ?? new File(
        [await (await fetch(item.previewUrl)).blob()],
        item.filename,
        { type: "image/jpeg" }
      );
      setRoiEditorFile(file);
      setPreparedRoi(null);
      setEditingRoiId(item.id);
    } catch (error) {
      console.error("Failed to open the original for crop adjustment", error);
      alert("The original image could not be opened for crop adjustment.");
    }
  };

  const saveAdjustedRoi = async () => {
    const item = items.find((candidate) => candidate.id === editingRoiId);
    if (!item?.scanItemId || !preparedRoi) return;
    setIsSavingRoi(true);
    try {
      const [upload] = await getUploadUrls(
        [{ filename: preparedRoi.file.name, contentType: preparedRoi.file.type }],
        cohortId
      );
      if (!upload?.readUrl) throw new Error("A readable ROI URL could not be created");
      const readableRoiUrl = upload.readUrl;
      await fetch(upload.url, {
        method: "PUT",
        body: preparedRoi.file,
        headers: { "Content-Type": preparedRoi.file.type },
      });
      const cropReview: CropReview = {
        method: "Scientist-adjusted 83:128 training-frame crop",
        confirmed: true,
        metadata: preparedRoi.metadata,
      };
      await updateScanItem(item.scanItemId, {
        status: "roi_confirmed",
        croppedImageUrl: upload.objectUrl,
        result: { crop_review: cropReview },
      });
      setItems((previous) => previous.map((candidate) =>
        candidate.id === item.id
          ? {
              ...candidate,
              status: "roi_confirmed",
              croppedImageUrl: readableRoiUrl,
              cropReview,
            }
          : candidate
      ));
      setEditingRoiId(null);
      setRoiEditorFile(null);
      setPreparedRoi(null);
    } catch (error) {
      console.error("Failed to save adjusted ROI", error);
      alert("The adjusted crop could not be saved. Your original image was not changed.");
    } finally {
      setIsSavingRoi(false);
    }
  };

  const discardSelectedItem = async () => {
    if (!selectedItem) return;
    try {
      if (selectedItem.scanItemId) await deleteScanItem(selectedItem.scanItemId);
      if (selectedItem.previewUrl.startsWith("blob:")) URL.revokeObjectURL(selectedItem.previewUrl);
      setItems((previous) => previous.filter((item) => item.id !== selectedItem.id));
      setSelectedId(null);
    } catch (error) {
      console.error("Failed to remove scan item", error);
      alert("The image could not be removed from this batch. Try again before analysis.");
    }
  };

  const handleAnalyze = async () => {
    if (!canAnalyze) {
      setContextError(
        batchModality === "vaginal_cytology"
          ? "This batch analyzer is only for external genital photos. Log cytology as a scientist-reviewed single observation."
          : "Choose an external-photo modality and specimen capture date before starting analysis."
      );
      return;
    }
    setIsProcessing(true);
    try {
      const currentSessionId = await ensureSession();
      if (!currentSessionId) {
        throw new Error("No active session found");
      }

      await startScanSessionAnalysis(currentSessionId);

      setItems((prev) =>
        prev.map((item) =>
          item.status === "roi_confirmed" ? { ...item, status: "analyzing" } : item
        )
      );
    } catch (e) {
      console.error("Failed to queue analysis", e);
      alert("Failed to start analysis job. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveAll = useCallback(async () => {
    if (reviewRequiredItems.length > 0 && !hasAcknowledgedReviews) {
      alert("Review the flagged predictions and acknowledge them before saving this batch.");
      return;
    }
    if (!hasAcknowledgedBatchReview) {
      alert("Review the batch and confirm the selected stages before saving.");
      return;
    }
    if (batchModality !== "external_photo" || !captureDate) {
      alert("This batch needs a saved external-photo modality and capture date before it can be saved.");
      return;
    }
    setIsSaving(true);
    try {
      if (analyzedItems.length === 0) {
        alert("No analyzed items to save yet.");
        return;
      }

      const payload = analyzedItems.map((item) => {
        const confirmedStage = item.confirmedStage;
        if (!confirmedStage) throw new Error(`Choose a stage for ${item.filename}`);
        const confidenceScores = item.result?.confidence_scores;
        return {
          filename: item.filename,
          imageUrl: item.gcsUrl!,
          stage: confirmedStage,
          confidence: confidenceScores?.[confirmedStage as keyof typeof confidenceScores] ?? 0,
          features: toFeaturePayload(item.result!.features),
          reasoning: item.result!.reasoning ?? "",
          notes: item.notes?.trim() || undefined,
          scanItemId: item.scanItemId,
          subjectId: item.assignedSubjectId,
          newSubjectName: item.newSubjectName?.trim() || undefined,
          observationContext: {
            modality: batchModality,
            captureDate,
          },
          flexibleData: {
            confidence_scores: item.result!.confidence_scores,
            suggested_stage: getPrimaryStageName(item.result),
            confirmed_stage: confirmedStage,
            thoughts: item.result!.thoughts,
            review_required: item.result!.review_required,
            review_reasons: item.result!.review_reasons,
            evidence: item.result!.evidence,
            model_version: item.result!.model_version,
            ...toFeaturePayload(item.result!.features), // Also include features in data json for robustness
          },
        };
      });

      await batchSaveLogs(cohortId, payload, sessionId || undefined);

      setItems((prev) =>
        prev.map((item) =>
          item.status === "complete" ? { ...item, status: "saved" } : item
        )
      );

      await loadSubjects();
      router.push(`/cohorts/${cohortId}`);
    } catch (e) {
      console.error("Failed to save batch", e);
      alert("Failed to save logs. Check console.");
    } finally {
      setIsSaving(false);
    }
  }, [
    analyzedItems,
    cohortId,
    sessionId,
    router,
    loadSubjects,
    toFeaturePayload,
    reviewRequiredItems.length,
    hasAcknowledgedReviews,
    hasAcknowledgedBatchReview,
    batchModality,
    captureDate,
  ]);

  const updateItemState = (
    id: string,
    status: ScanItem["status"],
    updates: Partial<ScanItem> = {}
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status, ...updates } : item
      )
    );
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-30 flex overflow-hidden bg-[#f7f4ed] animate-in fade-in duration-300">
      <LayoutGroup>
        {/* --- LEFT PANEL: Controls / Upload --- */}
        <motion.aside
          layout
          className={cn(
            "relative z-20 flex h-full flex-col border-r border-[#ded9cd] bg-[#fbfaf7] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
            hasItems ? "w-72 shrink-0" : "w-full items-center justify-center"
          )}
          initial={false}
        >
          {/* Header Area */}
          <motion.div
            layout
            className={cn(
              "flex w-full shrink-0 flex-col items-center p-5 transition-all",
              !hasItems && "max-w-2xl"
            )}
          >
            {!hasItems ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-12"
              >
                <div className="w-24 h-24 bg-linear-to-br from-blue-500/10 to-purple-500/10 rounded-4xl flex items-center justify-center mx-auto mb-8 shadow-sm border border-slate-100">
                  <FileUp className="w-10 h-10 text-slate-700" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight text-slate-900">
                  Start a photo batch
                </h1>
                <p className="text-lg text-slate-500 max-w-md mx-auto leading-relaxed">
                  Add the day&apos;s external photos. Estrus Log will suggest consistent crops for you to confirm before any analysis runs.
                </p>

                <div className="mt-10">
                  <Link href={`/cohorts/${cohortId}`}>
                    <Button
                      variant="ghost"
                      className="text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" /> Cancel and return
                      to cohort
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ) : (
              <div className="mb-4 w-full">
                <div className="mb-4 flex items-center justify-between">
                  <Link
                    href={`/cohorts/${cohortId}`}
                    className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full -ml-2"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-slate-600 rounded-full"
                    onClick={() => setItems([])}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div>
                  <h1 className="font-bold text-2xl tracking-tight text-slate-900">
                    Batch review
                  </h1>
                  <p className="text-sm text-slate-500 font-medium mt-1">
                    {items.length} external photo{items.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            )}

            <section className="mb-5 w-full border-y border-[#ded9cd] py-4 text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#77736c]">Observation context</p>
              <div className="mt-3 grid gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#625f58]">Modality</Label>
                  <div className="flex h-10 items-center border border-[#ded9cd] bg-white px-3 text-sm font-medium text-[#292b4c]">External photos</div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="batch-capture-date" className="text-xs text-[#625f58]">Capture date</Label>
                  <Input
                    id="batch-capture-date"
                    type="date"
                    value={captureDate}
                    onChange={(event) => {
                      setCaptureDate(event.target.value);
                      setContextError(null);
                    }}
                    className="h-10 bg-white"
                  />
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#77736c]">Saved on every record; upload time stays separate.</p>
              {contextError && <p role="alert" className="mt-2 text-xs font-medium text-destructive">{contextError}</p>}
            </section>

            {/* Dropzone - Compact Mode */}
            <button
              type="button"
              aria-label={hasItems ? "Add more batch image files" : "Choose batch image files"}
              disabled={!batchModality || !captureDate}
              className={cn(
                "relative transition-all duration-500 cursor-pointer group overflow-hidden w-full bg-white text-left disabled:cursor-not-allowed disabled:opacity-60",
                (!batchModality || !captureDate) && "cursor-not-allowed opacity-60",
                hasItems
                  ? "h-20 border-2 border-dashed border-[#ded9cd] rounded-xl hover:border-[#b8b7e1] hover:bg-[#eeedf9]/40"
                  : "h-72 border-2 border-dashed border-slate-200 rounded-4xl hover:border-primary/30 hover:shadow-lg shadow-sm hover:scale-[1.01]"
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!batchModality || !captureDate) {
                  setContextError("Choose the specimen modality and capture date before uploading.");
                  return;
                }
                handleFiles(Array.from(e.dataTransfer.files));
              }}
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <div
                className={cn(
                  "absolute inset-0 flex flex-col items-center justify-center transition-all",
                  hasItems ? "gap-1 scale-90" : "gap-4"
                )}
              >
                <UploadCloud
                  className={cn(
                    "text-slate-300 group-hover:text-primary transition-colors",
                    hasItems ? "w-6 h-6" : "w-16 h-16"
                  )}
                />
                <div className="text-center px-4">
                  <p className="font-semibold text-slate-700 group-hover:text-primary transition-colors text-sm">
                    {hasItems
                      ? "Add more files"
                      : "Choose photos or drop a ZIP"}
                  </p>
                  {!hasItems && (
                    <p className="text-sm text-slate-400 mt-2 font-medium">
                      JPG, PNG, WEBP, or ZIP
                    </p>
                  )}
                </div>
              </div>
            </button>
            <input
              type="file"
              multiple
              accept="image/*,.zip"
              className="sr-only"
              id="file-upload"
              onChange={(e) =>
                batchModality && captureDate
                  ? handleFiles(Array.from(e.target.files || []))
                  : setContextError("Choose the specimen modality and capture date before uploading.")
              }
            />
          </motion.div>

          {/* Sidebar Progress Controls - Fixed to bottom */}
          {hasItems && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-auto flex w-full shrink-0 flex-col gap-3 border-t border-[#ded9cd] bg-[#fbfaf7] p-4"
            >
              <div className="order-2 space-y-2 border border-[#ded9cd] bg-white p-3">
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-1.5 bg-slate-100" />
                <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-600 pt-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    {uploadedCount} uploaded
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {completeCount} analyzed
                  </div>
                </div>
              </div>

              <div className="order-1 space-y-3">
                {/* Split Buttons: Upload vs Analyze */}

                {items.some((i) => i.status === "pending") && (
                  <Button
                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:bg-slate-200"
                    onClick={handleUpload}
                    disabled={isProcessing || !batchModality || !captureDate}
                  >
                    {isProcessing &&
                    items.some((i) => i.status === "pending") ? (
                      <Loader2 className="animate-spin mr-2 w-4 h-4" />
                    ) : (
                      <Cloud className="mr-2 w-4 h-4" />
                    )}
                    Upload Pending (
                    {items.filter((i) => i.status === "pending").length})
                  </Button>
                )}

                {hasCropProposalItems && (
                  <Button
                    className="h-10 w-full rounded-lg bg-sky-700 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-600"
                    onClick={handleProposeRois}
                    disabled={isProcessing || !canAnalyze}
                  >
                    {isProcessing ? (
                      <Loader2 className="animate-spin mr-2 w-4 h-4" />
                    ) : (
                      <Sparkles className="mr-2 w-4 h-4" />
                    )}
                    Suggest crops (
                    {items.filter((item) => item.status === "uploaded" || item.status === "crop_error").length}
                    )
                  </Button>
                )}

                {items.some((item) => item.status === "roi_review") && (
                  <Button
                    variant="outline"
                    className="h-10 w-full rounded-lg border-sky-300 bg-sky-50 text-sm font-semibold text-sky-950 hover:bg-sky-100"
                    onClick={confirmAllSuggestedRois}
                    disabled={isProcessing}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Confirm all visible crops (
                    {items.filter((item) => item.status === "roi_review").length}
                    )
                  </Button>
                )}

                {(hasAnalyzableItems || isProcessing) && (
                  <Button
                    className="h-11 w-full rounded-lg bg-[#454a9f] text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#383d89]"
                    onClick={handleAnalyze}
                    disabled={isProcessing || !hasAnalyzableItems || !canAnalyze}
                  >
                    {isProcessing && !items.some((i) => i.status === "pending") ? (
                      <Loader2 className="animate-spin mr-2 w-4 h-4" />
                    ) : (
                      <CloudLightning className="mr-2 w-4 h-4" />
                    )}
                    Analyze confirmed crops (
                    {items.filter((item) => item.status === "roi_confirmed").length}
                    )
                  </Button>
                )}

                {items.some((i) => i.status === "complete") && (
                  <>
                    <label
                      className={cn(
                        "flex items-start gap-2 rounded-xl border p-3 text-xs leading-5",
                        analyzedMissingAssignments.length === 0 && analyzedMissingStageDecisions.length === 0
                          ? "cursor-pointer border-blue-200 bg-blue-50 text-blue-950"
                          : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={hasAcknowledgedBatchReview}
                        onChange={(event) => setBatchReviewAcknowledgedFor(event.target.checked ? batchReviewKey : null)}
                        disabled={analyzedMissingAssignments.length > 0 || analyzedMissingStageDecisions.length > 0}
                        className="mt-0.5 h-4 w-4 rounded border-blue-400 text-primary focus:ring-primary"
                      />
                      <span>I reviewed all {analyzedItems.length} suggestion{analyzedItems.length === 1 ? "" : "s"} and want to save the selected stages as the lab record.</span>
                    </label>
                    {reviewRequiredItems.length > 0 && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                        <div className="flex gap-2">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                          <div>
                            <p className="font-semibold">{reviewRequiredItems.length} prediction{reviewRequiredItems.length === 1 ? "" : "s"} need review</p>
                            <p className="mt-1 text-xs leading-5 text-amber-900/80">Open each flagged image to check the suggestion before saving this batch.</p>
                          </div>
                        </div>
                        <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs leading-5 text-amber-950">
                          <input
                            type="checkbox"
                            checked={hasAcknowledgedReviews}
                            onChange={(event) => setReviewAcknowledgedFor(event.target.checked ? reviewKey : null)}
                            className="mt-0.5 h-4 w-4 rounded border-amber-400 text-primary focus:ring-primary"
                          />
                          <span>I reviewed the flagged predictions and want to save the selected stages.</span>
                        </label>
                      </div>
                    )}
                    <Button
                      className="w-full bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 h-12 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                      onClick={handleSaveAll}
                      disabled={isSaving || !canSave}
                    >
                      {isSaving ? (
                        <Loader2 className="animate-spin mr-2 w-4 h-4" />
                      ) : (
                        <Check className="mr-2 w-4 h-4" />
                      )}
                      {isSaving ? "Saving..." : "Save reviewed results"}
                    </Button>
                  </>
                )}

                {analyzedMissingAssignments.length > 0 && (
                  <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                    {analyzedMissingAssignments.length} analyzed image
                    {analyzedMissingAssignments.length > 1
                      ? "s are"
                      : " is"}{" "}
                    still unassigned.
                  </div>
                )}

                {analyzedMissingStageDecisions.length > 0 && (
                  <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                    Choose a scientist-confirmed stage for {analyzedMissingStageDecisions.length} image
                    {analyzedMissingStageDecisions.length === 1 ? "" : "s"}.
                  </div>
                )}

                <div className="w-full text-center text-[11px] text-slate-500 bg-slate-100/70 rounded-xl py-2 border border-slate-200">
                  Every saved observation must belong to a subject.
                </div>
              </div>
            </motion.div>
          )}
        </motion.aside>

        {/* --- MIDDLE: Grid --- */}
        <AnimatePresence mode="popLayout">
          {hasItems && (
            <motion.main
              layout
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="relative z-10 flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[#f7f4ed]"
            >
              <div className="sticky top-0 z-20 flex h-20 shrink-0 items-center justify-between border-b border-[#ded9cd] bg-[#fbfaf7]/95 px-6 backdrop-blur-xl">
                <h2 className="font-serif text-2xl text-[#292b4c]">
                  Crop review{" "}
                  <span className="ml-2 font-sans text-sm font-normal text-[#77736c]">
                    {items.length} items
                  </span>
                </h2>

                {/* Visual Indicator of State */}
                  <div className="hidden items-center gap-4 text-xs font-medium text-[#625f58] xl:flex">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                    Pending
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    Uploaded
                  </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      Analyzed
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                      Needs review
                    </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative">
                <ScrollArea className="h-full w-full">
                  <div className="p-8 pb-32">
                    <motion.div
                      layout
                      className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4"
                    >
                      <AnimatePresence>
                        {reviewOrderedItems.map((item) => (
                          <motion.div
                            layout
                            key={item.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            whileHover={{
                              y: -4,
                              transition: { duration: 0.2 },
                            }}
                            onClick={() => {
                              setSelectedId(selectedId === item.id ? null : item.id);
                            }}
                            className={cn(
                              "relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-[#ded9cd] bg-white shadow-sm transition-all group",
                              selectedId === item.id
                                ? "z-10 border-[#d48342] ring-2 ring-[#d48342]/25 shadow-lg"
                                : "hover:border-[#b8b7e1] hover:shadow-md",
                              item.status === "saved" && "opacity-50 grayscale",
                              item.status === "complete" &&
                                (!item.confirmedStage ||
                                  !(item.assignedSubjectId || item.newSubjectName)) &&
                                "ring-4 ring-amber-200",
                              item.status === "crop_error" && "ring-4 ring-amber-300"
                            )}
                          >
                            <Image
                              src={
                                item.croppedImageUrl &&
                                ["roi_review", "roi_confirmed", "crop_error", "analyzing", "complete", "saved"].includes(item.status)
                                  ? item.croppedImageUrl
                                  : item.previewUrl
                              }
                              alt=""
                              fill
                              sizes="(min-width: 1024px) 220px, 45vw"
                              className="object-contain bg-slate-100 p-2"
                              unoptimized={item.previewUrl.includes('storage.googleapis.com')}
                            />

                            {/* Selection Border (Inner) */}
                            {selectedId === item.id && (
                              <div className="pointer-events-none absolute inset-0 z-20 rounded-xl border-2 border-[#d48342]" />
                            )}

                            {/* Status Icons */}
                            <div className="absolute top-3 right-3 z-10 flex gap-1">
                              {item.status === "uploading" && (
                                <div className="bg-white/90 rounded-full p-1.5 shadow-sm backdrop-blur-md">
                                  <UploadCloud className="w-3 h-3 animate-bounce text-slate-600" />
                                </div>
                              )}
                              {(item.status === "uploaded" ||
                                item.status === "analyzing" ||
                                item.status === "complete") && (
                                <div className="bg-blue-500 text-white rounded-full p-1.5 shadow-lg shadow-blue-500/20">
                                  <Cloud className="w-3 h-3" />
                                </div>
                              )}
                              {item.status === "analyzing" && (
                                <div className="bg-white/90 rounded-full p-1.5 shadow-sm backdrop-blur-md">
                                  <Loader2 className="w-3 h-3 animate-spin text-purple-600" />
                                </div>
                              )}
                              {item.status === "proposing_roi" && (
                                <div className="bg-white/90 rounded-full p-1.5 shadow-sm backdrop-blur-md">
                                  <Loader2 className="w-3 h-3 animate-spin text-sky-700" />
                                </div>
                              )}
                              {item.status === "complete" && (
                                <div className="bg-emerald-500 text-white rounded-full p-1.5 shadow-lg shadow-emerald-500/20">
                                  <Check className="w-3 h-3" />
                                </div>
                              )}
                            </div>

                            {item.status === "roi_review" && (
                              <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
                                <Badge className="border-0 bg-amber-400 px-3 py-1 text-xs font-bold text-amber-950 shadow-lg">
                                  Review crop
                                </Badge>
                              </div>
                            )}
                            {item.status === "crop_error" && (
                              <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
                                <Badge className="whitespace-nowrap border-0 bg-amber-500 px-3 py-1 text-xs font-bold text-amber-950 shadow-lg">
                                  <AlertTriangle className="mr-1 h-3 w-3" /> Check framing
                                </Badge>
                              </div>
                            )}
                            {item.status === "roi_confirmed" && (
                              <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
                                <Badge className="border-0 bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-lg">
                                  Crop confirmed
                                </Badge>
                              </div>
                            )}

                            <div className="absolute top-3 left-3 z-10">
                              <span
                                className={cn(
                                  "block w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm",
                                  item.assignedSubjectId || item.newSubjectName
                                    ? "bg-emerald-500"
                                    : "bg-amber-400"
                                )}
                                title={
                                  getAssignmentLabel(item) ||
                                  "Unassigned subject"
                                }
                              />
                            </div>

                            {/* Bottom review state */}
                            {item.result &&
                              (() => {
                                const stageName = item.confirmedStage;
                                return (
                                  <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="absolute bottom-0 left-0 right-0 p-4 bg-linear-to-t from-black/80 via-black/40 to-transparent pt-12"
                                  >
                                    <div className="flex items-center justify-center">
                                      <Badge
                                        className={cn(
                                          "backdrop-blur-md border-0 shadow-lg font-bold px-3 py-1 text-xs tracking-wide",
                                          !stageName && "bg-amber-400 text-amber-950"
                                        )}
                                        style={stageName ? { backgroundColor: getColor(stageName), color: "white" } : undefined}
                                      >
                                        {stageName || "Choose stage"}
                                      </Badge>
                                    </div>
                                  </motion.div>
                                );
                              })()}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                </ScrollArea>
              </div>
            </motion.main>
          )}
        </AnimatePresence>

        {/* --- RIGHT: Inspector --- */}
        <AnimatePresence>
          {selectedItem && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 420, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 32 }}
              className="z-30 flex h-full shrink-0 flex-col overflow-hidden border-l border-[#ded9cd] bg-[#fbfaf7] shadow-xl"
            >
              <div className={cn(
                "relative border-b border-slate-100 bg-linear-to-br from-slate-100 via-slate-50 to-white shrink-0",
                selectedItem.croppedImageUrl ? "h-80" : "h-72"
              )}>
                <div className={cn(
                  "absolute inset-0 grid",
                  selectedItem.croppedImageUrl ? "grid-cols-2" : "grid-cols-1"
                )}>
                  <figure className="relative min-w-0 border-r border-slate-200 bg-[#f4f1e9]">
                    <figcaption className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700 shadow-sm">
                      Full source
                    </figcaption>
                    <Image src={selectedItem.previewUrl} alt="Full source image" fill sizes="210px" className="object-contain p-6" unoptimized />
                  </figure>
                  {selectedItem.croppedImageUrl && (
                    <figure className="relative min-w-0 bg-slate-950">
                      <figcaption className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700 shadow-sm">
                        Suggested crop
                      </figcaption>
                      <div className="absolute inset-6 flex items-center justify-center">
                        <div
                          className="relative h-full max-w-full overflow-hidden"
                          style={{ aspectRatio: `${EXTERNAL_ROI_OUTPUT_WIDTH} / ${EXTERNAL_ROI_OUTPUT_HEIGHT}` }}
                        >
                          <Image src={selectedItem.croppedImageUrl} alt="Suggested prepared crop" fill sizes="210px" className="object-contain" unoptimized />
                          <div
                            className="pointer-events-none absolute border border-dashed border-white/90 shadow-[0_0_0_999px_rgba(15,23,42,0.12)]"
                            style={{
                              left: `${((1 - DINO_FIELD_FRACTION_X) / 2) * 100}%`,
                              right: `${((1 - DINO_FIELD_FRACTION_X) / 2) * 100}%`,
                              top: `${((1 - DINO_FIELD_FRACTION_Y) / 2) * 100}%`,
                              bottom: `${((1 - DINO_FIELD_FRACTION_Y) / 2) * 100}%`,
                            }}
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    </figure>
                  )}
                </div>

                {/* Analyzing overlay animation */}
                {selectedItem.status === "analyzing" && (
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <motion.div
                      className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent"
                      initial={{ top: "10%" }}
                      animate={{ top: ["10%", "90%", "10%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                  </motion.div>
                )}

                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => setSelectedId(null)}
                  className="absolute top-4 right-4 bg-white/80 hover:bg-white shadow-sm rounded-full backdrop-blur-md z-10"
                >
                  <Minimize2 className="w-4 h-4 text-slate-500" />
                </Button>

                {/* File Info Overlay */}
                <div className="absolute bottom-4 left-6 right-6">
                  <div className="bg-white/90 backdrop-blur-md border border-slate-200/50 rounded-xl p-3 shadow-sm flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-xs font-semibold text-slate-900 truncate"
                        title={selectedItem.filename}
                      >
                        {selectedItem.filename}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[10px] text-slate-500 truncate font-mono">
                          {selectedItem.id}
                        </p>
                        <span className="text-[10px] text-slate-300">•</span>
                        <p className="text-[10px] text-slate-500 truncate">
                          {selectedItemMeta}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-slate-50 text-[10px] px-2 h-5"
                    >
                      {STATUS_LABELS[selectedItem.status]}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative bg-slate-50/30">
                <div className="h-full overflow-y-auto">
                  <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="p-6 pr-8 space-y-6 max-w-full"
                  >
                    {editingRoiId === selectedItem.id && roiEditorFile ? (
                      <div className="space-y-3">
                        <PreparedRoiCropper
                          key={`${selectedItem.id}-${roiEditorFile.name}`}
                          file={roiEditorFile}
                          compact
                          initialMetadata={selectedItem.cropReview?.metadata}
                          onPrepared={(file, metadata) => setPreparedRoi({ file, metadata })}
                          onFramingChange={() => setPreparedRoi(null)}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingRoiId(null);
                              setRoiEditorFile(null);
                              setPreparedRoi(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={saveAdjustedRoi}
                            disabled={!preparedRoi || isSavingRoi}
                            className="bg-slate-900 text-white hover:bg-slate-800"
                          >
                            {isSavingRoi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            Save crop
                          </Button>
                        </div>
                      </div>
                    ) : selectedItem.croppedImageUrl && ["roi_review", "roi_confirmed"].includes(selectedItem.status) ? (
                      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-700">Prepared model input</p>
                        <h3 className="mt-1 text-lg font-semibold">
                          {selectedItem.status === "roi_confirmed" ? "Crop confirmed" : "Check the suggested crop"}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-sky-900/80">
                          The dashed inner field is what the frozen processor retains. Confirm this suggestion or adjust the exception before any model analysis runs.
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            className="border-sky-300 bg-white text-sky-950 hover:bg-sky-100"
                            onClick={() => beginRoiAdjustment(selectedItem)}
                          >
                            Adjust crop
                          </Button>
                          <Button
                            className="bg-sky-800 text-white hover:bg-sky-700"
                            onClick={() => confirmSuggestedRoi(selectedItem)}
                            disabled={selectedItem.status === "roi_confirmed" || isProcessing}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            {selectedItem.status === "roi_confirmed" ? "Confirmed" : "Confirm crop"}
                          </Button>
                        </div>
                      </section>
                    ) : selectedItem.status === "crop_error" ? (
                      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                        <h3 className="font-semibold">Image needs reframing or recapture</h3>
                        <p className="mt-1 text-xs leading-5">The automatic anchor is weak. If the anatomy is present, adjust the frame. If it falls outside the source image, remove this item and recapture it.</p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Button variant="outline" onClick={() => beginRoiAdjustment(selectedItem)}>
                            Adjust frame
                          </Button>
                          <Button variant="outline" className="border-amber-300 bg-white" onClick={discardSelectedItem}>
                            Remove · recapture
                          </Button>
                        </div>
                      </section>
                    ) : null}

                    {selectedItem.status === "complete" && selectedItem.result && (
                      <section className="border border-[#c9c7e7] bg-[#eeedf9] p-4" aria-labelledby="binary-model-lead" data-tour="binary-model-lead">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#555a9d]">DINOv2 binary model · review aid</p>
                            <h3 id="binary-model-lead" className="mt-1 font-serif text-2xl text-[#292b4c]">{selectedBinaryLabel}</h3>
                          </div>
                          <Badge variant="outline" className={cn(
                            "rounded-full bg-white",
                            selectedBinaryLabel === "Abstain" ? "border-amber-300 text-amber-800" : "border-emerald-300 text-emerald-800"
                          )}>
                            {selectedAcquisitionLabel}
                          </Badge>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-[#5e5d75]">
                          {selectedBinaryLabel === "Abstain"
                            ? "The model withheld a group lead. Review the image and make the stage call from your own evidence."
                            : "This is a broad early-versus-late lead, not the exact stage and not the saved lab record."}
                        </p>
                        {selectedBinaryEvidence?.abstention_reasons.length ? (
                          <p className="mt-2 text-xs font-medium text-amber-900">Check: {selectedBinaryEvidence.abstention_reasons.join(" · ")}</p>
                        ) : null}
                      </section>
                    )}

                    {selectedItem.status === "complete" && selectedItem.result && (
                      <section className="border-2 border-[#292b4c] bg-white p-5 shadow-sm" aria-labelledby="batch-stage-decision" data-tour="scientist-stage-call">
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Your decision · required</p>
                        <h3 id="batch-stage-decision" className="mt-1 text-xl font-semibold text-slate-950">Choose the stage to save</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-600">Your selection becomes the lab record.</p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          {stageNames.map((stage) => {
                            const selected = selectedItem.confirmedStage === stage;
                            return (
                              <button
                                key={stage}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => confirmItemStage(selectedItem.id, stage)}
                                className={cn(
                                  "rounded-xl border px-3 py-3 text-left text-sm font-semibold transition",
                                  selected
                                    ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                                    : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-400 hover:bg-white"
                                )}
                              >
                                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: getColor(stage) }} />
                                {stage}
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-4 space-y-1.5">
                          <Label htmlFor={`batch-note-${selectedItem.id}`} className="text-xs font-semibold text-[#625f58]">Notes (optional)</Label>
                          <Textarea
                            id={`batch-note-${selectedItem.id}`}
                            value={selectedItem.notes ?? ""}
                            maxLength={500}
                            onChange={(event) => updateItemNotes(selectedItem.id, event.target.value)}
                            placeholder="Add an observation note…"
                            className="min-h-20 resize-none border-[#ded9cd] bg-[#fbfaf7]"
                          />
                          <p className="text-right text-[10px] text-[#8b877f]">{selectedItem.notes?.length ?? 0}/500</p>
                        </div>
                      </section>
                    )}

                    {selectedItem.result && <details className="group border border-[#ded9cd] bg-white">
                      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[#625f58]">
                        Legacy four-stage evidence
                        <span className="text-base font-normal transition group-open:rotate-45">+</span>
                      </summary>
                      <div className="space-y-4 border-t border-[#ded9cd] p-4">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className={cn(
                        "rounded-3xl p-6 border border-white/20 shadow-xl shadow-slate-900/5 text-white overflow-hidden relative",
                        `bg-linear-to-br ${getGradient(selectedStageName ?? "")}`
                      )}
                    >
                      <div className="relative z-10">
                        <div className="flex items-start justify-between gap-3 mb-6">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.25em] text-white/70 font-bold">
                              Legacy model suggestion
                            </p>
                            <h3 className="text-4xl font-bold mt-1 tracking-tight">
                              {selectedStageName || "Awaiting"}
                            </h3>
                          </div>
                          <div className="bg-white/20 rounded-full p-2 backdrop-blur-md">
                            <Sparkles className="w-5 h-5 text-white" />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-medium text-white/90 uppercase tracking-wide">
                              <span>Relative model support</span>
                              <span>
                                {selectedItem.result
                                  ? `${Math.round(
                                      selectedStageConfidence * 100
                                    )}%`
                                  : "--"}
                              </span>
                            </div>
                            <div className="h-2 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{
                                  width: `${
                                    selectedItem.result
                                      ? selectedStageConfidence * 100
                                      : 0
                                  }%`,
                                }}
                                transition={{ duration: 1, ease: "circOut" }}
                                className="h-full bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                              />
                            </div>
                          </div>

                          {/* Cycle Wheel Visualization */}
                          {selectedItem.result?.confidence_scores && (
                            <div className="pt-2 border-t border-white/10">
                              <div className="flex justify-center py-2">
                                <CycleWheel
                                  confidences={selectedItem.result.confidence_scores}
                                  predictedStage={selectedStageName ?? undefined}
                                  isAnalyzing={selectedItem.status === "analyzing"}
                                  size={160}
                                  stages={stages}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Decorational blurred circles */}
                      <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-black/10 rounded-full blur-3xl pointer-events-none" />
                    </motion.div>

                    {selectedItem.result?.review_required && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                        <div className="flex gap-3">
                          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                          <div>
                            <h4 className="font-semibold">Scientist review required</h4>
                            <p className="mt-1 leading-6 text-amber-900/80">This visual suggestion must be checked before the batch can be saved.</p>
                            {selectedItem.result.review_reasons?.length ? (
                              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-amber-900/80">
                                {selectedItem.result.review_reasons.map((reason) => <li key={reason}>{reason}</li>)}
                              </ul>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Confidence Breakdown */}
                    {selectedItem.result?.confidence_scores && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"
                      >
                        <h4 className="text-xs uppercase tracking-[0.2em] text-slate-400 font-bold mb-4">
                          Relative model support
                        </h4>
                        <ConfidenceBars
                          confidences={selectedItem.result.confidence_scores}
                          predictedStage={selectedStageName ?? undefined}
                          stages={stages}
                        />
                      </motion.div>
                    )}
                    <div className="space-y-2 border-t border-[#ded9cd] pt-4 text-xs leading-5 text-[#625f58]">
                      <p><span className="font-semibold text-[#292b4c]">Model version:</span> {selectedItem.result.model_version || "Legacy exploratory model"}</p>
                      <p><span className="font-semibold text-[#292b4c]">Reasoning:</span> {selectedItem.result.reasoning || "No model reasoning was stored."}</p>
                      {Object.keys(selectedItem.result.features || {}).length > 0 && (
                        <p><span className="font-semibold text-[#292b4c]">Detected features:</span> {Object.entries(selectedItem.result.features).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}</p>
                      )}
                      {selectedItemSource && <p className="break-all font-mono text-[10px] text-[#77736c]">{selectedItemSource.replace("https://storage.googleapis.com/", "")}</p>}
                    </div>
                      </div>
                    </details>}

                    {selectedItem.status === "complete" &&
                    selectedItem.result ? (
                      <>
                        <div className="space-y-4">
                          <h4 className="text-xs uppercase tracking-[0.2em] text-slate-400 font-bold pl-1">
                            {subjectLabel} Assignment
                          </h4>
                          <div className="space-y-2">
                            <Label className="text-xs text-slate-500 font-semibold">
                              Select existing {subjectNoun}
                            </Label>
                            <Select
                              value={
                                selectedItem.assignedSubjectId ??
                                UNASSIGNED_SELECT_VALUE
                              }
                              onValueChange={(value) =>
                                assignExistingSubject(
                                  selectedItem.id,
                                  value === UNASSIGNED_SELECT_VALUE
                                    ? undefined
                                    : value
                                )
                              }
                              disabled={
                                subjectsLoading && subjects.length === 0
                              }
                            >
                              <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl">
                                <SelectValue
                                  placeholder={
                                    subjectsLoading
                                      ? `Loading ${subjectNounPlural}...`
                                      : `Choose ${subjectNoun}`
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={UNASSIGNED_SELECT_VALUE}>
                                  Unassigned
                                </SelectItem>
                                {subjects.map((subject) => (
                                  <SelectItem
                                    key={subject.id}
                                    value={subject.id}
                                  >
                                    {subject.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <span>
                                {subjectsLoading
                                  ? "Loading..."
                                  : `${subjects.length} ${subjects.length === 1 ? subjectNoun : subjectNounPlural}`}
                              </span>
                              <button
                                type="button"
                                onClick={loadSubjects}
                                className="text-slate-500 hover:text-slate-800 font-medium"
                              >
                                Refresh
                              </button>
                            </div>
                            {subjectsError && (
                              <p className="text-[11px] text-amber-600">
                                {subjectsError}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs text-slate-500 font-semibold">
                              Or create a new {subjectNoun}
                            </Label>
                            <Input
                              placeholder="Enter identifier e.g. 227A"
                              value={selectedItem.newSubjectName ?? ""}
                              onChange={(e) =>
                                assignNewSubjectName(
                                  selectedItem.id,
                                  e.target.value
                                )
                              }
                              className="h-11 bg-white border-slate-200 rounded-xl"
                            />
                            <p className="text-[11px] text-slate-400">
                              New {subjectNounPlural} will be created automatically when
                              you save.
                            </p>
                          </div>
                        </div>

                      </>
                    ) : (
                      <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center h-full min-h-[300px] border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                          <Loader2
                            className={cn(
                              "w-8 h-8",
                              selectedItem.status === "analyzing"
                                ? "animate-spin text-blue-500"
                                : "text-slate-300"
                            )}
                          />
                        </div>
                        <h3 className="font-medium text-slate-900 mb-1">
                          {selectedItem.status === "analyzing"
                            ? "Analyzing Image"
                            : selectedItem.status === "roi_confirmed"
                              ? "Ready for analysis"
                              : "Waiting for input"}
                        </h3>
                        <p className="text-sm text-slate-500 max-w-[200px]">
                          {selectedItem.status === "analyzing"
                            ? "The confirmed model field is being evaluated."
                            : selectedItem.status === "roi_confirmed"
                            ? "Run analysis after every crop is confirmed."
                            : selectedItem.status === "uploaded"
                            ? "Ready to be analyzed"
                            : "Upload this file to begin analysis"}
                        </p>
                      </div>
                    )}
                  </motion.div>
                </div>
              </div>

              <div className="border-t border-slate-200 bg-white p-6 z-20 shrink-0">
                <Button
                  variant="outline"
                  onClick={discardSelectedItem}
                  className="h-12 w-full rounded-xl border-slate-200 font-medium transition-colors hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Remove from batch
                </Button>
                <p className="mt-3 text-center text-[11px] leading-4 text-slate-400">
                  Review the whole batch and save from the checklist on the left.
                </p>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}
