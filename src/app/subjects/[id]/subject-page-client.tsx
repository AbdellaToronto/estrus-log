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
import { motion } from "framer-motion";

type ConfidenceShape = number | Record<string, number> | null;

type SubjectLog = {
  id: string;
  stage: string;
  confidence: ConfidenceShape;
  created_at: string;
  image_url: string | null;
  notes?: string | null;
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
  Uncertain: "#cbd5f5",
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

  const getConfidence = (log: SubjectLog) => {
    if (typeof log.confidence === "number") return log.confidence;
    if (log.confidence && typeof log.confidence === "object") {
      const val = log.confidence[log.stage] ?? log.confidence.score;
      if (typeof val === "number") return val;
    }
    return 0;
  };

  const confidenceScore = selectedLog ? getConfidence(selectedLog) : 0;

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground/80">
          Analysis View: {subject.name}
        </h1>
        <div className="flex items-center gap-4">
          <Avatar className="h-9 w-9 border-2 border-white/20 shadow-sm">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>LW</AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Top Row: Charts & Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-48">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-3xl p-5 flex flex-col justify-between border border-white/40 shadow-sm bg-white/40 backdrop-blur-xl"
        >
          <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
            Activity Trend
          </h3>
          <div className="flex-1 mt-2 min-h-0">
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
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel rounded-3xl p-5 flex flex-col justify-between border border-white/40 shadow-sm bg-white/40 backdrop-blur-xl"
        >
          <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
            Stage Distribution
          </h3>
          <div className="flex-1 mt-2 min-h-0">
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
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel rounded-3xl p-5 flex flex-col gap-2 justify-center items-start border border-white/40 shadow-sm bg-white/40 backdrop-blur-xl"
        >
          <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
            Total Scans
          </div>
          <div className="text-5xl font-bold text-slate-800 tracking-tight">
            {logs.length}
          </div>

          <div className="w-full h-px bg-slate-200/50 my-2" />

          <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
            Most Frequent
          </div>
          <div
            className="text-2xl font-semibold"
            style={{ color: mostFrequentColor }}
          >
            {mostFrequentStage}
          </div>
        </motion.div>
      </div>

      {/* Main Split View */}
      <div className="grid lg:grid-cols-[1fr_400px] gap-8 h-[600px]">
        {/* Left: Image Viewer */}
        <div className="glass-panel rounded-3xl p-4 relative flex flex-col overflow-hidden border border-white/40 shadow-sm bg-white/60 backdrop-blur-xl">
          <div className="absolute top-6 left-6 z-10 flex flex-col gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-xl bg-white/80 backdrop-blur shadow-sm hover:bg-white border border-white/50"
            >
              <ZoomIn className="h-5 w-5 text-slate-700" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-xl bg-white/80 backdrop-blur shadow-sm hover:bg-white border border-white/50"
            >
              <ZoomOut className="h-5 w-5 text-slate-700" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-xl bg-white/80 backdrop-blur shadow-sm hover:bg-white border border-white/50"
            >
              <Maximize2 className="h-5 w-5 text-slate-700" />
            </Button>
          </div>

          {selectedLog && (
            <div className="absolute top-6 right-6 z-10">
              <Badge
                variant="secondary"
                className="bg-white/90 backdrop-blur-xl text-slate-800 px-3 py-1.5 rounded-lg shadow-sm border border-white/50"
              >
                <span className="mr-2">✨</span> AI Detected
              </Badge>
            </div>
          )}

          {/* Main Image Area */}
          <div className="flex-1 bg-slate-50/50 rounded-2xl flex items-center justify-center overflow-hidden relative border border-slate-100/50">
            {selectedLog ? (
              <div className="relative h-full w-full">
                {selectedLog.image_url ? (
                  <Image
                    src={selectedLog.image_url}
                    alt={`${selectedLog.stage} scan`}
                    fill
                    sizes="(max-width: 1024px) 90vw, 60vw"
                    className="object-contain rounded-lg shadow-lg"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    No preview available
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-400 flex flex-col items-center gap-2">
                <div className="bg-white p-4 rounded-full shadow-sm">
                  <Search className="w-8 h-8 text-slate-300" />
                </div>
                <p>Select a log to view details</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Analysis Panel */}
        <div className="flex flex-col gap-6">
          {/* Result Card */}
          {selectedLog ? (
            <div className="glass-panel rounded-3xl p-6 space-y-6 border border-white/40 shadow-sm bg-white/60 backdrop-blur-xl">
              <div>
                <div className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">
                  Estrus Stage
                </div>
                <div className="text-4xl font-bold text-slate-900 tracking-tight">
                  {selectedLog.stage}
                </div>

                <div className="flex justify-between text-sm mt-4 mb-2">
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
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                  <motion.div
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
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                  Analysis Notes
                </div>
                <div className="text-sm text-slate-600 leading-relaxed bg-white/50 p-4 rounded-xl border border-white/50">
                  {selectedLog.notes || "No notes available for this scan."}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-3xl p-8 flex flex-col items-center justify-center text-center text-slate-400 border border-white/40 shadow-sm bg-white/60 backdrop-blur-xl h-full">
              <p>No scan selected</p>
            </div>
          )}

          <LogEntryModal subjectId={subject.id} onLogCreated={handleLogCreated} />
        </div>
      </div>

      {/* Bottom: Data Library */}
      <div className="glass-panel rounded-3xl p-8 flex flex-col gap-6 border border-white/40 shadow-sm bg-white/60 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-1">
              Project: {subject.cohorts?.name || "Unassigned"}
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Data Library</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search scans..."
              className="pl-10 bg-white/70 border-slate-200 rounded-full w-72 focus:bg-white transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`group cursor-pointer transition-all duration-200 ${
                selectedLog?.id === log.id ? "scale-105" : "hover:scale-102"
              }`}
              onClick={() => setSelectedLog(log)}
            >
              <div
                className={`aspect-video rounded-2xl bg-slate-100 overflow-hidden relative mb-2 border shadow-sm transition-all ${
                  selectedLog?.id === log.id
                    ? "ring-2 ring-offset-2 ring-primary border-primary"
                    : "border-white/50 group-hover:shadow-md"
                }`}
              >
                {log.image_url ? (
                  <Image
                    src={log.image_url}
                    alt={log.stage}
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 15vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
                    No preview
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

                <div className="absolute top-2 right-2">
                  <Badge
                    className={`
                    text-[10px] px-2 py-0.5 h-5 backdrop-blur-md border-0 shadow-sm
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
              <div className="flex justify-between items-center px-1 mt-2">
                <span
                  className={`text-xs font-medium ${
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
