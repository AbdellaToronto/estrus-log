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
import { ChevronDown } from "lucide-react";

const STAGE_COLORS: Record<string, string> = {
  Proestrus: "#f472b6",
  Estrus: "#fb7185",
  Metestrus: "#38bdf8",
  Diestrus: "#34d399",
  Uncertain: "#cbd5f5",
  "Uncertain / transition": "#cbd5f5",
};

const STAGES = ["Proestrus", "Estrus", "Metestrus", "Diestrus", "Uncertain", "Uncertain / transition"];

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
      "bg-white/70 border border-white/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg shadow-slate-900/5 backdrop-blur-xl",
      className
    )}
  >
    <div className="flex items-center justify-between mb-4 sm:mb-6">
      <div>
        <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold">
          {title}
        </p>
        {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-1">{subtitle}</p>}
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
    label: format(new Date(`${item.date}T12:00:00`), "MMM d"),
  }));

  const confidenceData = insights.confidenceByStage.map((item) => ({
    ...item,
    percentage: Math.round(item.value * 100),
  }));

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
        <AnalyticsCard
          title="New binary review"
          subtitle="Reference-backed early-vs-late aid; exact stage remains scientist-controlled."
          className="lg:col-span-2"
        >
          {insights.binaryModelReviews > 0 ? (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="border border-[#c9c7e7] bg-[#eeedf9] p-4">
                  <p className="text-3xl font-semibold text-[#292b4c]">{insights.binaryModelReviews}</p>
                  <p className="mt-1 text-xs text-[#625f58]">reviewed crops</p>
                </div>
                <div className="border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-3xl font-semibold text-emerald-800">{insights.binarySuggestions}</p>
                  <p className="mt-1 text-xs text-emerald-800/80">usable leads</p>
                </div>
                <div className="border border-amber-200 bg-amber-50 p-4">
                  <p className="text-3xl font-semibold text-amber-800">{insights.binaryAbstentions}</p>
                  <p className="mt-1 text-xs text-amber-800/80">abstentions</p>
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#625f58]">
                  <span>Early-group leads · {insights.binaryEarlyLeads}</span>
                  <span>Late-group leads · {insights.binaryLateLeads}</span>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-[#e7e2d7]" aria-label={`${insights.binaryEarlyLeads} early-group and ${insights.binaryLateLeads} late-group leads`}>
                  <div className="h-full bg-[#a44f73]" style={{ width: `${insights.binarySuggestions ? (insights.binaryEarlyLeads / insights.binarySuggestions) * 100 : 0}%` }} />
                  <div className="h-full bg-[#454a9f]" style={{ width: `${insights.binarySuggestions ? (insights.binaryLateLeads / insights.binarySuggestions) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-48 items-center justify-center border border-dashed border-[#c9c7e7] bg-[#f8f7fc] px-6 text-center text-sm leading-6 text-[#625f58]">
              New-model evidence will appear here after an external-photo ROI is reviewed. Manual and cytology records remain valid without it.
            </div>
          )}
        </AnalyticsCard>

        <AnalyticsCard
          title="Saved stage mix"
          subtitle={`${insights.totalLogs} scientist-confirmed records`}
        >
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stageData} dataKey="value" nameKey="stage" innerRadius={55} outerRadius={85} paddingAngle={3} isAnimationActive={false}>
                  {stageData.map((entry, index) => <Cell key={`cell-${index}`} fill={STAGE_COLORS[entry.stage] || "#cbd5f5"} />)}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [`${value} records`, name]} contentStyle={{ borderRadius: 12, borderColor: "#ded9cd" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {stageData.map((entry) => <span key={entry.stage} className="text-xs font-medium text-slate-600">{entry.stage} <span className="text-slate-400">{entry.value}</span></span>)}
          </div>
        </AnalyticsCard>
      </div>

      {confidenceData.length > 0 && (
        <details className="group border border-[#ded9cd] bg-[#fbfaf7]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-[#4f4b45]">
            Legacy four-stage model support
            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-[#ded9cd] p-5">
            <p className="mb-4 text-xs leading-5 text-[#77736c]">Historical relative support only; not a calibrated probability and not the saved scientist decision.</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={confidenceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="stage" tick={{ fill: "#77736c" }} />
                  <YAxis domain={[0, 1]} tickFormatter={(value) => `${Math.round(value * 100)}%`} tick={{ fill: "#77736c" }} />
                  <Tooltip formatter={(value: number, name: string, props) => [`${Math.round(value * 100)}%`, props?.payload?.stage]} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} isAnimationActive={false}>{confidenceData.map((entry, index) => <Cell key={`confidence-${index}`} fill={STAGE_COLORS[entry.stage] || "#818cf8"} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </details>
      )}

      <div className="grid gap-4 sm:gap-6 grid-cols-1 xl:grid-cols-3">
        <AnalyticsCard
          title="Activity Timeline"
          subtitle="Last 14 days"
          className="xl:col-span-2"
        >
          <div className="h-48 sm:h-72">
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
                  isAnimationActive={false}
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
        subtitle="Latest saved observations"
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
                {log.binaryDecisionStatus === "reference_backed_suggestion" ? (
                  <>
                    <p className="text-xs font-semibold text-[#454a9f]">
                      {log.binaryGroup === "PROESTRUS_OR_ESTRUS" ? "Early-group lead" : "Late-group lead"}
                    </p>
                    <p className="text-[10px] text-slate-400">new model · review aid</p>
                  </>
                ) : log.binaryDecisionStatus ? (
                  <p className="text-xs font-medium text-amber-700">New model abstained</p>
                ) : (
                  <p className="text-xs font-medium text-slate-500">Scientist-reviewed</p>
                )}
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
