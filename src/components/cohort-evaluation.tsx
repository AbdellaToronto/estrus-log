"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Check,
  X,
  AlertTriangle,
  Filter,
  ChevronRight,
  ChevronDown,
  Search,
  CheckCircle2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import Image from "next/image";

// Helper to extract "ground truth" from filename
// Expected format: [SubjectID]_[Stage]_[Date].jpg or similar
// We will look for stage names in the filename
const STAGES = ["Proestrus", "Estrus", "Metestrus", "Diestrus"];

function inferGroundTruth(filename: string): string | null {
  if (!filename) return null;
  const lower = filename.toLowerCase();
  for (const stage of STAGES) {
    if (lower.includes(stage.toLowerCase())) {
      return stage;
    }
  }
  // Common abbreviations
  if (lower.includes("_pro_") || lower.includes("-pro-")) return "Proestrus";
  if (lower.includes("_est_") || lower.includes("-est-")) return "Estrus";
  if (lower.includes("_met_") || lower.includes("-met-")) return "Metestrus";
  if (lower.includes("_die_") || lower.includes("-die-")) return "Diestrus";

  return null;
}

export function CohortEvaluation({ logs }: { logs: any[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMatch, setFilterMatch] = useState<"all" | "correct" | "incorrect">("all");

  // Process logs to compare Prediction vs Ground Truth
  const evaluatedLogs = useMemo(() => {
    return logs
      .map((log) => {
        // Try to get filename from image_url
        // URL format: .../path/timestamp-filename.jpg
        const urlParts = log.image_url.split("/");
        let rawFilename = urlParts[urlParts.length - 1] || "";
        
        // Remove query params
        if (rawFilename.includes("?")) {
            rawFilename = rawFilename.split("?")[0];
        }

        // Remove timestamp prefix if present (usually 13 digits + dash)
        const filename = rawFilename.replace(/^\d+-/, "");

        const groundTruth = inferGroundTruth(filename);
        const predicted = log.stage;
        const isMatch =
          groundTruth && predicted.toLowerCase() === groundTruth.toLowerCase();

        return {
          ...log,
          filename,
          groundTruth,
          predicted,
          isMatch,
          confidence:
            typeof log.confidence === "number"
              ? log.confidence
              : log.confidence?.score || 0,
          // Access granular scores if available in flexible data
          scores: log.data?.confidence_scores || {},
        };
      })
      .filter((l) => l.groundTruth); // Only show items where we could infer truth
  }, [logs]);

  const filteredLogs = evaluatedLogs.filter((log) => {
    const matchesSearch = log.filename
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterMatch === "all"
        ? true
        : filterMatch === "correct"
        ? log.isMatch
        : !log.isMatch;
    return matchesSearch && matchesFilter;
  });

  const stats = useMemo(() => {
    const total = evaluatedLogs.length;
    const correct = evaluatedLogs.filter((l) => l.isMatch).length;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;

    // Breakdown by Ground Truth Stage
    const byStage = STAGES.reduce((acc, stage) => {
      const stageLogs = evaluatedLogs.filter(
        (l) => l.groundTruth?.toLowerCase() === stage.toLowerCase()
      );
      const stageCorrect = stageLogs.filter((l) => l.isMatch).length;
      acc[stage] = {
        total: stageLogs.length,
        correct: stageCorrect,
        accuracy:
          stageLogs.length > 0 ? (stageCorrect / stageLogs.length) * 100 : 0,
      };
      return acc;
    }, {} as Record<string, { total: number; correct: number; accuracy: number }>);

    return { total, correct, accuracy, byStage };
  }, [evaluatedLogs]);

  if (evaluatedLogs.length === 0) {
    return (
      <div className="glass-panel rounded-3xl p-12 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">
          No Ground Truth Found
        </h3>
        <p className="text-slate-500 max-w-md mx-auto mt-2">
          To evaluate accuracy, filenames must include the stage name (e.g.,
          "Mouse1_Estrus_001.jpg"). We couldn't detect any stage names in your
          file names.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl p-5 shadow-sm"
        >
          <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">
            Overall Accuracy
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">
              {Math.round(stats.accuracy)}%
            </span>
            <span className="text-sm text-slate-500">
              ({stats.correct}/{stats.total})
            </span>
          </div>
          <Progress
            value={stats.accuracy}
            className={cn(
              "h-1.5 mt-3",
              stats.accuracy > 80 ? "bg-emerald-100" : "bg-slate-100"
            )}
            // Note: We need to style the indicator inside Progress component or use inline style if wrapper exposes it
            // Assuming standard shadcn Progress
          />
        </motion.div>

        {STAGES.map((stage, idx) => {
          const s = stats.byStage[stage];
          if (s.total === 0) return null;
          return (
            <motion.div
              key={stage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl p-5 shadow-sm"
            >
              <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">
                {stage}
              </p>
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-2xl font-bold",
                    s.accuracy > 80
                      ? "text-emerald-600"
                      : s.accuracy < 50
                      ? "text-rose-500"
                      : "text-slate-700"
                  )}
                >
                  {Math.round(s.accuracy)}%
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {s.correct} / {s.total} correct
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Detailed Table */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-slate-200/60 shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white/50">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search filenames..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white border-slate-200 w-64 rounded-xl h-9 text-sm"
              />
            </div>
            <Select
              value={filterMatch}
              onValueChange={(v: any) => setFilterMatch(v)}
            >
              <SelectTrigger className="w-[140px] h-9 rounded-xl bg-white border-slate-200">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="correct">Correct Only</SelectItem>
                <SelectItem value="incorrect">Incorrect Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs font-medium text-slate-500">
            Showing {filteredLogs.length} evaluations
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="w-[100px]">Image</TableHead>
              <TableHead>Filename</TableHead>
              <TableHead>Ground Truth</TableHead>
              <TableHead>Prediction</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead className="text-right">Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map((log) => (
              <TableRow key={log.id} className="hover:bg-slate-50/50 border-slate-100">
                <TableCell>
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                    <Image
                      src={log.image_url}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  </div>
                </TableCell>
                <TableCell className="font-medium text-slate-700 text-xs font-mono max-w-[300px]">
                  <div className="truncate" title={log.filename}>
                    {log.filename}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-slate-50">
                    {log.groundTruth}
                  </Badge>
                </TableCell>
                <TableCell>
                   <div className="flex flex-col gap-1">
                    <Badge
                      className={cn(
                        "w-fit border-0 shadow-sm",
                        log.predicted === "Estrus" && "bg-rose-100 text-rose-700 hover:bg-rose-200",
                        log.predicted === "Proestrus" && "bg-pink-100 text-pink-700 hover:bg-pink-200",
                        log.predicted === "Metestrus" && "bg-sky-100 text-sky-700 hover:bg-sky-200",
                        log.predicted === "Diestrus" && "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      )}
                    >
                      {log.predicted}
                    </Badge>
                    {/* Show other high scores if ambiguous */}
                    {log.scores && Object.keys(log.scores).length > 0 && (
                       <div className="text-[10px] text-slate-400">
                          {Object.entries(log.scores)
                             .filter(([s, v]) => s !== log.predicted && (v as number) > 0.1)
                             .map(([s, v]) => `${s.slice(0,3)}:${Math.round((v as number)*100)}%`)
                             .join(", ")
                          }
                       </div>
                    )}
                   </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          log.confidence > 0.8 ? "bg-emerald-400" : "bg-amber-400"
                        )}
                        style={{ width: `${log.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                      {Math.round(log.confidence * 100)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {log.isMatch ? (
                    <div className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full text-xs font-medium border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Match
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-1 rounded-full text-xs font-medium border border-rose-100">
                      <X className="w-3.5 h-3.5" />
                      Miss
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

