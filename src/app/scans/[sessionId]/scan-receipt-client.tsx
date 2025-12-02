"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Clock,
  ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  Download,
  Grid,
  List,
  FlaskConical,
  Sparkles,
  Eye,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScanSessionDetail } from "@/app/actions";

const STAGE_COLORS: Record<string, string> = {
  Proestrus: "#F472B6",
  Estrus: "#EF4444",
  Metestrus: "#A855F7",
  Diestrus: "#3B82F6",
};

const STAGE_BG: Record<string, string> = {
  Proestrus: "bg-pink-100",
  Estrus: "bg-red-100",
  Metestrus: "bg-purple-100",
  Diestrus: "bg-blue-100",
};

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SessionStatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; className: string; icon: React.ReactNode }
  > = {
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
    <Badge variant="outline" className={`${className} gap-1 text-sm px-3 py-1`}>
      {icon}
      {label}
    </Badge>
  );
}

function StageDistributionChart({
  breakdown,
  total,
}: {
  breakdown: Record<string, number>;
  total: number;
}) {
  if (total === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No classifications yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Object.entries(STAGE_COLORS).map(([stage, color]) => {
        const count = breakdown[stage] || 0;
        const percent = total > 0 ? (count / total) * 100 : 0;

        return (
          <div key={stage} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-slate-700">{stage}</span>
              <span className="text-slate-500">
                {count} ({percent.toFixed(0)}%)
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ImageGrid({
  items,
}: {
  items: ScanSessionDetail["items"];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {items.map((item, index) => {
          const result = item.ai_result as {
            stage?: string;
            confidence?: number;
          } | null;
          const stage = result?.stage || "Unknown";
          const confidence = result?.confidence || 0;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.02 }}
              className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 cursor-pointer"
              onClick={() => setSelectedId(item.id)}
            >
              {item.image_url ? (
                <Image
                  src={item.image_url}
                  alt={`Scan ${index + 1}`}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-slate-300" />
                </div>
              )}

              {/* Stage badge overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                <div className="flex items-center justify-between">
                  <Badge
                    className="text-xs"
                    style={{
                      backgroundColor: `${STAGE_COLORS[stage]}`,
                      color: "white",
                    }}
                  >
                    {stage}
                  </Badge>
                  {confidence > 0 && (
                    <span className="text-xs text-white/80">
                      {(confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Subject name */}
              {item.mouse_name && (
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary" className="text-xs bg-white/90">
                    {item.mouse_name}
                  </Badge>
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelectedId(null)}
          >
            {(() => {
              const item = items.find((i) => i.id === selectedId);
              if (!item) return null;
              const result = item.ai_result as {
                stage?: string;
                confidence?: number;
              } | null;

              return (
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.9 }}
                  className="relative max-w-4xl max-h-[90vh] w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.image_url && (
                    <Image
                      src={item.image_url}
                      alt="Scan detail"
                      width={1200}
                      height={900}
                      className="rounded-xl object-contain w-full h-auto max-h-[80vh]"
                    />
                  )}
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {result?.stage && (
                        <Badge
                          className="text-sm px-3 py-1"
                          style={{
                            backgroundColor: STAGE_COLORS[result.stage],
                            color: "white",
                          }}
                        >
                          {result.stage}
                        </Badge>
                      )}
                      {item.mouse_name && (
                        <Badge variant="secondary" className="text-sm px-3 py-1">
                          {item.mouse_name}
                        </Badge>
                      )}
                    </div>
                    {result?.confidence && (
                      <span className="text-white text-sm">
                        {(result.confidence * 100).toFixed(1)}% confidence
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function ScanReceiptClient({
  session,
}: {
  session: ScanSessionDetail;
}) {
  const successRate =
    session.itemCount > 0
      ? ((session.completedCount / session.itemCount) * 100).toFixed(0)
      : "0";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {session.cohort && (
                <Link
                  href={`/cohorts/${session.cohort.id}/scans`}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-600" />
                </Link>
              )}
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-slate-900">
                    {session.name || "Scan Session"}
                  </h1>
                  <SessionStatusBadge status={session.status} />
                </div>
                <p className="text-sm text-slate-500">
                  {session.cohort?.name} • {formatDateTime(session.created_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {session.cohort && (
                <Link href={`/cohorts/${session.cohort.id}/batch`}>
                  <Button variant="outline" className="gap-2">
                    <Sparkles className="w-4 h-4" />
                    Re-analyze
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Receipt Card */}
        <Card className="mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-4">
            <div className="flex items-center gap-3 text-white">
              <div className="p-2 bg-white/20 rounded-lg">
                <FlaskConical className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Scan Receipt</h2>
                <p className="text-rose-100 text-sm">
                  Session ID: {session.id.slice(0, 8)}...
                </p>
              </div>
            </div>
          </div>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Summary Stats */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-slate-500" />
                  Summary
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-2xl font-bold text-slate-900">
                      {session.itemCount}
                    </p>
                    <p className="text-xs text-slate-500">Images Uploaded</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      {session.completedCount}
                    </p>
                    <p className="text-xs text-slate-500">Classified</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg col-span-2">
                    <p className="text-2xl font-bold text-blue-600">
                      {successRate}%
                    </p>
                    <p className="text-xs text-slate-500">Success Rate</p>
                  </div>
                </div>
              </div>

              {/* Stage Distribution */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-slate-500" />
                  Stage Distribution
                </h3>
                <StageDistributionChart
                  breakdown={session.stageBreakdown}
                  total={session.completedCount}
                />
              </div>

              {/* Subjects Logged */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500" />
                  Subjects Logged ({session.subjectsLogged.length})
                </h3>
                {session.subjectsLogged.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {session.subjectsLogged.map((subject) => (
                      <Link
                        key={subject.id}
                        href={`/subjects/${subject.id}`}
                        className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        <span className="font-medium text-slate-700">
                          {subject.name}
                        </span>
                        <Badge variant="secondary">{subject.logCount} scans</Badge>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    No subjects assigned yet
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Images Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Grid className="w-5 h-5" />
              Scan Images ({session.items.length})
            </CardTitle>
            <CardDescription>
              Click any image to view details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImageGrid items={session.items} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

