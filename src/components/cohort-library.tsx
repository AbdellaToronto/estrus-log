"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  Search,
  Filter,
  Calendar as CalendarIcon,
  ArrowUpDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Log = {
  id: string;
  stage: string;
  confidence: number | { score: number };
  created_at: string;
  image_url: string | null;
  subjectName?: string;
  mice?: { name: string } | null;
};

type Subject = {
  id: string;
  name: string;
};

const STAGES = ["Proestrus", "Estrus", "Metestrus", "Diestrus", "Uncertain"];

export function CohortLibrary({
  logs,
  subjects,
}: {
  logs: any[];
  subjects: any[];
}) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "confidence">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Helper to extract numeric confidence
  const getConfidence = (log: any) => {
    const c = log.confidence;
    return typeof c === "number" ? c : c?.score || 0;
  };

  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => {
        const matchesSearch =
          log.subjectName?.toLowerCase().includes(search.toLowerCase()) ||
          log.mice?.name?.toLowerCase().includes(search.toLowerCase()) ||
          log.stage.toLowerCase().includes(search.toLowerCase());

        const matchesStage =
          stageFilter === "all" || log.stage === stageFilter;

        const matchesSubject =
          subjectFilter === "all" ||
          log.mouse_id === subjectFilter ||
          (!log.mouse_id && subjectFilter === "unassigned");

        return matchesSearch && matchesStage && matchesSubject;
      })
      .sort((a, b) => {
        if (sortBy === "date") {
          return sortOrder === "desc"
            ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        } else {
          const confA = getConfidence(a);
          const confB = getConfidence(b);
          return sortOrder === "desc" ? confB - confA : confA - confB;
        }
      });
  }, [logs, search, stageFilter, subjectFilter, sortBy, sortOrder]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between bg-white/50 p-4 rounded-2xl border border-slate-200/50 backdrop-blur-sm">
        <div className="flex flex-1 gap-3 min-w-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by subject, stage..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-slate-200 rounded-xl focus-visible:ring-blue-500"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[140px] rounded-xl bg-white border-slate-200">
              <div className="flex items-center gap-2 text-slate-600">
                <Filter className="w-3.5 h-3.5" />
                <SelectValue placeholder="Stage" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-[140px] rounded-xl bg-white border-slate-200">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={sortBy}
            onValueChange={(v: any) => setSortBy(v)}
          >
            <SelectTrigger className="w-[130px] rounded-xl bg-white border-slate-200">
              <div className="flex items-center gap-2 text-slate-600">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="confidence">Confidence</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="rounded-xl"
          >
            <ArrowUpDown
              className={cn(
                "w-4 h-4 transition-transform",
                sortOrder === "asc" ? "rotate-180" : ""
              )}
            />
          </Button>
        </div>
      </div>

      {/* Grid */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">No images found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredLogs.map((log) => (
              <motion.div
                layout
                key={log.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-sm hover:shadow-lg transition-all"
              >
                {log.image_url ? (
                  <Image
                    src={log.image_url}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-300">
                    No Image
                  </div>
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-end">
                  <div className="flex items-center justify-between mb-1">
                    <Badge
                      className={cn(
                        "border-0 backdrop-blur-md",
                        getStageColor(log.stage)
                      )}
                    >
                      {log.stage}
                    </Badge>
                    <span className="text-xs font-bold text-white/90">
                      {Math.round(getConfidence(log) * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-white/80 text-xs">
                    <span className="font-medium truncate max-w-[60%]">
                      {log.subjectName || log.mice?.name || "Unassigned"}
                    </span>
                    <span>{format(new Date(log.created_at), "MMM d")}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function getStageColor(stage: string) {
  switch (stage) {
    case "Estrus":
      return "bg-rose-500/80 text-white";
    case "Proestrus":
      return "bg-pink-500/80 text-white";
    case "Metestrus":
      return "bg-sky-500/80 text-white";
    case "Diestrus":
      return "bg-emerald-500/80 text-white";
    default:
      return "bg-slate-500/80 text-white";
  }
}

