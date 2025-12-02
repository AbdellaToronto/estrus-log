"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Clock,
  ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Upload,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ScanSessionSummary } from "@/app/actions";

const STAGE_COLORS: Record<string, string> = {
  Proestrus: "#F472B6",
  Estrus: "#EF4444",
  Metestrus: "#A855F7",
  Diestrus: "#3B82F6",
};

type Cohort = {
  id: string;
  name: string;
  description?: string | null;
};

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SessionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    pending: {
      label: "In Progress",
      className: "bg-amber-100 text-amber-700 border-amber-200",
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
    },
    processing: {
      label: "Processing",
      className: "bg-blue-100 text-blue-700 border-blue-200",
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
    },
    review: {
      label: "Needs Review",
      className: "bg-orange-100 text-orange-700 border-orange-200",
      icon: <AlertCircle className="w-3 h-3" />,
    },
    completed: {
      label: "Completed",
      className: "bg-green-100 text-green-700 border-green-200",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
  };

  const { label, className, icon } = config[status] || config.pending;

  return (
    <Badge variant="outline" className={`${className} gap-1`}>
      {icon}
      {label}
    </Badge>
  );
}

function StageBreakdownMini({ breakdown }: { breakdown: Record<string, number> }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <div className="flex gap-1">
      {Object.entries(breakdown).map(([stage, count]) => (
        <div
          key={stage}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
          style={{
            backgroundColor: `${STAGE_COLORS[stage]}20`,
            color: STAGE_COLORS[stage],
          }}
        >
          {count}
        </div>
      ))}
    </div>
  );
}

export function ScanHistoryClient({
  cohort,
  sessions,
}: {
  cohort: Cohort;
  sessions: ScanSessionSummary[];
}) {
  const totalScans = sessions.reduce((sum, s) => sum + s.itemCount, 0);
  const completedScans = sessions.reduce((sum, s) => sum + s.completedCount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50/30">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/cohorts/${cohort.id}`}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Scan History</h1>
                <p className="text-sm text-slate-500">{cohort.name}</p>
              </div>
            </div>
            <Link href={`/cohorts/${cohort.id}/batch`}>
              <Button className="gap-2">
                <Upload className="w-4 h-4" />
                New Scan
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{sessions.length}</p>
                  <p className="text-sm text-slate-500">Scan Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <ImageIcon className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{totalScans}</p>
                  <p className="text-sm text-slate-500">Total Images</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{completedScans}</p>
                  <p className="text-sm text-slate-500">Classified</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sessions List */}
        {sessions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No scan sessions yet
              </h3>
              <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                Upload images to start tracking estrus stages for this cohort.
              </p>
              <Link href={`/cohorts/${cohort.id}/batch`}>
                <Button>
                  <Upload className="w-4 h-4 mr-2" />
                  Start First Scan
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((session, index) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/scans/${session.id}`}>
                  <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-rose-100 to-rose-50 rounded-xl flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-rose-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-slate-900 group-hover:text-primary transition-colors">
                                {session.name || "Untitled Session"}
                              </h3>
                              <SessionStatusBadge status={session.status} />
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDateTime(session.created_at)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {formatRelativeTime(session.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          {/* Image count */}
                          <div className="text-right">
                            <p className="text-lg font-semibold text-slate-900">
                              {session.completedCount}/{session.itemCount}
                            </p>
                            <p className="text-xs text-slate-500">classified</p>
                          </div>

                          {/* Stage breakdown */}
                          <StageBreakdownMini breakdown={session.stageBreakdown} />

                          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

