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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      daily_counters: {
        Row: {
          day: string
          scope: string
          value: number
        }
        Insert: {
          day: string
          scope: string
          value?: number
        }
        Update: {
          day?: string
          scope?: string
          value?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      queues: {
        Row: {
          completed_at: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          daily_seq: number
          id: string
          queue_date: string
          queue_number: string
          served_at: string | null
          served_by: string | null
          service_code: string | null
          service_type: Database["public"]["Enums"]["service_type_enum"]
          status: Database["public"]["Enums"]["queue_status_enum"]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          customer_name: string
          customer_phone: string
          daily_seq: number
          id?: string
          queue_date?: string
          queue_number: string
          served_at?: string | null
          served_by?: string | null
          service_code?: string | null
          service_type: Database["public"]["Enums"]["service_type_enum"]
          status?: Database["public"]["Enums"]["queue_status_enum"]
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          daily_seq?: number
          id?: string
          queue_date?: string
          queue_number?: string
          served_at?: string | null
          served_by?: string | null
          service_code?: string | null
          service_type?: Database["public"]["Enums"]["service_type_enum"]
          status?: Database["public"]["Enums"]["queue_status_enum"]
        }
        Relationships: []
      }
      service_ticket_logs: {
        Row: {
          changed_by: string
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["service_ticket_status"]
          notes: string | null
          previous_status:
            | Database["public"]["Enums"]["service_ticket_status"]
            | null
          ticket_id: string
        }
        Insert: {
          changed_by: string
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["service_ticket_status"]
          notes?: string | null
          previous_status?:
            | Database["public"]["Enums"]["service_ticket_status"]
            | null
          ticket_id: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["service_ticket_status"]
          notes?: string | null
          previous_status?:
            | Database["public"]["Enums"]["service_ticket_status"]
            | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_ticket_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      service_tickets: {
        Row: {
          accessories: Json
          assigned_technician: string | null
          base_service_fee: number
          cancel_fee: number
          complaint_description: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          customer_phone_alt: string | null
          customer_signature_url: string | null
          estimated_cost: number
          final_cost: number
          id: string
          intake_by: string
          mtm_number: string | null
          part_notes: string | null
          photos_url: string[] | null
          physical_condition_tags: string[] | null
          physical_notes: string | null
          product_description: string
          qc_notes: string | null
          queue_id: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["service_ticket_status"]
          terms_accepted: boolean
          ticket_number: string
          updated_at: string
          warranty_status: Database["public"]["Enums"]["warranty_status_enum"]
        }
        Insert: {
          accessories?: Json
          assigned_technician?: string | null
          base_service_fee?: number
          cancel_fee?: number
          complaint_description: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          customer_phone_alt?: string | null
          customer_signature_url?: string | null
          estimated_cost?: number
          final_cost?: number
          id?: string
          intake_by: string
          mtm_number?: string | null
          part_notes?: string | null
          photos_url?: string[] | null
          physical_condition_tags?: string[] | null
          physical_notes?: string | null
          product_description: string
          qc_notes?: string | null
          queue_id?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["service_ticket_status"]
          terms_accepted?: boolean
          ticket_number: string
          updated_at?: string
          warranty_status?: Database["public"]["Enums"]["warranty_status_enum"]
        }
        Update: {
          accessories?: Json
          assigned_technician?: string | null
          base_service_fee?: number
          cancel_fee?: number
          complaint_description?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          customer_phone_alt?: string | null
          customer_signature_url?: string | null
          estimated_cost?: number
          final_cost?: number
          id?: string
          intake_by?: string
          mtm_number?: string | null
          part_notes?: string | null
          photos_url?: string[] | null
          physical_condition_tags?: string[] | null
          physical_notes?: string | null
          product_description?: string
          qc_notes?: string | null
          queue_id?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["service_ticket_status"]
          terms_accepted?: boolean
          ticket_number?: string
          updated_at?: string
          warranty_status?: Database["public"]["Enums"]["warranty_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "service_tickets_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_queue_ticket: {
        Args: {
          p_customer_name: string
          p_customer_phone: string
          p_service_code?: string
          p_service_type: Database["public"]["Enums"]["service_type_enum"]
        }
        Returns: {
          completed_at: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          daily_seq: number
          id: string
          queue_date: string
          queue_number: string
          served_at: string | null
          served_by: string | null
          service_code: string | null
          service_type: Database["public"]["Enums"]["service_type_enum"]
          status: Database["public"]["Enums"]["queue_status_enum"]
        }
        SetofOptions: {
          from: "*"
          to: "queues"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_role_name: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      next_counter: { Args: { p_scope: string }; Returns: number }
      next_ticket_number: { Args: never; Returns: string }
      public_track_ticket: {
        Args: { p_ticket_number: string }
        Returns: {
          created_at: string
          estimated_cost: number
          final_cost: number
          product_description: string
          status: Database["public"]["Enums"]["service_ticket_status"]
          ticket_number: string
          updated_at: string
        }[]
      }
      pull_next_ticket: {
        Args: { p_technician: string }
        Returns: {
          accessories: Json
          assigned_technician: string | null
          base_service_fee: number
          cancel_fee: number
          complaint_description: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          customer_phone_alt: string | null
          customer_signature_url: string | null
          estimated_cost: number
          final_cost: number
          id: string
          intake_by: string
          mtm_number: string | null
          part_notes: string | null
          photos_url: string[] | null
          physical_condition_tags: string[] | null
          physical_notes: string | null
          product_description: string
          qc_notes: string | null
          queue_id: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["service_ticket_status"]
          terms_accepted: boolean
          ticket_number: string
          updated_at: string
          warranty_status: Database["public"]["Enums"]["warranty_status_enum"]
        }
        SetofOptions: {
          from: "*"
          to: "service_tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "technician" | "owner"
      queue_status_enum: "waiting" | "serving" | "completed" | "canceled"
      service_ticket_status:
        | "INTAKE"
        | "DIAGNOSING"
        | "WAITING_APPROVAL"
        | "WAITING_PART"
        | "PART_INSTALLING"
        | "IN_REPAIR"
        | "QC_TESTING"
        | "READY_FOR_PICKUP"
        | "CLOSED"
        | "CANCELLED"
      service_type_enum: "service_baru" | "pengambilan_unit" | "lain_lain"
      warranty_status_enum: "INW" | "OOW" | "CID" | "DOA"
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
      app_role: ["admin", "technician", "owner"],
      queue_status_enum: ["waiting", "serving", "completed", "canceled"],
      service_ticket_status: [
        "INTAKE",
        "DIAGNOSING",
        "WAITING_APPROVAL",
        "WAITING_PART",
        "PART_INSTALLING",
        "IN_REPAIR",
        "QC_TESTING",
        "READY_FOR_PICKUP",
        "CLOSED",
        "CANCELLED",
      ],
      service_type_enum: ["service_baru", "pengambilan_unit", "lain_lain"],
      warranty_status_enum: ["INW", "OOW", "CID", "DOA"],
    },
  },
} as const
