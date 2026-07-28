"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  ArrowUpDown,
  Search,
  Filter,
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
import type { LogDisplay, SubjectDisplay } from "@/lib/types";

interface Log extends LogDisplay {
  subjectName?: string;
  mice?: { name: string } | null;
  data?: Record<string, unknown> | null;
}

const STAGES = ["Proestrus", "Estrus", "Metestrus", "Diestrus", "Uncertain", "Uncertain / transition"];

export function CohortLibrary({
  logs,
  subjects,
}: {
  logs: Log[];
  subjects: SubjectDisplay[];
}) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

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
        return sortOrder === "desc"
          ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
  }, [logs, search, stageFilter, subjectFilter, sortOrder]);

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
          <span className="text-xs font-medium text-[#77736c]">Capture date</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            aria-label={sortOrder === "desc" ? "Show oldest records first" : "Show newest records first"}
            className="rounded-xl border-[#ded9cd] bg-white"
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {filteredLogs.map((log) => (
              <motion.div
                layout
                key={log.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border border-[#ded9cd] bg-white transition hover:border-[#b8b7e1] hover:shadow-md"
              >
                <div className="relative aspect-[4/3] bg-[#f0ede5]">
                  {log.image_url ? (
                    <Image src={log.image_url} alt="" fill className="object-contain p-2" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-[#77736c]">No image</div>
                  )}
                  <Badge className={cn("absolute left-3 top-3 border-0", getStageColor(log.stage))}>
                    {log.stage}
                  </Badge>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#292b4c]">{log.subjectName || log.mice?.name || "Unassigned"}</p>
                      <p className="mt-1 text-xs text-[#77736c]">{format(new Date(log.created_at), "MMM d, yyyy · h:mm a")}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#66627a]">
                      {getConfirmationLabel(log)}
                    </span>
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

function getConfirmationLabel(log: Log) {
  const context = log.data?.observation_context;
  if (!context || typeof context !== "object" || Array.isArray(context)) return "Reviewed";
  return (context as Record<string, unknown>).confirmation_source === "paired_cytology_review"
    ? "Cytology paired"
    : "Scientist reviewed";
}
