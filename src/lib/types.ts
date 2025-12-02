import type { Database, Json } from "./database-types";

// Database row types
export type Cohort = Database["public"]["Tables"]["cohorts"]["Row"];
export type CohortInsert = Database["public"]["Tables"]["cohorts"]["Insert"];
export type Mouse = Database["public"]["Tables"]["mice"]["Row"];
export type MouseInsert = Database["public"]["Tables"]["mice"]["Insert"];
export type EstrusLog = Database["public"]["Tables"]["estrus_logs"]["Row"];
export type EstrusLogInsert = Database["public"]["Tables"]["estrus_logs"]["Insert"];
export type ScanSession = Database["public"]["Tables"]["scan_sessions"]["Row"];
export type ScanItem = Database["public"]["Tables"]["scan_items"]["Row"];
export type Experiment = Database["public"]["Tables"]["experiments"]["Row"];
export type OrganizationProfile = Database["public"]["Tables"]["organization_profiles"]["Row"];
export type JoinRequest = Database["public"]["Tables"]["join_requests"]["Row"];

// Extended types with relationships
export interface CohortWithRelations extends Cohort {
  mice?: Mouse[];
  estrus_logs?: EstrusLog[];
}

export interface MouseWithLogs extends Mouse {
  estrus_logs?: EstrusLog[];
}

// Cohort insights computed from logs
export interface CohortInsights {
  totalLogs: number;
  stageBreakdown: Record<string, number>;
  recentLogs: EstrusLog[];
  subjectCount: number;
  averageConfidence?: number;
  dailyTrend?: DailyTrendItem[];
}

export interface DailyTrendItem {
  date: string;
  Proestrus: number;
  Estrus: number;
  Metestrus: number;
  Diestrus: number;
}

// Dashboard stats
export interface DashboardStats {
  cohorts: number;
  subjects: number;
  logs: number;
  recentLogs: Array<{
    id: string;
    stage: string;
    created_at: string;
    cohort_name?: string;
    subject_name?: string;
  }>;
  stageBreakdown: Record<string, number>;
  dailyTrend: DailyTrendItem[];
}

// Scan session types
export interface ScanSessionSummary {
  id: string;
  name: string | null;
  status: string | null;
  created_at: string;
  itemCount: number;
  completedCount: number;
  stageBreakdown: Record<string, number>;
}

export interface ScanSessionDetail extends ScanSessionSummary {
  cohort: { id: string; name: string } | null;
  items: ScanItemWithMouse[];
  subjectsLogged: { id: string; name: string; logCount: number }[];
}

export interface ScanItemWithMouse {
  id: string;
  image_url: string | null;
  status: string | null;
  ai_result: Record<string, unknown> | null;
  mouse_id: string | null;
  mouse_name: string | null;
  created_at: string;
}

// Organization types
export interface OrganizationWithProfile extends OrganizationProfile {
  pendingRequests?: number;
}

export interface JoinRequestWithOrg extends JoinRequest {
  organization?: OrganizationProfile;
}

// For flexible JSON data
export type JsonValue = Json;
export type JsonObject = Record<string, Json | undefined>;

// Subject/Mouse display type
export interface SubjectDisplay {
  id: string;
  name: string;
  status?: string | null;
  created_at: string;
  metadata?: JsonObject | null;
  cohort_id?: string | null;
}

// Log display type
export interface LogDisplay {
  id: string;
  mouse_id: string | null;
  stage: string;
  created_at: string;
  image_url?: string | null;
  confidence?: Json | null;
  features?: Json | null;
  notes?: string | null;
  cohort_id?: string | null;
}

