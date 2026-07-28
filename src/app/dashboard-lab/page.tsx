import { notFound } from "next/navigation";
import { DashboardClient } from "@/app/dashboard/dashboard-client";
import type { DashboardStats } from "@/app/actions";
import type { Cohort } from "@/lib/types";

const cohorts: Cohort[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "North colony · Cycle study",
    description: "Daily external-photo review with paired cytology checkpoints.",
    type: "Estrus tracking",
    color: "#454a9f",
    created_at: "2026-06-02T14:00:00.000Z",
    user_id: "local-audit",
    org_id: null,
    log_config: null,
    subject_config: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Diet intervention · Cohort B",
    description: "Blinded daily cycle staging.",
    type: "Intervention",
    color: "#a44f73",
    created_at: "2026-06-11T14:00:00.000Z",
    user_id: "local-audit",
    org_id: null,
    log_config: null,
    subject_config: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Retired pilot · Archive",
    description: "Completed pilot records.",
    type: "Pilot",
    color: "#77736c",
    created_at: "2026-05-05T14:00:00.000Z",
    user_id: "local-audit",
    org_id: null,
    log_config: null,
    subject_config: null,
  },
];

const stats: DashboardStats = {
  totalSubjects: 12,
  todaysScans: 8,
  cohortProgress: [
    {
      id: cohorts[0].id,
      name: cohorts[0].name,
      totalSubjects: 6,
      recordedToday: 2,
      remaining: 4,
      dueSubjects: [
        { id: "00000000-0000-4000-8000-000000000221", name: "N-221", coatColour: "black", strain: "C57BL/6J" },
        { id: "00000000-0000-4000-8000-000000000223", name: "N-223", coatColour: "white", strain: "BALB/c" },
        { id: "00000000-0000-4000-8000-000000000224", name: "N-224", coatColour: "black", strain: "B6(Cg)-Tyrc-2J" },
        { id: "00000000-0000-4000-8000-000000000226", name: "N-226", coatColour: "agouti", strain: "CD-1" },
      ],
    },
    { id: cohorts[1].id, name: cohorts[1].name, totalSubjects: 6, recordedToday: 6, remaining: 0, dueSubjects: [] },
    { id: cohorts[2].id, name: cohorts[2].name, totalSubjects: 0, recordedToday: 0, remaining: 0, dueSubjects: [] },
  ],
  stageDistribution: [
    { stage: "Estrus", value: 11 },
    { stage: "Diestrus", value: 9 },
    { stage: "Proestrus", value: 8 },
    { stage: "Metestrus", value: 7 },
  ],
  recentActivity: [
    { id: "a1", mouseName: "N-222", cohortName: cohorts[0].name, stage: "Estrus", imageUrl: "/assets/generated/observation-lab/public-prepared-roi.png", time: "2026-07-19T12:15:00.000Z" },
    { id: "a2", mouseName: "B-106", cohortName: cohorts[1].name, stage: "Diestrus", imageUrl: "/assets/generated/observation-lab/public-prepared-roi.png", time: "2026-07-19T11:42:00.000Z" },
    { id: "a3", mouseName: "N-225", cohortName: cohorts[0].name, stage: "Metestrus", imageUrl: "/assets/generated/observation-lab/public-prepared-roi.png", time: "2026-07-18T12:02:00.000Z" },
  ],
  dailyTrend: [
    { date: "2026-07-13", Proestrus: 1, Estrus: 2, Metestrus: 1, Diestrus: 1 },
    { date: "2026-07-14", Proestrus: 2, Estrus: 1, Metestrus: 1, Diestrus: 1 },
    { date: "2026-07-15", Proestrus: 1, Estrus: 2, Metestrus: 1, Diestrus: 2 },
    { date: "2026-07-16", Proestrus: 1, Estrus: 1, Metestrus: 2, Diestrus: 2 },
    { date: "2026-07-17", Proestrus: 2, Estrus: 2, Metestrus: 1, Diestrus: 1 },
    { date: "2026-07-18", Proestrus: 1, Estrus: 2, Metestrus: 1, Diestrus: 2 },
    { date: "2026-07-19", Proestrus: 1, Estrus: 3, Metestrus: 2, Diestrus: 2 },
  ],
};

export const metadata = { title: "Estrus dashboard audit lab" };

export default function DashboardLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.ESTRUS_WORKFLOW_LAB !== "true") notFound();
  return <DashboardClient initialCohorts={cohorts} stats={stats} todayKey="2026-07-19" />;
}
