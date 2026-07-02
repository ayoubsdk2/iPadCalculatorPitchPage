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
      admin_cells: {
        Row: {
          cells: Json
          col_gap: number
          column_headers: Json
          columns: number
          created_at: string
          font_color: string
          font_family: string
          font_size: number
          height: number
          id: string
          row_gap: number
          rows: number
          title: string
          updated_at: string
          user_id: string
          width: number
          x: number
          y: number
          z_index: number
        }
        Insert: {
          cells?: Json
          col_gap?: number
          column_headers?: Json
          columns?: number
          created_at?: string
          font_color?: string
          font_family?: string
          font_size?: number
          height?: number
          id?: string
          row_gap?: number
          rows?: number
          title?: string
          updated_at?: string
          user_id: string
          width?: number
          x?: number
          y?: number
          z_index?: number
        }
        Update: {
          cells?: Json
          col_gap?: number
          column_headers?: Json
          columns?: number
          created_at?: string
          font_color?: string
          font_family?: string
          font_size?: number
          height?: number
          id?: string
          row_gap?: number
          rows?: number
          title?: string
          updated_at?: string
          user_id?: string
          width?: number
          x?: number
          y?: number
          z_index?: number
        }
        Relationships: []
      }
      availability_overrides: {
        Row: {
          created_at: string
          end_time: string | null
          id: string
          is_blocked: boolean
          override_date: string
          reason: string | null
          start_time: string | null
          team_profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          is_blocked?: boolean
          override_date: string
          reason?: string | null
          start_time?: string | null
          team_profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          is_blocked?: boolean
          override_date?: string
          reason?: string | null
          start_time?: string | null
          team_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_overrides_team_profile_id_fkey"
            columns: ["team_profile_id"]
            isOneToOne: false
            referencedRelation: "team_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_rules: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          start_time: string
          team_profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
          team_profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
          team_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_team_profile_id_fkey"
            columns: ["team_profile_id"]
            isOneToOne: false
            referencedRelation: "team_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          canceled_reason: string | null
          created_at: string
          end_at: string
          event_type_id: string
          id: string
          invitee_email: string
          invitee_name: string
          invitee_notes: string | null
          invitee_timezone: string
          manage_token: string
          pending_onboarding_id: string | null
          qstash_message_ids: Json
          rescheduled_from_id: string | null
          source: Database["public"]["Enums"]["phomo_booking_source"]
          start_at: string
          status: Database["public"]["Enums"]["phomo_booking_status"]
          team_profile_id: string
          updated_at: string
        }
        Insert: {
          canceled_reason?: string | null
          created_at?: string
          end_at: string
          event_type_id: string
          id?: string
          invitee_email: string
          invitee_name: string
          invitee_notes?: string | null
          invitee_timezone?: string
          manage_token?: string
          pending_onboarding_id?: string | null
          qstash_message_ids?: Json
          rescheduled_from_id?: string | null
          source?: Database["public"]["Enums"]["phomo_booking_source"]
          start_at: string
          status?: Database["public"]["Enums"]["phomo_booking_status"]
          team_profile_id: string
          updated_at?: string
        }
        Update: {
          canceled_reason?: string | null
          created_at?: string
          end_at?: string
          event_type_id?: string
          id?: string
          invitee_email?: string
          invitee_name?: string
          invitee_notes?: string | null
          invitee_timezone?: string
          manage_token?: string
          pending_onboarding_id?: string | null
          qstash_message_ids?: Json
          rescheduled_from_id?: string | null
          source?: Database["public"]["Enums"]["phomo_booking_source"]
          start_at?: string
          status?: Database["public"]["Enums"]["phomo_booking_status"]
          team_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "public_event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_pending_onboarding_id_fkey"
            columns: ["pending_onboarding_id"]
            isOneToOne: false
            referencedRelation: "pending_onboardings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_rescheduled_from_id_fkey"
            columns: ["rescheduled_from_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_team_profile_id_fkey"
            columns: ["team_profile_id"]
            isOneToOne: false
            referencedRelation: "team_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string
          created_at: string
          id: string
          is_default: boolean
          key: string
          subject: string
          team_profile_id: string | null
          updated_at: string
        }
        Insert: {
          body_html: string
          body_text: string
          created_at?: string
          id?: string
          is_default?: boolean
          key: string
          subject: string
          team_profile_id?: string | null
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_text?: string
          created_at?: string
          id?: string
          is_default?: boolean
          key?: string
          subject?: string
          team_profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_team_profile_id_fkey"
            columns: ["team_profile_id"]
            isOneToOne: false
            referencedRelation: "team_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      event_types: {
        Row: {
          buffer_after_minutes: number
          buffer_before_minutes: number
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          is_onboarding: boolean
          is_public: boolean
          location_details: string | null
          location_type: Database["public"]["Enums"]["phomo_location_type"]
          max_days_ahead: number
          min_notice_minutes: number
          name: string
          slug: string
          team_profile_id: string
          updated_at: string
        }
        Insert: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          is_onboarding?: boolean
          is_public?: boolean
          location_details?: string | null
          location_type?: Database["public"]["Enums"]["phomo_location_type"]
          max_days_ahead?: number
          min_notice_minutes?: number
          name: string
          slug: string
          team_profile_id: string
          updated_at?: string
        }
        Update: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          is_onboarding?: boolean
          is_public?: boolean
          location_details?: string | null
          location_type?: Database["public"]["Enums"]["phomo_location_type"]
          max_days_ahead?: number
          min_notice_minutes?: number
          name?: string
          slug?: string
          team_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_types_team_profile_id_fkey"
            columns: ["team_profile_id"]
            isOneToOne: false
            referencedRelation: "team_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      layout_settings: {
        Row: {
          id: string
          settings: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pending_onboardings: {
        Row: {
          company_data: Json
          created_at: string
          environment: string
          id: string
          phaos_account_id: string | null
          provisioning_error: string | null
          retell_agent_id: string | null
          selected_packages: Json
          status: string
          stripe_customer_id: string | null
          stripe_metered_item_id: string | null
          stripe_session_id: string | null
          stripe_subscription_id: string | null
          telnyx_number: string | null
          updated_at: string
          user_id: string | null
          voice_usage_subscription_item_id: string | null
        }
        Insert: {
          company_data: Json
          created_at?: string
          environment?: string
          id?: string
          phaos_account_id?: string | null
          provisioning_error?: string | null
          retell_agent_id?: string | null
          selected_packages: Json
          status?: string
          stripe_customer_id?: string | null
          stripe_metered_item_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          telnyx_number?: string | null
          updated_at?: string
          user_id?: string | null
          voice_usage_subscription_item_id?: string | null
        }
        Update: {
          company_data?: Json
          created_at?: string
          environment?: string
          id?: string
          phaos_account_id?: string | null
          provisioning_error?: string | null
          retell_agent_id?: string | null
          selected_packages?: Json
          status?: string
          stripe_customer_id?: string | null
          stripe_metered_item_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          telnyx_number?: string | null
          updated_at?: string
          user_id?: string | null
          voice_usage_subscription_item_id?: string | null
        }
        Relationships: []
      }
      saved_calculations: {
        Row: {
          calculator_state: Json
          company_name: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calculator_state?: Json
          company_name: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calculator_state?: Json
          company_name?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      solution_inquiries: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          solution: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          solution: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          solution?: string
        }
        Relationships: []
      }
      stripe_prices: {
        Row: {
          created_at: string
          currency: string
          environment: string
          id: string
          metadata: Json
          recurring_interval: string | null
          sku: string
          stripe_price_id: string
          stripe_product_id: string
          unit_amount: number | null
          updated_at: string
          usage_type: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          metadata?: Json
          recurring_interval?: string | null
          sku: string
          stripe_price_id: string
          stripe_product_id: string
          unit_amount?: number | null
          updated_at?: string
          usage_type?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          metadata?: Json
          recurring_interval?: string | null
          sku?: string
          stripe_price_id?: string
          stripe_product_id?: string
          unit_amount?: number | null
          updated_at?: string
          usage_type?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      team_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          phomo_slug: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          phomo_slug: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          phomo_slug?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workflow_runs: {
        Row: {
          booking_id: string | null
          channel: string
          created_at: string
          error: string | null
          executed_at: string | null
          id: string
          metadata: Json
          scheduled_at: string | null
          status: string
          template_key: string
          workflow_id: string | null
        }
        Insert: {
          booking_id?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          executed_at?: string | null
          id?: string
          metadata?: Json
          scheduled_at?: string | null
          status?: string
          template_key: string
          workflow_id?: string | null
        }
        Update: {
          booking_id?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          executed_at?: string | null
          id?: string
          metadata?: Json
          scheduled_at?: string | null
          status?: string
          template_key?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          channel: Database["public"]["Enums"]["phomo_workflow_channel"]
          created_at: string
          id: string
          is_enabled: boolean
          name: string
          team_profile_id: string
          template_key: string
          trigger: Database["public"]["Enums"]["phomo_workflow_trigger"]
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["phomo_workflow_channel"]
          created_at?: string
          id?: string
          is_enabled?: boolean
          name: string
          team_profile_id: string
          template_key: string
          trigger: Database["public"]["Enums"]["phomo_workflow_trigger"]
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["phomo_workflow_channel"]
          created_at?: string
          id?: string
          is_enabled?: boolean
          name?: string
          team_profile_id?: string
          template_key?: string
          trigger?: Database["public"]["Enums"]["phomo_workflow_trigger"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_team_profile_id_fkey"
            columns: ["team_profile_id"]
            isOneToOne: false
            referencedRelation: "team_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_event_types: {
        Row: {
          buffer_after_minutes: number | null
          buffer_before_minutes: number | null
          description: string | null
          duration_minutes: number | null
          host_avatar_url: string | null
          host_bio: string | null
          host_display_name: string | null
          host_slug: string | null
          host_timezone: string | null
          id: string | null
          is_onboarding: boolean | null
          location_type:
            | Database["public"]["Enums"]["phomo_location_type"]
            | null
          max_days_ahead: number | null
          min_notice_minutes: number | null
          name: string | null
          slug: string | null
          team_profile_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_types_team_profile_id_fkey"
            columns: ["team_profile_id"]
            isOneToOne: false
            referencedRelation: "team_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      phomo_booking_by_token: {
        Args: { _token: string }
        Returns: {
          duration_minutes: number
          end_at: string
          event_name: string
          event_type_id: string
          host_display_name: string
          id: string
          invitee_email: string
          invitee_name: string
          invitee_notes: string
          invitee_timezone: string
          start_at: string
          status: Database["public"]["Enums"]["phomo_booking_status"]
          team_profile_id: string
        }[]
      }
      phomo_busy_times: {
        Args: { _from: string; _team_profile_id: string; _to: string }
        Returns: {
          end_at: string
          start_at: string
        }[]
      }
      phomo_cancel_booking: {
        Args: { _reason?: string; _token: string }
        Returns: boolean
      }
      phomo_create_booking: {
        Args: {
          _event_type_id: string
          _invitee_email: string
          _invitee_name: string
          _invitee_notes: string
          _invitee_timezone: string
          _pending_onboarding_id?: string
          _start_at: string
        }
        Returns: {
          end_at: string
          id: string
          manage_token: string
        }[]
      }
      phomo_get_availability_windows: {
        Args: { _team_profile_id: string }
        Returns: {
          day_of_week: number
          end_time: string
          start_time: string
        }[]
      }
      phomo_get_event_context: {
        Args: { _event_type_id: string }
        Returns: {
          buffer_after_minutes: number
          buffer_before_minutes: number
          duration_minutes: number
          event_name: string
          event_type_id: string
          location_type: Database["public"]["Enums"]["phomo_location_type"]
          max_days_ahead: number
          min_notice_minutes: number
          team_display_name: string
          team_profile_id: string
          team_timezone: string
        }[]
      }
      phomo_get_overrides: {
        Args: { _from: string; _team_profile_id: string; _to: string }
        Returns: {
          end_time: string
          is_blocked: boolean
          override_date: string
          reason: string
          start_time: string
        }[]
      }
      phomo_reschedule_booking: {
        Args: { _new_start_at: string; _new_timezone: string; _token: string }
        Returns: {
          end_at: string
          id: string
          manage_token: string
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "phomo_team"
      phomo_booking_source: "post_stripe" | "direct_link"
      phomo_booking_status: "booked" | "canceled" | "rescheduled" | "completed"
      phomo_location_type:
        | "zoom"
        | "google_meet"
        | "ms_teams"
        | "phone"
        | "in_person"
        | "ask_invitee"
        | "custom"
      phomo_workflow_channel: "email" | "sms"
      phomo_workflow_trigger:
        | "booking_created"
        | "reminder_24h"
        | "reminder_10m"
        | "canceled"
        | "completed"
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
      app_role: ["admin", "user", "phomo_team"],
      phomo_booking_source: ["post_stripe", "direct_link"],
      phomo_booking_status: ["booked", "canceled", "rescheduled", "completed"],
      phomo_location_type: [
        "zoom",
        "google_meet",
        "ms_teams",
        "phone",
        "in_person",
        "ask_invitee",
        "custom",
      ],
      phomo_workflow_channel: ["email", "sms"],
      phomo_workflow_trigger: [
        "booking_created",
        "reminder_24h",
        "reminder_10m",
        "canceled",
        "completed",
      ],
    },
  },
} as const
