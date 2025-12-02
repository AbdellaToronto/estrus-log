"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  ChevronRight,
  Calendar,
  TrendingUp,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Subject {
  id: string;
  name: string;
  status?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface Log {
  id: string;
  mouse_id: string | null;
  stage: string;
  created_at: string;
  image_url?: string;
}

interface SubjectWithStats extends Subject {
  logCount: number;
  lastLog?: Log;
  stageBreakdown: Record<string, number>;
  recentStages: string[];
}

const STAGE_COLORS: Record<string, string> = {
  Proestrus: "bg-amber-100 text-amber-700 border-amber-200",
  Estrus: "bg-rose-100 text-rose-700 border-rose-200",
  Metestrus: "bg-purple-100 text-purple-700 border-purple-200",
  Diestrus: "bg-blue-100 text-blue-700 border-blue-200",
};

export function CohortSubjects({
  subjects,
  logs,
}: {
  subjects: Subject[];
  logs: Log[];
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  // Compute stats for each subject
  const subjectsWithStats = useMemo(() => {
    const logsBySubject = new Map<string, Log[]>();

    logs.forEach((log) => {
      if (log.mouse_id) {
        const existing = logsBySubject.get(log.mouse_id) || [];
        existing.push(log);
        logsBySubject.set(log.mouse_id, existing);
      }
    });

    return subjects
      .map((subject) => {
        const subjectLogs = logsBySubject.get(subject.id) || [];
        const sortedLogs = [...subjectLogs].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        const stageBreakdown: Record<string, number> = {};
        subjectLogs.forEach((log) => {
          stageBreakdown[log.stage] = (stageBreakdown[log.stage] || 0) + 1;
        });

        // Get last 5 stages for trend visualization
        const recentStages = sortedLogs.slice(0, 5).map((l) => l.stage);

        return {
          ...subject,
          logCount: subjectLogs.length,
          lastLog: sortedLogs[0],
          stageBreakdown,
          recentStages,
        } as SubjectWithStats;
      })
      .sort((a, b) => b.logCount - a.logCount); // Sort by most logged first
  }, [subjects, logs]);

  // Filter by search
  const filteredSubjects = subjectsWithStats.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedData = selectedSubject
    ? subjectsWithStats.find((s) => s.id === selectedSubject)
    : null;

  if (subjects.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Search className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          No Subjects Yet
        </h3>
        <p className="text-slate-500 max-w-md mx-auto">
          Subjects are automatically created when you upload and analyze images.
          The subject name is extracted from the filename.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search subjects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-white/50 border-slate-200"
        />
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/60 rounded-xl p-4 border border-slate-200/60">
          <p className="text-2xl font-bold text-slate-900">{subjects.length}</p>
          <p className="text-sm text-slate-500">Total Subjects</p>
        </div>
        <div className="bg-white/60 rounded-xl p-4 border border-slate-200/60">
          <p className="text-2xl font-bold text-slate-900">{logs.length}</p>
          <p className="text-sm text-slate-500">Total Logs</p>
        </div>
        <div className="bg-white/60 rounded-xl p-4 border border-slate-200/60">
          <p className="text-2xl font-bold text-slate-900">
            {subjects.length > 0
              ? (logs.length / subjects.length).toFixed(1)
              : 0}
          </p>
          <p className="text-sm text-slate-500">Avg Logs/Subject</p>
        </div>
        <div className="bg-white/60 rounded-xl p-4 border border-slate-200/60">
          <p className="text-2xl font-bold text-slate-900">
            {subjectsWithStats.filter((s) => s.status === "Active").length ||
              subjects.length}
          </p>
          <p className="text-sm text-slate-500">Active Subjects</p>
        </div>
      </div>

      {/* Subject Grid */}
      <div className="grid gap-3">
        {filteredSubjects.map((subject, i) => (
          <motion.div
            key={subject.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() =>
              setSelectedSubject(
                selectedSubject === subject.id ? null : subject.id
              )
            }
            className={cn(
              "bg-white/80 rounded-xl p-4 border border-slate-200/60 cursor-pointer transition-all hover:shadow-md hover:border-blue-200",
              selectedSubject === subject.id && "ring-2 ring-blue-500 border-blue-300"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Subject Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                  {subject.name.slice(0, 2).toUpperCase()}
                </div>

                {/* Name & Stats */}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">
                      {subject.name}
                    </h3>
                    {subject.status && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          subject.status === "Active"
                            ? "border-green-200 text-green-700 bg-green-50"
                            : "border-slate-200 text-slate-500"
                        )}
                      >
                        {subject.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {subject.logCount} logs
                    {subject.lastLog && (
                      <span className="ml-2 text-slate-400">
                        • Last:{" "}
                        {new Date(subject.lastLog.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Recent Stages Trend */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {subject.recentStages.map((stage, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border",
                        STAGE_COLORS[stage] || "bg-slate-100 text-slate-600"
                      )}
                      title={stage}
                    >
                      {stage[0]}
                    </div>
                  ))}
                </div>
                <ChevronRight
                  className={cn(
                    "w-5 h-5 text-slate-400 transition-transform",
                    selectedSubject === subject.id && "rotate-90"
                  )}
                />
              </div>
            </div>

            {/* Expanded Details */}
            {selectedSubject === subject.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 pt-4 border-t border-slate-100"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(subject.stageBreakdown).map(([stage, count]) => (
                    <div
                      key={stage}
                      className={cn(
                        "rounded-lg p-3 border",
                        STAGE_COLORS[stage] || "bg-slate-50 border-slate-200"
                      )}
                    >
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-xs opacity-80">{stage}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Created:{" "}
                    {new Date(subject.created_at).toLocaleDateString()}
                  </span>
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {filteredSubjects.length === 0 && searchTerm && (
        <div className="text-center py-8 text-slate-500">
          No subjects matching "{searchTerm}"
        </div>
      )}
    </div>
  );
}

