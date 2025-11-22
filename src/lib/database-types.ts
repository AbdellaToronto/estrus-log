export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      cohorts: {
        Row: {
          color: string | null;
          created_at: string;
          description: string | null;
          id: string;
          log_config: Json | null;
          name: string;
          org_id: string | null;
          subject_config: Json | null;
          type: string | null;
          user_id: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          log_config?: Json | null;
          name: string;
          org_id?: string | null;
          subject_config?: Json | null;
          type?: string | null;
          user_id: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          log_config?: Json | null;
          name?: string;
          org_id?: string | null;
          subject_config?: Json | null;
          type?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cohorts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      estrus_logs: {
        Row: {
          confidence: Json | null;
          created_at: string;
          data: Json | null;
          features: Json | null;
          id: string;
          image_url: string | null;
          mouse_id: string;
          notes: string | null;
          stage: string;
        };
        Insert: {
          confidence?: Json | null;
          created_at?: string;
          data?: Json | null;
          features?: Json | null;
          id?: string;
          image_url?: string | null;
          mouse_id: string;
          notes?: string | null;
          stage: string;
        };
        Update: {
          confidence?: Json | null;
          created_at?: string;
          data?: Json | null;
          features?: Json | null;
          id?: string;
          image_url?: string | null;
          mouse_id?: string;
          notes?: string | null;
          stage?: string;
        };
        Relationships: [
          {
            foreignKeyName: "estrus_logs_mouse_id_fkey";
            columns: ["mouse_id"];
            isOneToOne: false;
            referencedRelation: "mice";
            referencedColumns: ["id"];
          }
        ];
      };
      mice: {
        Row: {
          cohort_id: string | null;
          created_at: string;
          dob: string | null;
          id: string;
          metadata: Json | null;
          name: string;
          notes: string | null;
          org_id: string | null;
          user_id: string;
        };
        Insert: {
          cohort_id?: string | null;
          created_at?: string;
          dob?: string | null;
          id?: string;
          metadata?: Json | null;
          name: string;
          notes?: string | null;
          org_id?: string | null;
          user_id: string;
        };
        Update: {
          cohort_id?: string | null;
          created_at?: string;
          dob?: string | null;
          id?: string;
          metadata?: Json | null;
          name?: string;
          notes?: string | null;
          org_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mice_cohort_id_fkey";
            columns: ["cohort_id"];
            isOneToOne: false;
            referencedRelation: "cohorts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mice_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      scan_items: {
        Row: {
          ai_result: Json | null;
          created_at: string;
          id: string;
          image_url: string;
          mouse_id: string | null;
          session_id: string;
          status: string | null;
        };
        Insert: {
          ai_result?: Json | null;
          created_at?: string;
          id?: string;
          image_url: string;
          mouse_id?: string | null;
          session_id: string;
          status?: string | null;
        };
        Update: {
          ai_result?: Json | null;
          created_at?: string;
          id?: string;
          image_url?: string;
          mouse_id?: string | null;
          session_id?: string;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "scan_items_mouse_id_fkey";
            columns: ["mouse_id"];
            isOneToOne: false;
            referencedRelation: "mice";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scan_items_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "scan_sessions";
            referencedColumns: ["id"];
          }
        ];
      };
      scan_sessions: {
        Row: {
          cohort_id: string;
          created_at: string;
          id: string;
          name: string | null;
          status: string | null;
          user_id: string;
        };
        Insert: {
          cohort_id: string;
          created_at?: string;
          id?: string;
          name?: string | null;
          status?: string | null;
          user_id: string;
        };
        Update: {
          cohort_id?: string;
          created_at?: string;
          id?: string;
          name?: string | null;
          status?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scan_sessions_cohort_id_fkey";
            columns: ["cohort_id"];
            isOneToOne: false;
            referencedRelation: "cohorts";
            referencedColumns: ["id"];
          }
        ];
      };
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      requesting_org_id: { Args: never; Returns: string };
      requesting_user_id: { Args: never; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
      DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
      DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
