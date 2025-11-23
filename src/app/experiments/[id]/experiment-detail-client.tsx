"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Users,
  ArrowLeft,
  Trash2,
  Activity,
  FileSpreadsheet,
  Grid,
  Table as TableIcon,
} from "lucide-react";
import Link from "next/link";
import {
  addCohortToExperiment,
  removeCohortFromExperiment,
  getExperimentExportData,
  deleteExperiment,
  type ExperimentInsights,
} from "@/app/actions";
import { useRouter } from "next/navigation";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

// --- Types ---

type Cohort = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
};

type Experiment = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  experiment_cohorts: {
    cohort_id: string;
    cohorts: Cohort | null;
  }[];
};

type VisualizationData = {
  cohorts: {
    id: string;
    name: string;
    color: string;
    mice: { id: string; name: string }[];
  }[];
  logs: {
    id: string;
    mouse_id: string;
    stage: string;
    date: string; // YYYY-MM-DD
    confidence: number | { score: number };
    features?: Record<string, unknown>;
  }[];
};

// --- Colors ---
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
const STAGE_COLORS: Record<string, string> = {
  Proestrus: "#f59e0b", // Amber
  Estrus: "#ef4444", // Red
  Metestrus: "#10b981", // Emerald
  Diestrus: "#3b82f6", // Blue
};

