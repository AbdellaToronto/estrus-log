"use client";

import { CohortInsights } from "@/app/actions";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from "recharts";
import { format } from "date-fns";

const STAGE_COLORS: Record<string, string> = {
  Proestrus: "#f472b6",
  Estrus: "#fb7185",
  Metestrus: "#38bdf8",
  Diestrus: "#34d399",
  Uncertain: "#cbd5f5",
};

const STAGES = ["Proestrus", "Estrus", "Metestrus", "Diestrus", "Uncertain"];

const GRADIENT_FROM = "#c7d2fe";
const GRADIENT_TO = "#7dd3fc";

const motionConfig = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: "easeOut" as const },
};

const AnalyticsCard = ({
  title,
  subtitle,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <motion.div
    {...motionConfig}
    className={cn(
      "bg-white/70 border border-white/50 rounded-3xl p-6 shadow-lg shadow-slate-900/5 backdrop-blur-xl",
      className
    )}
  >
    <div className="flex items-center justify-between mb-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold">
          {title}
        </p>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
    </div>
    {children}
  </motion.div>
);

export function CohortAnalysis({ insights }: { insights: CohortInsights }) {
  if (!insights || insights.totalLogs === 0) {
    return (
      <div className="bg-white/60 border border-white/40 rounded-3xl p-12 text-center text-slate-400">
        <p className="text-lg font-medium">No scan data yet</p>
        <p className="text-sm mt-2">
          Upload and analyze a batch to unlock the analytics workspace.
        </p>
      </div>
    );
  }

  const stageData = insights.stageDistribution.length
    ? insights.stageDistribution
    : STAGES.map((stage) => ({ stage, value: 0 }));

  const timelineData = insights.timeline.map((item) => ({
    ...item,
    label: format(new Date(item.date), "MMM d"),
  }));

  const confidenceData = insights.confidenceByStage.map((item) => ({
    ...item,
    percentage: Math.round(item.value * 100),
  }));

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-3">
        <AnalyticsCard
          title="Stage Mix"
          subtitle={`${insights.totalLogs} total logs`}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stageData}
                  dataKey="value"
                  nameKey="stage"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={3}
                >
                  {stageData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={STAGE_COLORS[entry.stage] || "#cbd5f5"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value} logs`,
                    name,
                  ]}
                  contentStyle={{ borderRadius: 16, borderColor: "#e2e8f0" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {stageData.map((entry) => (
              <div
                key={entry.stage}
                className="flex items-center gap-2 text-sm font-medium text-slate-600"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: STAGE_COLORS[entry.stage] || "#cbd5f5",
                  }}
                />
                {entry.stage}{" "}
                <span className="text-slate-400">({entry.value})</span>
              </div>
            ))}
          </div>
        </AnalyticsCard>

        <AnalyticsCard
          title="Confidence by Stage"
          subtitle="Average AI confidence"
          className="lg:col-span-2"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={confidenceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="stage" tick={{ fill: "#94a3b8" }} />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(value) => `${Math.round(value * 100)}%`}
                  tick={{ fill: "#94a3b8" }}
                />
                <Tooltip
                  formatter={(value: number, name: string, props) => [
                    `${Math.round(value * 100)}%`,
                    props?.payload?.stage,
                  ]}
                  contentStyle={{ borderRadius: 16, borderColor: "#e2e8f0" }}
                />
                <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                  {confidenceData.map((entry, index) => (
                    <Cell
                      key={`confidence-${index}`}
                      fill={STAGE_COLORS[entry.stage] || "#818cf8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AnalyticsCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <AnalyticsCard
          title="Activity Timeline"
          subtitle="Last 14 days"
          className="xl:col-span-2"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient
                    id="timelineGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={GRADIENT_TO}
                      stopOpacity={0.9}
                    />
                    <stop
                      offset="95%"
                      stopColor={GRADIENT_FROM}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fill: "#94a3b8" }} />
                <YAxis allowDecimals={false} tick={{ fill: "#94a3b8" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 16, borderColor: "#e2e8f0" }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#818cf8"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#timelineGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </AnalyticsCard>

        <AnalyticsCard title="Feature Glimpse" subtitle="Most cited traits">
          <FeatureStacks insights={insights} />
        </AnalyticsCard>
      </div>

      <AnalyticsCard
        title="Recent Highlights"
        subtitle="Latest classified scans"
      >
        <div className="space-y-4">
          {insights.recentLogs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-between rounded-2xl border border-slate-100 p-4 bg-white/60"
            >
              <div className="flex items-center gap-4 min-w-0">
                <Badge
                  className={cn(
                    "text-xs px-3 py-1 rounded-full",
                    getStageBadge(log.stage)
                  )}
                >
                  {log.stage}
                </Badge>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">
                    {log.subjectName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {format(new Date(log.created_at), "MMM d, h:mma")}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-800">
                  {Math.round(log.confidence * 100)}%
                </p>
                <p className="text-xs text-slate-400">confidence</p>
              </div>
            </motion.div>
          ))}
        </div>
      </AnalyticsCard>
    </div>
  );
}

function FeatureStacks({ insights }: { insights: CohortInsights }) {
  const featureEntries = [
    { key: "swelling", label: "Swelling" },
    { key: "color", label: "Color" },
    { key: "opening", label: "Opening" },
    { key: "moistness", label: "Moistness" },
  ] as const;

  return (
    <div className="space-y-4">
      {featureEntries.map(({ key, label }) => {
        const data = insights.featureBreakdown?.[key] ?? [];
        if (!data.length) {
          return (
            <div key={key}>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold mb-1">
                {label}
              </p>
              <p className="text-sm text-slate-400">No data yet</p>
            </div>
          );
        }
        const total = data.reduce((sum, item) => sum + item.value, 0);
        return (
          <div key={key}>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold mb-3">
              {label}
            </p>
            <div className="space-y-2">
              {data
                .sort((a, b) => b.value - a.value)
                .slice(0, 3)
                .map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span className="font-medium text-slate-600">
                        {item.label}
                      </span>
                      <span>{Math.round((item.value / total) * 100)}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.round((item.value / total) * 100)}%`,
                        }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-sky-300"
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getStageBadge(stage: string) {
  const base = "border-0";
  switch (stage) {
    case "Estrus":
      return cn(base, "bg-rose-100 text-rose-600");
    case "Proestrus":
      return cn(base, "bg-pink-100 text-pink-600");
    case "Metestrus":
      return cn(base, "bg-sky-100 text-sky-600");
    case "Diestrus":
      return cn(base, "bg-emerald-100 text-emerald-600");
    default:
      return cn(base, "bg-slate-100 text-slate-600");
  }
}
