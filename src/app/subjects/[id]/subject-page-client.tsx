"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogEntryModal } from "@/components/log-entry-modal";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { motion, type HTMLMotionProps } from "framer-motion";

// Workaround for framer-motion + React 19 type incompatibility
const MotionDiv = motion.div as React.FC<
  HTMLMotionProps<"div"> & { children?: React.ReactNode }
>;

type ConfidenceShape = number | Record<string, number> | null;

type SubjectLog = {
  id: string;
  stage: string;
  confidence: ConfidenceShape;
  created_at: string;
  image_url: string | null;
  notes?: string | null;
  data?: Record<string, unknown> | null;
};

type SubjectSummary = {
  id: string;
  name: string;
  cohorts?: { name?: string | null } | null;
};

type TimelinePoint = {
  date: string;
  confidence: number;
};

type StageDistributionEntry = {
  name: string;
  value: number;
};

const STAGE_COLORS: Record<string, string> = {
  Proestrus: "#f472b6",
  Estrus: "#fb7185",
  Metestrus: "#38bdf8",
  Diestrus: "#34d399",
};

export function SubjectPageClient({
  subject,
  initialLogs,
}: {
  subject: SubjectSummary;
  initialLogs: SubjectLog[];
}) {
  const logs = useMemo<SubjectLog[]>(
    () => (Array.isArray(initialLogs) ? initialLogs : []),
    [initialLogs]
  );
  const [selectedLog, setSelectedLog] = useState<SubjectLog | null>(
    logs[0] || null
  );

  const handleLogCreated = () => {
    // In a real app, we'd re-fetch or use a server action to get the new log
    // For now, we'll just reload the page to get fresh data
    window.location.reload();
  };

  const timelineData = useMemo<TimelinePoint[]>(
    () =>
      logs
        .slice()
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        .map((log) => ({
          date: format(new Date(log.created_at), "MMM d"),
          confidence: Math.min(
            1,
            Math.max(
              0,
              typeof log.confidence === "number" ? log.confidence : 0.95
            )
          ),
        })),
    [logs]
  );

  const distributionData = useMemo<StageDistributionEntry[]>(() => {
    const counts = logs.reduce<Record<string, number>>((acc, log) => {
      acc[log.stage] = (acc[log.stage] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [logs]);

  const mostFrequentStage = distributionData[0]?.name ?? "N/A";
  const mostFrequentColor =
    STAGE_COLORS[mostFrequentStage] || STAGE_COLORS.Uncertain;

  const getConfidence = (log: SubjectLog): number => {
    if (typeof log.confidence === "number") return log.confidence;
    if (log.confidence && typeof log.confidence === "object") {
      const confidenceObj = log.confidence as Record<string, number>;
      const val =
        confidenceObj[log.stage] ?? (confidenceObj as { score?: number }).score;
      if (typeof val === "number") return val;
    }
    return 0;
  };

  const confidenceScore = selectedLog ? getConfidence(selectedLog) : 0;

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground/80 line-clamp-2">
          Analysis: {subject.name}
        </h1>
        <div className="hidden sm:flex items-center gap-4">
          <Avatar className="h-9 w-9 border-2 border-white/20 shadow-sm">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>LW</AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Top Row: Charts & Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <MotionDiv
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between border border-white/40 shadow-sm bg-white/40 backdrop-blur-xl min-h-[160px] sm:min-h-[180px]"
        >
          <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
            Activity Trend
          </h3>
          <div className="flex-1 mt-2 min-h-0 h-24 sm:h-auto">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  itemStyle={{ color: "#1e293b" }}
                />
                <Area
                  type="monotone"
                  dataKey="confidence"
                  stroke="#8884d8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </MotionDiv>

        <MotionDiv
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between border border-white/40 shadow-sm bg-white/40 backdrop-blur-xl min-h-[160px] sm:min-h-[180px]"
        >
          <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
            Stage Distribution
          </h3>
          <div className="flex-1 mt-2 min-h-0 h-24 sm:h-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData}>
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {distributionData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={STAGE_COLORS[entry.name] || "#94a3b8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </MotionDiv>

        <MotionDiv
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col gap-2 justify-center items-start border border-white/40 shadow-sm bg-white/40 backdrop-blur-xl min-h-[160px] sm:min-h-[180px] sm:col-span-2 lg:col-span-1"
        >
          <div className="flex w-full gap-4 sm:flex-col sm:gap-2">
            <div className="flex-1 sm:flex-none">
              <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                Total Scans
              </div>
              <div className="text-3xl sm:text-5xl font-bold text-slate-800 tracking-tight">
                {logs.length}
              </div>
            </div>

            <div className="hidden sm:block w-full h-px bg-slate-200/50 my-2" />

            <div className="flex-1 sm:flex-none">
              <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                Most Frequent
              </div>
              <div
                className="text-xl sm:text-2xl font-semibold"
                style={{ color: mostFrequentColor }}
              >
                {mostFrequentStage}
              </div>
            </div>
          </div>
        </MotionDiv>
      </div>

      {/* Main Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-4 sm:gap-6 lg:gap-8">
        {/* Left: Image Viewer */}
        <div className="glass-panel rounded-2xl sm:rounded-3xl p-3 sm:p-4 relative flex flex-col overflow-hidden border border-white/40 shadow-sm bg-white/60 backdrop-blur-xl min-h-[300px] sm:min-h-[400px] lg:min-h-[600px]">
          <div className="absolute top-3 sm:top-6 left-3 sm:left-6 z-10 flex flex-col gap-1.5 sm:gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-white/80 backdrop-blur shadow-sm hover:bg-white border border-white/50"
            >
              <ZoomIn className="h-4 w-4 sm:h-5 sm:w-5 text-slate-700" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-white/80 backdrop-blur shadow-sm hover:bg-white border border-white/50"
            >
              <ZoomOut className="h-4 w-4 sm:h-5 sm:w-5 text-slate-700" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-white/80 backdrop-blur shadow-sm hover:bg-white border border-white/50"
            >
              <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5 text-slate-700" />
            </Button>
          </div>

          {selectedLog && (
            <div className="absolute top-3 sm:top-6 right-3 sm:right-6 z-10">
              <Badge
                variant="secondary"
                className="bg-white/90 backdrop-blur-xl text-slate-800 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg shadow-sm border border-white/50 text-xs sm:text-sm"
              >
                <span className="mr-1 sm:mr-2">✨</span> AI Detected
              </Badge>
            </div>
          )}

          {/* Main Image Area */}
          <div className="flex-1 bg-slate-50/50 rounded-xl sm:rounded-2xl flex items-center justify-center overflow-hidden relative border border-slate-100/50">
            {selectedLog ? (
              <div className="relative h-full w-full">
                {selectedLog.image_url ? (
                  <Image
                    src={selectedLog.image_url}
                    alt={`${selectedLog.stage} scan`}
                    fill
                    sizes="(max-width: 768px) 95vw, (max-width: 1024px) 90vw, 60vw"
                    className="object-contain rounded-lg shadow-lg"
                    unoptimized={selectedLog.image_url.startsWith("http")}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    No preview available
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-400 flex flex-col items-center gap-2 p-4 text-center">
                <div className="bg-white p-3 sm:p-4 rounded-full shadow-sm">
                  <Search className="w-6 h-6 sm:w-8 sm:h-8 text-slate-300" />
                </div>
                <p className="text-sm sm:text-base">
                  Select a log to view details
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Analysis Panel */}
        <div className="flex flex-col gap-4 sm:gap-6">
          {/* Result Card */}
          {selectedLog ? (
            <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 sm:space-y-6 border border-white/40 shadow-sm bg-white/60 backdrop-blur-xl">
              <div>
                <div className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-1 sm:mb-2">
                  Estrus Stage
                </div>
                <div className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight">
                  {selectedLog.stage}
                </div>

                <div className="flex justify-between text-sm mt-3 sm:mt-4 mb-2">
                  <span className="text-slate-500 font-medium">
                    Confidence Score
                  </span>
                  <span className="font-bold text-slate-900">
                    {(Math.min(1, Math.max(0, confidenceScore)) * 100).toFixed(
                      1
                    )}
                    %
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-2.5 sm:h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner mb-4 sm:mb-6">
                  <MotionDiv
                    initial={{ width: 0 }}
                    animate={{ width: `${confidenceScore * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{
                      backgroundColor:
                        STAGE_COLORS[selectedLog.stage] || "#3b82f6",
                    }}
                  />
                </div>

                {/* All Scores Breakdown */}
                {(() => {
                  const scores = selectedLog.data?.confidence_scores;
                  if (!scores || typeof scores !== "object") return null;

                  const typedScores = scores as Record<string, number>;

                  return (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                        Full Breakdown
                      </div>
                      {Object.entries(typedScores).map(([stage, score]) => (
                        <div
                          key={stage}
                          className="flex items-center gap-2 text-xs"
                        >
                          <div className="w-20 font-medium text-slate-600">
                            {stage}
                          </div>
                          <div className="flex-1 h-1.5 bg-slate-50 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${score * 100}%`,
                                backgroundColor:
                                  STAGE_COLORS[stage] || "#94a3b8",
                                opacity: stage === selectedLog.stage ? 1 : 0.3,
                              }}
                            />
                          </div>
                          <div className="w-10 text-right text-slate-500">
                            {Math.round(score * 100)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Legacy Support: Fallback if data.confidence_scores is missing but confidence is an object */}
                {!selectedLog.data?.confidence_scores &&
                  selectedLog.confidence &&
                  typeof selectedLog.confidence === "object" &&
                  Object.keys(selectedLog.confidence).length > 1 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                        Full Breakdown
                      </div>
                      {Object.entries(selectedLog.confidence).map(
                        ([stage, score]) => {
                          if (stage === "score") return null; // Skip legacy field
                          const val = score as number;
                          return (
                            <div
                              key={stage}
                              className="flex items-center gap-2 text-xs"
                            >
                              <div className="w-20 font-medium text-slate-600">
                                {stage}
                              </div>
                              <div className="flex-1 h-1.5 bg-slate-50 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${val * 100}%`,
                                    backgroundColor:
                                      STAGE_COLORS[stage] || "#94a3b8",
                                    opacity:
                                      stage === selectedLog.stage ? 1 : 0.3,
                                  }}
                                />
                              </div>
                              <div className="w-10 text-right text-slate-500">
                                {Math.round(val * 100)}%
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
              </div>

              <div className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 border-t border-slate-100">
                <div className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                  Analysis Notes
                </div>
                <div className="text-sm text-slate-600 leading-relaxed bg-white/50 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-white/50">
                  {selectedLog.notes || "No notes available for this scan."}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl sm:rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center text-slate-400 border border-white/40 shadow-sm bg-white/60 backdrop-blur-xl min-h-[200px] lg:h-full">
              <p className="text-sm sm:text-base">No scan selected</p>
            </div>
          )}

          <LogEntryModal
            subjectId={subject.id}
            onLogCreated={handleLogCreated}
          />
        </div>
      </div>

      {/* Bottom: Data Library */}
      <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 flex flex-col gap-4 sm:gap-6 border border-white/40 shadow-sm bg-white/60 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-1">
              Project: {subject.cohorts?.name || "Unassigned"}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Data Library
            </h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search scans..."
              className="pl-10 bg-white/70 border-slate-200 rounded-full w-full sm:w-72 focus:bg-white transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-6">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`group cursor-pointer transition-all duration-200 ${
                selectedLog?.id === log.id
                  ? "scale-[1.02] sm:scale-105"
                  : "hover:scale-[1.01] sm:hover:scale-102"
              }`}
              onClick={() => setSelectedLog(log)}
            >
              <div
                className={`aspect-video rounded-lg sm:rounded-2xl bg-slate-100 overflow-hidden relative mb-1.5 sm:mb-2 border shadow-sm transition-all ${
                  selectedLog?.id === log.id
                    ? "ring-2 ring-offset-1 sm:ring-offset-2 ring-primary border-primary"
                    : "border-white/50 group-hover:shadow-md"
                }`}
              >
                {log.image_url ? (
                  <Image
                    src={log.image_url}
                    alt={log.stage}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 15vw"
                    className="object-cover"
                    unoptimized={log.image_url.startsWith("http")}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-[10px] sm:text-xs">
                    No preview
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

                <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2">
                  <Badge
                    className={`
                    text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 h-4 sm:h-5 backdrop-blur-md border-0 shadow-sm
                    ${
                      log.stage === "Proestrus"
                        ? "bg-pink-500/90 text-white"
                        : log.stage === "Estrus"
                        ? "bg-rose-500/90 text-white"
                        : log.stage === "Diestrus"
                        ? "bg-emerald-500/90 text-white"
                        : log.stage === "Metestrus"
                        ? "bg-sky-500/90 text-white"
                        : "bg-slate-500/90 text-white"
                    }
                  `}
                  >
                    {log.stage}
                  </Badge>
                </div>
              </div>
              <div className="flex justify-between items-center px-0.5 sm:px-1 mt-1 sm:mt-2">
                <span
                  className={`text-[10px] sm:text-xs font-medium ${
                    selectedLog?.id === log.id
                      ? "text-primary"
                      : "text-slate-500"
                  }`}
                >
                  {format(new Date(log.created_at), "MMM d, yyyy")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
