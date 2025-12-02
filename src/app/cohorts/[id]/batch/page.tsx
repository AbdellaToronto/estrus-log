"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
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
  FlaskConical,
  Minimize2,
  FileUp,
  Cloud,
  CloudLightning,
  Copy,
  Sparkles,
  X,
  Brain,
  Eye,
  EyeOff,
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
  startScanSessionAnalysis,
  getCohort,
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
    | "analyzing"
    | "complete"
    | "error"
    | "saved";
  gcsUrl?: string;
  croppedImageUrl?: string; // Segmented/cropped image
  maskImageUrl?: string; // Segmentation mask for visualization
  result?: ClassificationResult;
  assignedSubjectId?: string;
  newSubjectName?: string;
};

type SubjectOption = {
  id: string;
  name: string;
};

const STATUS_LABELS: Record<ScanItem["status"], string> = {
  pending: "Pending upload",
  uploading: "Uploading",
  uploaded: "Uploaded",
  analyzing: "Analyzing",
  complete: "Analyzed",
  error: "Needs attention",
  saved: "Saved",
};

const UNASSIGNED_SELECT_VALUE = "__none";

type DbScanItem = {
  id: string;
  image_url: string;
  status: string | null;
  ai_result: ClassificationResult | null;
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
    result: (item.ai_result as ClassificationResult) || undefined,
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
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [showCroppedImage, setShowCroppedImage] = useState(false);
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
  const { stages, getColor, getGradient, subjectLabel } = useParsedCohortConfig(cohort);

  const selectedItem = items.find((i) => i.id === selectedId);
  const hasItems = items.length > 0;
  const completeCount = items.filter(
    (i) => i.status === "complete" || i.status === "saved"
  ).length;
  const uploadedCount = items.filter((i) =>
    ["uploaded", "analyzing", "complete", "saved"].includes(i.status)
  ).length;
  const progress = useMemo(
    () => (items.length ? (completeCount / items.length) * 100 : 0),
    [items.length, completeCount]
  );
  const hasActiveAnalysis = useMemo(
    () =>
      items.some((i) => i.status === "uploaded" || i.status === "analyzing"),
    [items]
  );
  const hasAnalyzableItems = useMemo(
    () => items.some((i) => i.status === "uploaded" || i.status === "error"),
    [items]
  );
  const selectedItemSource = selectedItem?.gcsUrl?.split("?")[0];
  const selectedStageName = getPrimaryStageName(selectedItem?.result);
  const selectedStageConfidence = getPrimaryStageConfidence(
    selectedItem?.result
  );
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

  const handleCopyLink = async (item: ScanItem) => {
    if (!item.gcsUrl) return;
    try {
      await navigator.clipboard.writeText(item.gcsUrl);
      setCopiedLinkId(item.id);
      setTimeout(() => {
        setCopiedLinkId((prev) => (prev === item.id ? null : prev));
      }, 1500);
    } catch (error) {
      console.error("Failed to copy link", error);
    }
  };

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
          const dbItems = await getScanItems(session.id);
          if (dbItems && dbItems.length > 0) {
            // Cast to unknown first if types don't perfectly align (e.g. Json vs concrete type)
            // but prefer explicit type assertion over 'any'
            const restored: ScanItem[] = dbItems
              .filter((i) => i.status !== "pending")
              .map((i) => deserializeServerItem(i as unknown as DbScanItem));
            setItems((prev) => [...prev, ...restored]);
            if (restored.length > 0) setSelectedId(restored[0].id);
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
    try {
      const session = await createScanSession(cohortId);
      setSessionId(session.id);
      return session.id;
    } catch (e) {
      console.error("Failed to create session", e);
      return null;
    }
  };

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
            result: (server.ai_result as ClassificationResult) || item.result,
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

  const canSave = analyzedItems.length > 0;

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

            updateItemState(item.id, "uploading");

            await fetch(urlData.url, {
              method: "PUT",
              body: item.file,
              headers: { "Content-Type": item.file!.type },
            });

            updateItemState(item.id, "uploaded", { gcsUrl: urlData.publicUrl });

            if (item.scanItemId) {
              updateScanItem(item.scanItemId, {
                status: "uploaded",
                imageUrl: urlData.publicUrl,
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

  // --- Action: Analyze ---

  const handleAnalyze = async () => {
    setIsProcessing(true);
    try {
      const currentSessionId = await ensureSession();
      if (!currentSessionId) {
        throw new Error("No active session found");
      }

      await startScanSessionAnalysis(currentSessionId);

      setItems((prev) =>
        prev.map((item) =>
          item.status === "uploaded" ? { ...item, status: "analyzing" } : item
        )
      );

      refreshItemsFromServer();
    } catch (e) {
      console.error("Failed to queue analysis", e);
      alert("Failed to start analysis job. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveAll = useCallback(async () => {
    setIsSaving(true);
    try {
      if (analyzedItems.length === 0) {
        alert("No analyzed items to save yet.");
        return;
      }

      const payload = analyzedItems.map((item) => {
        const primaryStage = getPrimaryStagePrediction(item.result!)!;
        return {
          filename: item.filename,
          imageUrl: item.gcsUrl!,
          stage: primaryStage.name,
          confidence: primaryStage.confidence,
          features: toFeaturePayload(item.result!.features),
          reasoning: item.result!.reasoning ?? "",
          scanItemId: item.scanItemId,
          subjectId: item.assignedSubjectId,
          newSubjectName: item.newSubjectName?.trim() || undefined,
          flexibleData: {
            confidence_scores: item.result!.confidence_scores,
            thoughts: item.result!.thoughts,
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
    <div className="fixed inset-0 h-dvh z-50 bg-slate-50/90 backdrop-blur-3xl flex overflow-hidden animate-in fade-in duration-300">
      <LayoutGroup>
        {/* --- LEFT PANEL: Controls / Upload --- */}
        <motion.aside
          layout
          className={cn(
            "border-r border-slate-200 bg-white/80 flex flex-col relative z-20 backdrop-blur-xl shadow-xl h-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
            hasItems ? "w-80 shrink-0" : "w-full items-center justify-center"
          )}
          initial={false}
        >
          {/* Header Area */}
          <motion.div
            layout
            className={cn(
              "p-6 flex flex-col items-center w-full shrink-0 transition-all",
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
                  Batch Analysis
                </h1>
                <p className="text-lg text-slate-500 max-w-md mx-auto leading-relaxed">
                  Drag and drop your raw image data or ZIP archives here. <br />
                  Gemini AI will classify and organize everything automatically.
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
              <div className="w-full mb-6">
                <div className="flex items-center justify-between mb-6">
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
                    {sessionId ? "Active Session" : "Processing"}
                  </h1>
                  <p className="text-sm text-slate-500 font-medium mt-1">
                    {items.length} files queued
                  </p>
                </div>
              </div>
            )}

            {/* Dropzone - Compact Mode */}
            <div
              className={cn(
                "relative transition-all duration-500 cursor-pointer group overflow-hidden w-full bg-white",
                hasItems
                  ? "h-32 border-2 border-dashed border-slate-200 rounded-2xl hover:border-blue-500/50 hover:bg-blue-50/50"
                  : "h-72 border-2 border-dashed border-slate-200 rounded-4xl hover:border-primary/30 hover:shadow-lg shadow-sm hover:scale-[1.01]"
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFiles(Array.from(e.dataTransfer.files));
              }}
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <div
                className={cn(
                  "absolute inset-0 flex flex-col items-center justify-center transition-all",
                  hasItems ? "gap-2 scale-90" : "gap-4"
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
                      : "Click to browse or drop file"}
                  </p>
                  {!hasItems && (
                    <p className="text-sm text-slate-400 mt-2 font-medium">
                      Supports JPG, PNG, WEBP, ZIP
                    </p>
                  )}
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*,.zip"
                  className="hidden"
                  id="file-upload"
                  onChange={(e) =>
                    handleFiles(Array.from(e.target.files || []))
                  }
                />
              </div>
            </div>
          </motion.div>

          {/* Sidebar Progress Controls - Fixed to bottom */}
          {hasItems && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 space-y-6 w-full mt-auto border-t border-slate-100 shrink-0 bg-white/50 backdrop-blur-sm pb-8"
            >
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
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

              <div className="space-y-3">
                {/* Split Buttons: Upload vs Analyze */}

                {items.some((i) => i.status === "pending") && (
                  <Button
                    className="w-full bg-slate-100 text-slate-900 hover:bg-slate-200 h-12 rounded-xl font-semibold text-sm transition-all border border-slate-200 shadow-sm"
                    onClick={handleUpload}
                    disabled={isProcessing}
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

                <Button
                  className="w-full bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-900/10 h-12 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                  onClick={handleAnalyze}
                  disabled={isProcessing || !hasAnalyzableItems}
                >
                  {isProcessing &&
                  !items.some((i) => i.status === "pending") ? (
                    <Loader2 className="animate-spin mr-2 w-4 h-4" />
                  ) : (
                    <CloudLightning className="mr-2 w-4 h-4" />
                  )}
                  Analyze Uploaded (
                  {
                    items.filter(
                      (i) => i.status === "uploaded" || i.status === "error"
                    ).length
                  }
                  )
                </Button>

                {items.some((i) => i.status === "complete") && (
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
                    {isSaving ? "Saving..." : "Save Results"}
                  </Button>
                )}

                {analyzedMissingAssignments.length > 0 && (
                  <div className="text-xs text-slate-500 bg-slate-100/80 border border-slate-200 rounded-xl p-3 text-center">
                    {analyzedMissingAssignments.length} analyzed image
                    {analyzedMissingAssignments.length > 1
                      ? "s are"
                      : " is"}{" "}
                    still unassigned. You can save now or assign later.
                  </div>
                )}

                <div className="w-full text-center text-[11px] text-slate-500 bg-slate-100/70 rounded-xl py-2 border border-slate-200">
                  Assignments help link results to subjects but are optional.
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
              className="flex-1 bg-slate-50/50 flex flex-col relative z-10 min-w-0 h-full overflow-hidden"
            >
              <div className="h-20 border-b border-slate-200 flex items-center justify-between px-8 bg-white/80 backdrop-blur-xl sticky top-0 z-20 shrink-0">
                <h2 className="font-semibold text-slate-800 text-lg">
                  Library{" "}
                  <span className="text-slate-400 ml-2 font-normal">
                    {items.length} items
                  </span>
                </h2>

                {/* Visual Indicator of State */}
                <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
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
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative">
                <ScrollArea className="h-full w-full">
                  <div className="p-8 pb-32">
                    <motion.div
                      layout
                      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6"
                    >
                      <AnimatePresence>
                        {items.map((item) => (
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
                            onClick={() =>
                              setSelectedId(
                                selectedId === item.id ? null : item.id
                              )
                            }
                            className={cn(
                              "aspect-square rounded-3xl overflow-hidden relative cursor-pointer transition-all group bg-white shadow-sm",
                              selectedId === item.id
                                ? "ring-[6px] ring-blue-500/20 shadow-2xl z-10 scale-[1.02]"
                                : "hover:shadow-lg hover:ring-4 hover:ring-slate-200/50",
                              item.status === "saved" && "opacity-50 grayscale",
                              item.status === "complete" &&
                                !(
                                  item.assignedSubjectId || item.newSubjectName
                                ) &&
                                "ring-4 ring-amber-200"
                            )}
                          >
                            <Image
                              src={item.previewUrl}
                              alt=""
                              fill
                              className="object-cover"
                              unoptimized={item.previewUrl.includes('storage.googleapis.com')}
                            />

                            {/* Selection Border (Inner) */}
                            {selectedId === item.id && (
                              <div className="absolute inset-0 border-4 border-blue-500 rounded-3xl z-20 pointer-events-none" />
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
                              {item.status === "complete" && (
                                <div className="bg-emerald-500 text-white rounded-full p-1.5 shadow-lg shadow-emerald-500/20">
                                  <Check className="w-3 h-3" />
                                </div>
                              )}
                            </div>

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

                            {/* Bottom Result Label */}
                            {item.result &&
                              (() => {
                                const stageName =
                                  getPrimaryStageName(item.result) ??
                                  "Uncertain";
                                return (
                                  <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="absolute bottom-0 left-0 right-0 p-4 bg-linear-to-t from-black/80 via-black/40 to-transparent pt-12"
                                  >
                                    <div className="flex items-center justify-center">
                                      <Badge
                                        className="backdrop-blur-md border-0 shadow-lg text-white font-bold px-3 py-1 text-xs tracking-wide"
                                        style={{ backgroundColor: getColor(stageName) }}
                                      >
                                        {stageName}
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
              animate={{ width: 480, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 32 }}
              className="border-l border-slate-200 bg-white flex flex-col overflow-hidden shadow-2xl z-30 shrink-0 h-full"
            >
              <div className="h-72 relative bg-linear-to-br from-slate-100 via-slate-50 to-white border-b border-slate-100 shrink-0">
                {/* Original Image */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={showCroppedImage && selectedItem.croppedImageUrl ? "cropped" : "original"}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={showCroppedImage && selectedItem.croppedImageUrl 
                        ? selectedItem.croppedImageUrl 
                        : selectedItem.previewUrl}
                      alt=""
                      fill
                      className={cn(
                        "object-contain p-8",
                        showCroppedImage && selectedItem.croppedImageUrl && "bg-black"
                      )}
                      unoptimized
                    />
                  </motion.div>
                </AnimatePresence>

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

                {/* Toggle cropped/original button */}
                {selectedItem.croppedImageUrl && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowCroppedImage(!showCroppedImage)}
                    className="absolute top-4 left-4 bg-white/80 hover:bg-white shadow-sm rounded-full backdrop-blur-md z-10 gap-1.5 text-xs"
                  >
                    {showCroppedImage ? (
                      <>
                        <EyeOff className="w-3 h-3" />
                        Original
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" />
                        Segmented
                      </>
                    )}
                  </Button>
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
                              Classification
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
                              <span>Confidence Score</span>
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

                    {/* Confidence Breakdown */}
                    {selectedItem.result?.confidence_scores && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"
                      >
                        <h4 className="text-xs uppercase tracking-[0.2em] text-slate-400 font-bold mb-4">
                          Confidence Breakdown
                        </h4>
                        <ConfidenceBars
                          confidences={selectedItem.result.confidence_scores}
                          predictedStage={selectedStageName ?? undefined}
                          stages={stages}
                        />
                      </motion.div>
                    )}

                    {selectedItem.status === "complete" &&
                    selectedItem.result ? (
                      <>
                        <div className="space-y-4">
                          <h4 className="text-xs uppercase tracking-[0.2em] text-slate-400 font-bold pl-1">
                            {subjectLabel} Assignment
                          </h4>
                          <div className="space-y-2">
                            <Label className="text-xs text-slate-500 font-semibold">
                              Select existing {subjectLabel.toLowerCase()}
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
                                      ? `Loading ${subjectLabel.toLowerCase()}s...`
                                      : `Choose ${subjectLabel.toLowerCase()}`
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
                                  : `${subjects.length} ${subjectLabel.toLowerCase()}${subjects.length !== 1 ? 's' : ''}`}
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
                              Or create a new {subjectLabel.toLowerCase()}
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
                              New {subjectLabel.toLowerCase()}s will be created automatically when
                              you save.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {selectedItem.result.thoughts && (
                            <>
                              <h4 className="text-xs uppercase tracking-[0.2em] text-slate-400 font-bold flex items-center gap-2 pl-1">
                                <Brain className="w-3 h-3" /> Thinking Process
                              </h4>
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 }}
                                className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 shadow-inner leading-relaxed text-xs text-slate-500 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto mb-6"
                              >
                                {selectedItem.result.thoughts}
                              </motion.div>
                            </>
                          )}

                          <h4 className="text-xs uppercase tracking-[0.2em] text-slate-400 font-bold flex items-center gap-2 pl-1">
                            <FlaskConical className="w-3 h-3" /> AI Reasoning
                          </h4>
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm leading-relaxed text-sm text-slate-600"
                          >
                            {selectedItem.result.reasoning}
                          </motion.div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-xs uppercase tracking-[0.2em] text-slate-400 font-bold pl-1">
                            Detected Features
                          </h4>
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="grid grid-cols-2 gap-3"
                          >
                            {Object.entries(
                              selectedItem.result.features || {}
                            ).map(([key, value]) => (
                              <div
                                key={key}
                                className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm flex flex-col justify-center"
                              >
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                                  {key}
                                </span>
                                <span
                                  className="text-sm font-medium text-slate-800 capitalize truncate"
                                  title={String(value)}
                                >
                                  {String(value)}
                                </span>
                              </div>
                            ))}
                          </motion.div>
                        </div>

                        {selectedItemSource && (
                          <div className="pt-4 border-t border-slate-200/60">
                            <div className="flex items-center gap-2 bg-slate-100/50 rounded-lg p-2 border border-slate-200/50 group hover:bg-slate-100 transition-colors">
                              <div className="bg-white p-1.5 rounded-md border border-slate-200 shadow-sm text-slate-500">
                                <Cloud className="w-3 h-3" />
                              </div>
                              <span className="text-xs font-mono text-slate-500 truncate flex-1">
                                {selectedItemSource.replace(
                                  "https://storage.googleapis.com/",
                                  ""
                                )}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-slate-700"
                                onClick={() => handleCopyLink(selectedItem)}
                              >
                                {copiedLinkId === selectedItem.id ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
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
                            : "Waiting for Input"}
                        </h3>
                        <p className="text-sm text-slate-500 max-w-[200px]">
                          {selectedItem.status === "analyzing"
                            ? "Gemini is currently processing this image..."
                            : selectedItem.status === "uploaded"
                            ? "Ready to be analyzed"
                            : "Upload this file to begin analysis"}
                        </p>
                      </div>
                    )}
                  </motion.div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 bg-white z-20 shrink-0">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-12 rounded-xl border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 font-medium transition-colors"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Discard
                  </Button>
                  <Button
                    disabled={selectedItem.status !== "complete" || isSaving}
                    onClick={handleSaveAll}
                    className="h-12 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-medium shadow-lg shadow-slate-900/20 hover:shadow-slate-900/30 transition-all disabled:opacity-70"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    {isSaving ? "Saving..." : "Save Batch"}
                  </Button>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}
