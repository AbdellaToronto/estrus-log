export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      cohorts: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          log_config: Json | null
          name: string
          org_id: string | null
          subject_config: Json | null
          type: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          log_config?: Json | null
          name: string
          org_id?: string | null
          subject_config?: Json | null
          type?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          log_config?: Json | null
          name?: string
          org_id?: string | null
          subject_config?: Json | null
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      estrus_logs: {
        Row: {
          cohort_id: string | null
          confidence: Json | null
          created_at: string
          data: Json | null
          features: Json | null
          id: string
          image_url: string | null
          mouse_id: string | null
          notes: string | null
          session_id: string | null
          stage: string
        }
        Insert: {
          cohort_id?: string | null
          confidence?: Json | null
          created_at?: string
          data?: Json | null
          features?: Json | null
          id?: string
          image_url?: string | null
          mouse_id?: string | null
          notes?: string | null
          session_id?: string | null
          stage: string
        }
        Update: {
          cohort_id?: string | null
          confidence?: Json | null
          created_at?: string
          data?: Json | null
          features?: Json | null
          id?: string
          image_url?: string | null
          mouse_id?: string | null
          notes?: string | null
          session_id?: string | null
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "estrus_logs_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrus_logs_mouse_id_fkey"
            columns: ["mouse_id"]
            isOneToOne: false
            referencedRelation: "mice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrus_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scan_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_cohorts: {
        Row: {
          assigned_at: string | null
          cohort_id: string
          experiment_id: string
        }
        Insert: {
          assigned_at?: string | null
          cohort_id: string
          experiment_id: string
        }
        Update: {
          assigned_at?: string | null
          cohort_id?: string
          experiment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiment_cohorts_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_cohorts_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      experiments: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          org_id: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          org_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          org_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      join_requests: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          organization_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role: string | null
          status: Database["public"]["Enums"]["join_request_status"] | null
          updated_at: string | null
          user_email: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          organization_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string | null
          status?: Database["public"]["Enums"]["join_request_status"] | null
          updated_at?: string | null
          user_email: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          organization_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string | null
          status?: Database["public"]["Enums"]["join_request_status"] | null
          updated_at?: string | null
          user_email?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mice: {
        Row: {
          cohort_id: string | null
          created_at: string
          dob: string | null
          id: string
          metadata: Json | null
          name: string
          notes: string | null
          org_id: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          cohort_id?: string | null
          created_at?: string
          dob?: string | null
          id?: string
          metadata?: Json | null
          name: string
          notes?: string | null
          org_id?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          cohort_id?: string | null
          created_at?: string
          dob?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          notes?: string | null
          org_id?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mice_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mice_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_profiles: {
        Row: {
          clerk_org_id: string
          created_at: string | null
          department: string | null
          description: string | null
          id: string
          institution: string | null
          is_discoverable: boolean | null
          logo_url: string | null
          member_count: number | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          clerk_org_id: string
          created_at?: string | null
          department?: string | null
          description?: string | null
          id?: string
          institution?: string | null
          is_discoverable?: boolean | null
          logo_url?: string | null
          member_count?: number | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          clerk_org_id?: string
          created_at?: string | null
          department?: string | null
          description?: string | null
          id?: string
          institution?: string | null
          is_discoverable?: boolean | null
          logo_url?: string | null
          member_count?: number | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      reference_images: {
        Row: {
          created_at: string | null
          embedding: string | null
          id: string
          image_path: string | null
          label: string
          metadata: Json | null
        }
        Insert: {
          created_at?: string | null
          embedding?: string | null
          id?: string
          image_path?: string | null
          label: string
          metadata?: Json | null
        }
        Update: {
          created_at?: string | null
          embedding?: string | null
          id?: string
          image_path?: string | null
          label?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      scan_items: {
        Row: {
          ai_result: Json | null
          analysis_progress: Json | null
          created_at: string
          cropped_image_url: string | null
          id: string
          image_url: string
          mask_image_url: string | null
          mouse_id: string | null
          session_id: string
          status: string | null
        }
        Insert: {
          ai_result?: Json | null
          analysis_progress?: Json | null
          created_at?: string
          cropped_image_url?: string | null
          id?: string
          image_url: string
          mask_image_url?: string | null
          mouse_id?: string | null
          session_id: string
          status?: string | null
        }
        Update: {
          ai_result?: Json | null
          analysis_progress?: Json | null
          created_at?: string
          cropped_image_url?: string | null
          id?: string
          image_url?: string
          mask_image_url?: string | null
          mouse_id?: string | null
          session_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_items_mouse_id_fkey"
            columns: ["mouse_id"]
            isOneToOne: false
            referencedRelation: "mice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scan_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_sessions: {
        Row: {
          cohort_id: string
          created_at: string
          id: string
          name: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          id?: string
          name?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          id?: string
          name?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_sessions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_org_member_count: {
        Args: { org_clerk_id: string }
        Returns: undefined
      }
      get_pending_requests: {
        Args: { org_clerk_id: string }
        Returns: {
          created_at: string
          id: string
          message: string
          role: string
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      increment_org_member_count: {
        Args: { org_clerk_id: string }
        Returns: undefined
      }
      match_reference_images: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          id: string
          image_path: string
          label: string
          metadata: Json
          similarity: number
        }[]
      }
      requesting_org_id: { Args: never; Returns: string }
      requesting_user_id: { Args: never; Returns: string }
      search_organizations: {
        Args: {
          institution_filter?: string
          limit_count?: number
          search_query?: string
        }
        Returns: {
          clerk_org_id: string
          created_at: string
          department: string
          description: string
          id: string
          institution: string
          logo_url: string
          member_count: number
        }[]
      }
    }
    Enums: {
      join_request_status: "pending" | "approved" | "denied" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      join_request_status: ["pending", "approved", "denied", "cancelled"],
    },
  },
} as const