// --- Helper: CSV Download ---
function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data || data.length === 0) {
    alert("No data available to export.");
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const cell =
            row[header] === null || row[header] === undefined
              ? ""
              : row[header];
          const stringCell = String(cell);
          if (
            stringCell.includes(",") ||
            stringCell.includes('"') ||
            stringCell.includes("\n")
          ) {
            return `"${stringCell.replace(/"/g, '""')}"`;
          }
          return stringCell;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function ExperimentDetailClient({
  experiment,
  allCohorts,
  insights,
  visualizationData,
}: {
  experiment: Experiment;
  allCohorts: Cohort[];
  insights: ExperimentInsights;
  visualizationData: VisualizationData;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Filter out cohorts already in the experiment
  const existingCohortIds = new Set(
    experiment.experiment_cohorts.map((ec) => ec.cohort_id)
  );
  const availableCohorts = allCohorts.filter(
    (c) => !existingCohortIds.has(c.id)
  );

  const handleAddCohort = async () => {
    if (!selectedCohortId) return;
    setLoading(true);
    try {
      await addCohortToExperiment(experiment.id, selectedCohortId);
      setAddOpen(false);
      setSelectedCohortId("");
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCohort = async (cohortId: string) => {
    if (
      !confirm(
        "Are you sure you want to remove this cohort from the experiment?"
      )
    )
      return;
    try {
      await removeCohortFromExperiment(experiment.id, cohortId);
      router.refresh();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteExperiment = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this experiment? This action cannot be undone."
      )
    )
      return;
    setDeleting(true);
    try {
      await deleteExperiment(experiment.id);
      router.push("/experiments");
    } catch (error) {
      console.error(error);
      alert("Failed to delete experiment");
      setDeleting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await getExperimentExportData(experiment.id);
      const filename = `${experiment.name.replace(/\s+/g, "_")}_export_${
        new Date().toISOString().split("T")[0]
      }.csv`;
      downloadCSV(data, filename);
    } catch (e) {
      console.error("Export failed", e);
      alert("Failed to export data. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // --- Heatmap Logic ---
  const heatmapData = useMemo(() => {
    // 1. Get unique dates sorted
    const dates = Array.from(
      new Set(visualizationData.logs.map((l) => l.date))
    ).sort();

    // 2. Map logs by mouse_id + date
    const logMap = new Map<string, string>();
    visualizationData.logs.forEach((l) => {
      logMap.set(`${l.mouse_id}|${l.date}`, l.stage);
    });

    // 3. Structure for rendering: List of cohorts -> List of mice -> List of days
    return visualizationData.cohorts.map((cohort) => ({
      ...cohort,
      rows: cohort.mice.map((mouse) => ({
        mouse,
        cells: dates.map((date) => ({
          date,
          stage: logMap.get(`${mouse.id}|${date}`) || "No Data",
        })),
      })),
    }));
  }, [visualizationData]);

  const allDates = useMemo(
    () => Array.from(new Set(visualizationData.logs.map((l) => l.date))).sort(),
    [visualizationData]
  );

  // --- Stacked Area Logic ---
  const stackedData = useMemo(() => {
    // Group logs by date and count stages
    const dateMap = new Map<string, Record<string, number>>();

    visualizationData.logs.forEach((log) => {
      const date = log.date;
      if (!dateMap.has(date)) {
        dateMap.set(date, {
          Proestrus: 0,
          Estrus: 0,
          Metestrus: 0,
          Diestrus: 0,
          Uncertain: 0,
        });
      }
      const entry = dateMap.get(date)!;
      const stage = STAGE_COLORS[log.stage] ? log.stage : "Uncertain";
      entry[stage] = (entry[stage] || 0) + 1;
    });

    return Array.from(dateMap.entries())
      .map(([date, counts]) => ({
        date,
        ...counts,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [visualizationData]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Sticky Header */}
      <div className="border-b bg-card shadow-sm z-10">
        <div className="container py-4 max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/experiments"
              className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold tracking-tight">
                  {experiment.name}
                </h1>
                <div
                  className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold border ${
                    experiment.status === "active"
                      ? "bg-green-500/10 text-green-600 border-green-500/20"
                      : "bg-muted text-muted-foreground border-muted-foreground/20"
                  }`}
                >
                  {experiment.status || "Planned"}
                </div>
              </div>
              {experiment.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1 max-w-md">
                  {experiment.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 h-3.5 w-3.5" /> Add Cohort
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Cohort to Experiment</DialogTitle>
                  <DialogDescription>
                    Select a cohort to track within this experiment.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Select Cohort</Label>
                    <Select
                      value={selectedCohortId}
                      onValueChange={setSelectedCohortId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a cohort..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCohorts.map((cohort) => (
                          <SelectItem key={cohort.id} value={cohort.id}>
                            {cohort.name}
                          </SelectItem>
                        ))}
                        {availableCohorts.length === 0 && (
                          <SelectItem value="none" disabled>
                            No available cohorts
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleAddCohort}
                    disabled={!selectedCohortId || loading}
                  >
                    {loading ? "Adding..." : "Add Cohort"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={exporting || insights.totalLogs === 0}
            >
              {exporting ? (
                "Exporting..."
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-3.5 w-3.5" /> Export
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleDeleteExperiment}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="dashboard" className="h-full flex flex-col">
          <div className="container max-w-7xl py-2 border-b bg-background">
            <TabsList>
              <TabsTrigger value="dashboard">
                <Activity className="mr-2 h-4 w-4" /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="heatmap">
                <Grid className="mr-2 h-4 w-4" /> Cycle Plot
              </TabsTrigger>
              <TabsTrigger value="cohorts">
                <Users className="mr-2 h-4 w-4" /> Cohorts
              </TabsTrigger>
              <TabsTrigger value="raw">
                <TableIcon className="mr-2 h-4 w-4" /> Data
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto bg-muted/5 p-4 md:p-8">
            <div className="container max-w-7xl mx-auto h-full">
              <AnimatePresence mode="wait">
                {/* --- Dashboard Tab --- */}
                <TabsContent
                  value="dashboard"
                  className="mt-0 h-full space-y-6"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    {/* KPI Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">
                            Total Subjects
                          </CardTitle>
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {insights.totalSubjects}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Across {experiment.experiment_cohorts.length}{" "}
                            cohorts
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">
                            Total Logs
                          </CardTitle>
                          <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {insights.totalLogs}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Data points collected
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Charts Row 1 */}
                    <div className="grid gap-4 md:grid-cols-2 h-[400px]">
                      <Card className="col-span-1 flex flex-col">
                        <CardHeader>
                          <CardTitle>Activity Over Time</CardTitle>
                          <CardDescription>Daily log frequency</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={insights.timeline}>
                              <defs>
                                <linearGradient
                                  id="colorValue"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor="#3b82f6"
                                    stopOpacity={0.3}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor="#3b82f6"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              </defs>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke="rgba(0,0,0,0.05)"
                              />
                              <XAxis
                                dataKey="date"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) =>
                                  new Date(value).toLocaleDateString(
                                    undefined,
                                    { month: "short", day: "numeric" }
                                  )
                                }
                              />
                              <YAxis
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: "8px",
                                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="value"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorValue)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      <Card className="col-span-1 flex flex-col">
                        <CardHeader>
                          <CardTitle>Stage Distribution</CardTitle>
                          <CardDescription>
                            Overall proportion of estrus stages
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={insights.stageDistribution}
                                cx="50%"
                                cy="50%"
                                innerRadius={80}
                                outerRadius={110}
                                paddingAngle={2}
                                dataKey="value"
                                label={({
                                  payload,
                                  percent,
                                }: {
                                  payload?: { stage: string };
                                  percent?: number;
                                }) =>
                                  `${payload?.stage ?? ""} ${(
                                    (percent ?? 0) * 100
                                  ).toFixed(0)}%`
                                }
                              >
                                {insights.stageDistribution.map(
                                  (entry, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={
                                        STAGE_COLORS[entry.stage] ||
                                        COLORS[index % COLORS.length]
                                      }
                                    />
                                  )
                                )}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: "8px",
                                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Chart Row 2: Stacked Area */}
                    <Card className="h-[400px] flex flex-col">
                      <CardHeader>
                        <CardTitle>Stage Distribution Over Time</CardTitle>
                        <CardDescription>
                          Proportion of subjects in each stage per day
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={stackedData}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke="rgba(0,0,0,0.05)"
                            />
                            <XAxis
                              dataKey="date"
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(value) =>
                                new Date(value).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })
                              }
                            />
                            <YAxis
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                              allowDecimals={false}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "rgba(255, 255, 255, 0.9)",
                                border: "1px solid #e5e7eb",
                                borderRadius: "8px",
                                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                              }}
                            />
                            {Object.keys(STAGE_COLORS).map((stage) => (
                              <Area
                                key={stage}
                                type="monotone"
                                dataKey={stage}
                                stackId="1"
                                stroke={STAGE_COLORS[stage]}
                                fill={STAGE_COLORS[stage]}
                              />
                            ))}
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>

                {/* --- Heatmap Tab --- */}
                <TabsContent value="heatmap" className="mt-0 h-full">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="h-full flex flex-col gap-4"
                  >
                    <Card className="flex-1 flex flex-col overflow-hidden">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>Cycle Plots (Actogram)</CardTitle>
                            <CardDescription>
                              Daily estrus stage for each subject.
                            </CardDescription>
                          </div>
                          <div className="flex gap-2 text-xs">
                            {Object.entries(STAGE_COLORS).map(
                              ([stage, color]) => (
                                <div
                                  key={stage}
                                  className="flex items-center gap-1"
                                >
                                  <div
                                    className="w-3 h-3 rounded-sm"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span className="text-muted-foreground">
                                    {stage}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 overflow-auto pb-6">
                        <div className="min-w-[800px]">
                          {/* Header Row (Dates) */}
                          <div className="flex mb-2 sticky top-0 bg-card z-10 pb-2 border-b">
                            <div className="w-32 shrink-0 font-semibold text-sm text-muted-foreground">
                              Subject
                            </div>
                            <div className="flex-1 flex justify-between text-xs text-muted-foreground">
                              {allDates.map((date, i) => (
                                <div
                                  key={date}
                                  className="w-6 text-center -rotate-45 origin-bottom-left translate-y-2"
                                >
                                  {i % 2 === 0 ? date.slice(5) : ""}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Rows */}
                          <div className="space-y-6 mt-8">
                            {heatmapData.map((cohort) => (
                              <div key={cohort.id} className="space-y-1">
                                <div
                                  className="font-semibold px-2 py-1 rounded w-fit text-xs uppercase tracking-wider mb-2"
                                  style={{
                                    backgroundColor:
                                      cohort.color?.replace("bg-", "") ||
                                      "#e5e7eb",
                                    opacity: 0.8,
                                  }}
                                >
                                  {cohort.name}
                                </div>
                                {cohort.rows.map((row) => (
                                  <div
                                    key={row.mouse.id}
                                    className="flex items-center hover:bg-muted/50 transition-colors rounded px-1"
                                  >
                                    <div className="w-32 shrink-0 text-sm font-medium truncate pr-2">
                                      {row.mouse.name}
                                    </div>
                                    <div className="flex-1 flex justify-between gap-[2px]">
                                      {row.cells.map((cell) => (
                                        <div
                                          key={`${row.mouse.id}-${cell.date}`}
                                          className="w-full h-6 rounded-[2px] transition-all hover:scale-110 hover:z-10 cursor-pointer"
                                          title={`${row.mouse.name} - ${cell.date}: ${cell.stage}`}
                                          style={{
                                            backgroundColor:
                                              STAGE_COLORS[cell.stage] ||
                                              (cell.stage === "No Data"
                                                ? "#f3f4f6"
                                                : "#9ca3af"),
                                          }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>

                {/* --- Cohorts Tab --- */}
                <TabsContent value="cohorts" className="mt-0 h-full space-y-6">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                  >
                    {experiment.experiment_cohorts.map(({ cohorts: cohort }) =>
                      cohort ? (
                        <Card
                          key={cohort.id}
                          className="group relative overflow-hidden transition-all hover:border-primary/50 flex flex-col"
                        >
                          <div
                            className={`absolute top-0 left-0 w-1 h-full ${
                              cohort.color || "bg-blue-500"
                            }`}
                          />
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <Link
                                href={`/cohorts/${cohort.id}`}
                                className="hover:underline"
                              >
                                <CardTitle className="text-lg">
                                  {cohort.name}
                                </CardTitle>
                              </Link>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleRemoveCohort(cohort.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <CardDescription className="line-clamp-2">
                              {cohort.description}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="mt-auto pt-0">
                            <div className="grid grid-cols-2 gap-2 text-sm border-t pt-4">
                              <div>
                                <span className="text-muted-foreground block text-xs">
                                  Subjects
                                </span>
                                <span className="font-medium">
                                  {insights.cohortStats.find(
                                    (s) => s.id === cohort.id
                                  )?.subjectCount || 0}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-xs">
                                  Logs
                                </span>
                                <span className="font-medium">
                                  {insights.cohortStats.find(
                                    (s) => s.id === cohort.id
                                  )?.logCount || 0}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ) : null
                    )}
                  </motion.div>
                </TabsContent>

                {/* --- Raw Data Tab --- */}
                <TabsContent value="raw" className="mt-0 h-full">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="h-full"
                  >
                    <Card className="h-full flex flex-col">
                      <CardHeader>
                        <CardTitle>Experiment Data Logs</CardTitle>
                        <CardDescription>
                          Raw data collected across all cohorts
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 overflow-auto">
                        <div className="rounded-md border">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 sticky top-0 z-10">
                              <tr>
                                <th className="p-3 font-medium">Date</th>
                                <th className="p-3 font-medium">Subject</th>
                                <th className="p-3 font-medium">Stage</th>
                                <th className="p-3 font-medium">Confidence</th>
                                <th className="p-3 font-medium">Features</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {visualizationData.logs.map((log) => {
                                // Find mouse name efficiently
                                // In real app, we might want to create a lookup map once
                                let mouseName = "Unknown";
                                for (const c of visualizationData.cohorts) {
                                  const m = c.mice.find(
                                    (m) => m.id === log.mouse_id
                                  );
                                  if (m) {
                                    mouseName = m.name;
                                    break;
                                  }
                                }

                                const confidenceScore =
                                  typeof log.confidence === "number"
                                    ? log.confidence
                                    : log.confidence?.score || 0;

                                return (
                                  <tr
                                    key={log.id}
                                    className="hover:bg-muted/50 transition-colors"
                                  >
                                    <td className="p-3 whitespace-nowrap">
                                      {log.date}
                                    </td>
                                    <td className="p-3 font-medium">
                                      {mouseName}
                                    </td>
                                    <td className="p-3">
                                      <span
                                        className="px-2 py-1 rounded-full text-xs font-medium border"
                                        style={{
                                          borderColor: `${
                                            STAGE_COLORS[log.stage]
                                          }40`,
                                          backgroundColor: `${
                                            STAGE_COLORS[log.stage]
                                          }20`,
                                          color: STAGE_COLORS[log.stage],
                                        }}
                                      >
                                        {log.stage}
                                      </span>
                                    </td>
                                    <td className="p-3">
                                      {(confidenceScore * 100).toFixed(0)}%
                                    </td>
                                    <td className="p-3 text-muted-foreground text-xs max-w-xs truncate">
                                      {JSON.stringify(log.features)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>
              </AnimatePresence>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
