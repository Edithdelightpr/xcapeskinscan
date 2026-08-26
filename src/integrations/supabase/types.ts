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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      accountability_rules: {
        Row: {
          active: boolean
          applies_to_role: string | null
          created_at: string
          deduction_amount: number
          deduction_percent: number
          id: string
          kind: string
          label: string
          notes: string | null
          points: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          applies_to_role?: string | null
          created_at?: string
          deduction_amount?: number
          deduction_percent?: number
          id?: string
          kind: string
          label: string
          notes?: string | null
          points?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          applies_to_role?: string | null
          created_at?: string
          deduction_amount?: number
          deduction_percent?: number
          id?: string
          kind?: string
          label?: string
          notes?: string | null
          points?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          detail: string | null
          id: string
          role: string | null
          staff_user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          detail?: string | null
          id?: string
          role?: string | null
          staff_user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          detail?: string | null
          id?: string
          role?: string | null
          staff_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "activity_logs_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "activity_logs_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_impersonation_events: {
        Row: {
          action: string | null
          created_at: string
          entity_id: string | null
          entity_table: string | null
          event_type: string
          id: string
          payload: Json | null
          session_id: string
        }
        Insert: {
          action?: string | null
          created_at?: string
          entity_id?: string | null
          entity_table?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          session_id: string
        }
        Update: {
          action?: string | null
          created_at?: string
          entity_id?: string | null
          entity_table?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_impersonation_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "admin_impersonation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_impersonation_sessions: {
        Row: {
          admin_user_id: string
          created_at: string
          effective_staff_id: string
          ended_at: string | null
          expires_at: string
          id: string
          reason: string
          revoked: boolean
          started_at: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          effective_staff_id: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          reason: string
          revoked?: boolean
          started_at?: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          effective_staff_id?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          reason?: string
          revoked?: boolean
          started_at?: string
        }
        Relationships: []
      }
      appointment_messages: {
        Row: {
          appointment_id: string
          channel: string
          client_id: string | null
          created_at: string
          delivered_at: string | null
          error: string | null
          id: string
          message_body: string | null
          message_type: string
          metadata: Json
          phone: string | null
          provider: string
          provider_message_id: string | null
          read_at: string | null
          sent_at: string | null
          status: string
          template_name: string | null
          updated_at: string
        }
        Insert: {
          appointment_id: string
          channel?: string
          client_id?: string | null
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          id?: string
          message_body?: string | null
          message_type?: string
          metadata?: Json
          phone?: string | null
          provider?: string
          provider_message_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: string
          template_name?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          channel?: string
          client_id?: string | null
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          id?: string
          message_body?: string | null
          message_type?: string
          metadata?: Json
          phone?: string | null
          provider?: string
          provider_message_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: string
          template_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["next_appointment_id"]
          },
        ]
      }
      appointments: {
        Row: {
          amount_paid: number
          appointment_type: string
          assigned_aesthetician_id: string | null
          attributed_staff_id: string | null
          booking_group_id: string | null
          client_confirmed_at: string | null
          client_confirmed_by: string | null
          client_id: string
          color_key: string | null
          created_at: string
          created_by: string | null
          date: string
          duration_minutes: number | null
          id: string
          is_walk_in: boolean
          membership: string | null
          min_deposit_percent: number
          notes: string | null
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_status: string
          referral_owner_id: string | null
          reminder_1h_sent_at: string | null
          reminder_24h_sent_at: string | null
          skin_summary: string | null
          source: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          time: string
          total_amount: number | null
          treatment: string
          treatment_plan_id: string | null
          treatment_plan_schedule_item_id: string | null
          treatment_plan_session_id: string | null
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          appointment_type?: string
          assigned_aesthetician_id?: string | null
          attributed_staff_id?: string | null
          booking_group_id?: string | null
          client_confirmed_at?: string | null
          client_confirmed_by?: string | null
          client_id: string
          color_key?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          duration_minutes?: number | null
          id?: string
          is_walk_in?: boolean
          membership?: string | null
          min_deposit_percent?: number
          notes?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_status?: string
          referral_owner_id?: string | null
          reminder_1h_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          skin_summary?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          time: string
          total_amount?: number | null
          treatment: string
          treatment_plan_id?: string | null
          treatment_plan_schedule_item_id?: string | null
          treatment_plan_session_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          appointment_type?: string
          assigned_aesthetician_id?: string | null
          attributed_staff_id?: string | null
          booking_group_id?: string | null
          client_confirmed_at?: string | null
          client_confirmed_by?: string | null
          client_id?: string
          color_key?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          duration_minutes?: number | null
          id?: string
          is_walk_in?: boolean
          membership?: string | null
          min_deposit_percent?: number
          notes?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_status?: string
          referral_owner_id?: string | null
          reminder_1h_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          skin_summary?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          time?: string
          total_amount?: number | null
          treatment?: string
          treatment_plan_id?: string | null
          treatment_plan_schedule_item_id?: string | null
          treatment_plan_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "appointments_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "appointments_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_payment_confirmed_by_fkey"
            columns: ["payment_confirmed_by"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "appointments_payment_confirmed_by_fkey"
            columns: ["payment_confirmed_by"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "appointments_payment_confirmed_by_fkey"
            columns: ["payment_confirmed_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_referral_owner_id_fkey"
            columns: ["referral_owner_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "appointments_referral_owner_id_fkey"
            columns: ["referral_owner_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "appointments_referral_owner_id_fkey"
            columns: ["referral_owner_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tp_schedule_item_fk"
            columns: ["treatment_plan_schedule_item_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["next_schedule_item_id"]
          },
          {
            foreignKeyName: "appointments_tp_schedule_item_fk"
            columns: ["treatment_plan_schedule_item_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_schedule_items"
            referencedColumns: ["id"]
          },
        ]
      }
      attribution_events: {
        Row: {
          actor_staff_id: string | null
          amount_naira: number
          client_id: string | null
          created_at: string
          dedupe_key: string | null
          event_kind: Database["public"]["Enums"]["attribution_event_kind"]
          id: string
          occurred_at: string
          outreach_id: string | null
          owner_staff_id: string | null
          quantity: number
          source_context: Json
          visit_id: string | null
        }
        Insert: {
          actor_staff_id?: string | null
          amount_naira?: number
          client_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          event_kind: Database["public"]["Enums"]["attribution_event_kind"]
          id?: string
          occurred_at?: string
          outreach_id?: string | null
          owner_staff_id?: string | null
          quantity?: number
          source_context?: Json
          visit_id?: string | null
        }
        Update: {
          actor_staff_id?: string | null
          amount_naira?: number
          client_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          event_kind?: Database["public"]["Enums"]["attribution_event_kind"]
          id?: string
          occurred_at?: string
          outreach_id?: string | null
          owner_staff_id?: string | null
          quantity?: number
          source_context?: Json
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attribution_events_actor_staff_id_fkey"
            columns: ["actor_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "attribution_events_actor_staff_id_fkey"
            columns: ["actor_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "attribution_events_actor_staff_id_fkey"
            columns: ["actor_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribution_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "attribution_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribution_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "attribution_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "attribution_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "attribution_events_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "outreach_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribution_events_owner_staff_id_fkey"
            columns: ["owner_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "attribution_events_owner_staff_id_fkey"
            columns: ["owner_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "attribution_events_owner_staff_id_fkey"
            columns: ["owner_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribution_events_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "client_visit_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribution_events_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "client_visit_reconciliation_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "attribution_events_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "attribution_events_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_totals_v"
            referencedColumns: ["visit_id"]
          },
        ]
      }
      booking_management_tokens: {
        Row: {
          allowed_actions: string[]
          appointment_id: string
          created_at: string
          expires_at: string
          id: string
          token: string
          used_action: string | null
          used_at: string | null
        }
        Insert: {
          allowed_actions?: string[]
          appointment_id: string
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_action?: string | null
          used_at?: string | null
        }
        Update: {
          allowed_actions?: string[]
          appointment_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_action?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_management_tokens_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_management_tokens_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["next_appointment_id"]
          },
        ]
      }
      booking_settings: {
        Row: {
          id: boolean
          max_days_ahead: number
          min_deposit_percent: number
          slot_minutes: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          max_days_ahead?: number
          min_deposit_percent?: number
          slot_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          max_days_ahead?: number
          min_deposit_percent?: number
          slot_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          close_time: string
          day_of_week: number
          is_24h: boolean
          is_open: boolean
          open_time: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          close_time?: string
          day_of_week: number
          is_24h?: boolean
          is_open?: boolean
          open_time?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          close_time?: string
          day_of_week?: number
          is_24h?: boolean
          is_open?: boolean
          open_time?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      business_proposal_versions: {
        Row: {
          id: string
          label: string | null
          owner_user_id: string
          saved_at: string
          state: Json
        }
        Insert: {
          id?: string
          label?: string | null
          owner_user_id: string
          saved_at?: string
          state: Json
        }
        Update: {
          id?: string
          label?: string | null
          owner_user_id?: string
          saved_at?: string
          state?: Json
        }
        Relationships: []
      }
      business_proposals: {
        Row: {
          created_at: string
          id: string
          owner_user_id: string
          state: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_user_id: string
          state?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_user_id?: string
          state?: Json
          updated_at?: string
        }
        Relationships: []
      }
      calendar_event_recipients: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          event_id: string
          kind: string
          staff_user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          event_id: string
          kind?: string
          staff_user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          event_id?: string
          kind?: string
          staff_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_recipients_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          created_at: string
          created_by: string | null
          end_time: string | null
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          id: string
          linked_client_id: string | null
          linked_staff_id: string | null
          notes: string | null
          start_time: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          event_type?: Database["public"]["Enums"]["calendar_event_type"]
          id?: string
          linked_client_id?: string | null
          linked_staff_id?: string | null
          notes?: string | null
          start_time: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          event_type?: Database["public"]["Enums"]["calendar_event_type"]
          id?: string
          linked_client_id?: string | null
          linked_staff_id?: string | null
          notes?: string | null
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_conversions: {
        Row: {
          amount: number | null
          attributed_staff_id: string | null
          client_id: string
          conversion_type: string
          converted_at: string
          created_at: string
          id: string
          membership_tier: string | null
          promo_code: string | null
          service: string | null
          source: string | null
        }
        Insert: {
          amount?: number | null
          attributed_staff_id?: string | null
          client_id: string
          conversion_type: string
          converted_at?: string
          created_at?: string
          id?: string
          membership_tier?: string | null
          promo_code?: string | null
          service?: string | null
          source?: string | null
        }
        Update: {
          amount?: number | null
          attributed_staff_id?: string | null
          client_id?: string
          conversion_type?: string
          converted_at?: string
          created_at?: string
          id?: string
          membership_tier?: string | null
          promo_code?: string | null
          service?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_conversions_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "client_conversions_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "client_conversions_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_conversions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_conversions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_conversions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_conversions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_conversions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
        ]
      }
      client_follow_ups: {
        Row: {
          client_id: string
          completed_at: string | null
          completed_by_staff_id: string | null
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          notes: string | null
          owner_staff_id: string | null
          reason: string | null
          status: string
          updated_at: string
          visit_id: string | null
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          completed_by_staff_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          owner_staff_id?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
          visit_id?: string | null
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          completed_by_staff_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          owner_staff_id?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_follow_ups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_follow_ups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_follow_ups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_follow_ups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_follow_ups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_follow_ups_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "client_visit_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_follow_ups_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "client_visit_reconciliation_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "client_follow_ups_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "client_follow_ups_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_totals_v"
            referencedColumns: ["visit_id"]
          },
        ]
      }
      client_identity_change_proposals: {
        Row: {
          applied_at: string | null
          approved_by: string | null
          client_id: string
          created_at: string
          decided_at: string | null
          field: string
          id: string
          new_value: Json
          old_value: Json | null
          proposed_by: string | null
          reason: string | null
          source_event_id: string | null
          status: string
        }
        Insert: {
          applied_at?: string | null
          approved_by?: string | null
          client_id: string
          created_at?: string
          decided_at?: string | null
          field: string
          id?: string
          new_value: Json
          old_value?: Json | null
          proposed_by?: string | null
          reason?: string | null
          source_event_id?: string | null
          status?: string
        }
        Update: {
          applied_at?: string | null
          approved_by?: string | null
          client_id?: string
          created_at?: string
          decided_at?: string | null
          field?: string
          id?: string
          new_value?: Json
          old_value?: Json | null
          proposed_by?: string | null
          reason?: string | null
          source_event_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_identity_change_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_identity_change_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_identity_change_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_identity_change_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_identity_change_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_identity_change_proposals_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "operational_events"
            referencedColumns: ["id"]
          },
        ]
      }
      client_media: {
        Row: {
          archived: boolean
          archived_at: string | null
          assessment_id: string | null
          backup_location: string | null
          bucket_path: string
          caption: string | null
          category: string | null
          client_id: string
          created_at: string
          file_name: string | null
          file_type: string | null
          id: string
          includes_sensitive_notes: boolean
          kind: string
          mime_type: string | null
          report_scope: string | null
          report_type: string | null
          report_version: number | null
          size_bytes: number | null
          storage_path: string | null
          upload_date: string
          uploaded_by: string | null
          visit_id: string | null
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          assessment_id?: string | null
          backup_location?: string | null
          bucket_path: string
          caption?: string | null
          category?: string | null
          client_id: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          id?: string
          includes_sensitive_notes?: boolean
          kind?: string
          mime_type?: string | null
          report_scope?: string | null
          report_type?: string | null
          report_version?: number | null
          size_bytes?: number | null
          storage_path?: string | null
          upload_date?: string
          uploaded_by?: string | null
          visit_id?: string | null
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          assessment_id?: string | null
          backup_location?: string | null
          bucket_path?: string
          caption?: string | null
          category?: string | null
          client_id?: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          id?: string
          includes_sensitive_notes?: boolean
          kind?: string
          mime_type?: string | null
          report_scope?: string | null
          report_type?: string | null
          report_version?: number | null
          size_bytes?: number | null
          storage_path?: string | null
          upload_date?: string
          uploaded_by?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_media_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_media_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_media_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_media_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_media_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "client_media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "client_media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_report_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          link_id: string
          payload: Json
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          link_id: string
          payload?: Json
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          link_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "client_report_events_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "client_report_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_report_events_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["report_link_id"]
          },
        ]
      }
      client_report_links: {
        Row: {
          assessment_id: string
          client_id: string
          commercial_snapshot: Json | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          first_opened_at: string | null
          id: string
          last_opened_at: string | null
          open_count: number
          origin_org_id: string | null
          origin_role: string | null
          revoked_at: string | null
          token_hash: string
          token_prefix: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          client_id: string
          commercial_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          first_opened_at?: string | null
          id?: string
          last_opened_at?: string | null
          open_count?: number
          origin_org_id?: string | null
          origin_role?: string | null
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          client_id?: string
          commercial_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          first_opened_at?: string | null
          id?: string
          last_opened_at?: string | null
          open_count?: number
          origin_org_id?: string | null
          origin_role?: string | null
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_report_links_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "client_visit_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_report_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_report_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_report_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_report_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_report_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_report_links_origin_org_id_fkey"
            columns: ["origin_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_safety_intakes: {
        Row: {
          acknowledged_at: string | null
          acknowledged_signature: string | null
          active_skin_conditions: string | null
          alcohol_use: string | null
          allergies: string | null
          allergy_severity: string | null
          anaesthetic_reaction: boolean | null
          chronic_conditions: string[] | null
          chronic_conditions_notes: string | null
          client_id: string
          clinical_photo_consent: boolean | null
          clinical_photo_signature: string | null
          cold_sore_history: boolean | null
          collected_at: string
          collected_by_staff_id: string | null
          created_at: string
          current_medications: string | null
          current_skincare_routine: string | null
          family_history: string | null
          form_version: number | null
          id: string
          information_accurate_ack: boolean | null
          is_breastfeeding: boolean | null
          is_pregnant: string | null
          keloid_tendency: boolean | null
          last_period_date: string | null
          marketing_image_consent: boolean
          marketing_signature: string | null
          menstrual_status: string | null
          notes: string | null
          on_blood_thinners: boolean | null
          on_hormonal_therapy: boolean | null
          on_retinoids: boolean | null
          past_treatments: string[] | null
          photo_consent_internal: boolean
          prior_surgeries: string | null
          recent_procedures: string | null
          recent_sun_exposure: boolean | null
          skin_concerns: string[] | null
          skin_self_type: string | null
          skin_type_fitzpatrick: string | null
          smoking_status: string | null
          sun_habits: string | null
          supplements: string | null
          treatment_consent: boolean
          water_intake: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_signature?: string | null
          active_skin_conditions?: string | null
          alcohol_use?: string | null
          allergies?: string | null
          allergy_severity?: string | null
          anaesthetic_reaction?: boolean | null
          chronic_conditions?: string[] | null
          chronic_conditions_notes?: string | null
          client_id: string
          clinical_photo_consent?: boolean | null
          clinical_photo_signature?: string | null
          cold_sore_history?: boolean | null
          collected_at?: string
          collected_by_staff_id?: string | null
          created_at?: string
          current_medications?: string | null
          current_skincare_routine?: string | null
          family_history?: string | null
          form_version?: number | null
          id?: string
          information_accurate_ack?: boolean | null
          is_breastfeeding?: boolean | null
          is_pregnant?: string | null
          keloid_tendency?: boolean | null
          last_period_date?: string | null
          marketing_image_consent?: boolean
          marketing_signature?: string | null
          menstrual_status?: string | null
          notes?: string | null
          on_blood_thinners?: boolean | null
          on_hormonal_therapy?: boolean | null
          on_retinoids?: boolean | null
          past_treatments?: string[] | null
          photo_consent_internal?: boolean
          prior_surgeries?: string | null
          recent_procedures?: string | null
          recent_sun_exposure?: boolean | null
          skin_concerns?: string[] | null
          skin_self_type?: string | null
          skin_type_fitzpatrick?: string | null
          smoking_status?: string | null
          sun_habits?: string | null
          supplements?: string | null
          treatment_consent?: boolean
          water_intake?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_signature?: string | null
          active_skin_conditions?: string | null
          alcohol_use?: string | null
          allergies?: string | null
          allergy_severity?: string | null
          anaesthetic_reaction?: boolean | null
          chronic_conditions?: string[] | null
          chronic_conditions_notes?: string | null
          client_id?: string
          clinical_photo_consent?: boolean | null
          clinical_photo_signature?: string | null
          cold_sore_history?: boolean | null
          collected_at?: string
          collected_by_staff_id?: string | null
          created_at?: string
          current_medications?: string | null
          current_skincare_routine?: string | null
          family_history?: string | null
          form_version?: number | null
          id?: string
          information_accurate_ack?: boolean | null
          is_breastfeeding?: boolean | null
          is_pregnant?: string | null
          keloid_tendency?: boolean | null
          last_period_date?: string | null
          marketing_image_consent?: boolean
          marketing_signature?: string | null
          menstrual_status?: string | null
          notes?: string | null
          on_blood_thinners?: boolean | null
          on_hormonal_therapy?: boolean | null
          on_retinoids?: boolean | null
          past_treatments?: string[] | null
          photo_consent_internal?: boolean
          prior_surgeries?: string | null
          recent_procedures?: string | null
          recent_sun_exposure?: boolean | null
          skin_concerns?: string[] | null
          skin_self_type?: string | null
          skin_type_fitzpatrick?: string | null
          smoking_status?: string | null
          sun_habits?: string | null
          supplements?: string | null
          treatment_consent?: boolean
          water_intake?: string | null
        }
        Relationships: []
      }
      client_visit_assessments: {
        Row: {
          appointment_id: string | null
          assessed_by_staff_id: string | null
          body_bmi_enabled: boolean
          body_bmi_report: Json
          client_goal: string | null
          client_id: string
          created_at: string
          follow_up_recommendation: string | null
          home_care: string | null
          id: string
          main_concern: string | null
          next_visit_in_weeks: number | null
          origin_org_id: string | null
          origin_role: string | null
          origin_user_id: string | null
          plan_conversions: Json
          practitioner_observation: string | null
          recommended_products: Json
          recommended_services: Json
          red_flags: Json
          report_ready: boolean
          skin_analysis: Json
          skin_analysis_enabled: boolean
          updated_at: string
          visit_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          assessed_by_staff_id?: string | null
          body_bmi_enabled?: boolean
          body_bmi_report?: Json
          client_goal?: string | null
          client_id: string
          created_at?: string
          follow_up_recommendation?: string | null
          home_care?: string | null
          id?: string
          main_concern?: string | null
          next_visit_in_weeks?: number | null
          origin_org_id?: string | null
          origin_role?: string | null
          origin_user_id?: string | null
          plan_conversions?: Json
          practitioner_observation?: string | null
          recommended_products?: Json
          recommended_services?: Json
          red_flags?: Json
          report_ready?: boolean
          skin_analysis?: Json
          skin_analysis_enabled?: boolean
          updated_at?: string
          visit_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          assessed_by_staff_id?: string | null
          body_bmi_enabled?: boolean
          body_bmi_report?: Json
          client_goal?: string | null
          client_id?: string
          created_at?: string
          follow_up_recommendation?: string | null
          home_care?: string | null
          id?: string
          main_concern?: string | null
          next_visit_in_weeks?: number | null
          origin_org_id?: string | null
          origin_role?: string | null
          origin_user_id?: string | null
          plan_conversions?: Json
          practitioner_observation?: string | null
          recommended_products?: Json
          recommended_services?: Json
          red_flags?: Json
          report_ready?: boolean
          skin_analysis?: Json
          skin_analysis_enabled?: boolean
          updated_at?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_visit_assessments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_visit_assessments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["next_appointment_id"]
          },
          {
            foreignKeyName: "client_visit_assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_visit_assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_visit_assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_visit_assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_visit_assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_visit_assessments_origin_org_id_fkey"
            columns: ["origin_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_visit_assessments_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "client_visit_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_visit_assessments_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "client_visit_reconciliation_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "client_visit_assessments_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "client_visit_assessments_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_totals_v"
            referencedColumns: ["visit_id"]
          },
        ]
      }
      client_visit_logs: {
        Row: {
          amended_at: string | null
          amended_by: string | null
          amendment_reason: string | null
          appointment_id: string | null
          assigned_medical_expert_id: string | null
          attributed_to_user_id: string | null
          claimed_at: string | null
          claimed_by_staff_id: string | null
          client_id: string
          consultation_only_reason: string | null
          created_at: string
          discount_applied_at: string | null
          discount_applied_by: string | null
          duration_minutes: number | null
          final_total: number | null
          follow_up_decision: string | null
          follow_up_required: boolean | null
          id: string
          logged_by_staff_id: string | null
          manual_discount_amount: number | null
          manual_discount_reason: string | null
          manual_discount_type: string | null
          manual_discount_value: number | null
          next_appointment_recommended: boolean | null
          notes: string | null
          outcome: Database["public"]["Enums"]["visit_outcome"]
          payment_state: string | null
          promo_code_applied: string | null
          promo_discount_amount: number | null
          promo_discount_pct: number | null
          promo_staff_user_id: string | null
          reason_for_visit: Database["public"]["Enums"]["visit_reason"]
          reassignment_at: string | null
          reassignment_by_staff_id: string | null
          reassignment_reason: string | null
          recommendation_summary: string | null
          removal_group_id: string | null
          removal_reason: string | null
          removed_at: string | null
          removed_by: string | null
          safety_intake_id: string | null
          same_day_prior_visit_id: string | null
          second_visit_reason: string | null
          service_delivered: string | null
          sign_in_request_id: string | null
          sign_in_source: string | null
          sign_in_time: string
          sign_out_time: string | null
          signed_out_by_staff_id: string | null
          source_id: string | null
          source_type: string | null
          status: string
          treatment_completed_at: string | null
          treatment_completed_by: string | null
          treatment_completion_notes: string | null
          treatment_outcome: string | null
          treatment_plan_confirmed_at: string | null
          treatment_plan_confirmed_by: string | null
          treatment_plan_decision: string | null
          treatment_started_at: string | null
          treatment_started_by: string | null
          updated_at: string
          visit_date: string
          visit_type: string | null
        }
        Insert: {
          amended_at?: string | null
          amended_by?: string | null
          amendment_reason?: string | null
          appointment_id?: string | null
          assigned_medical_expert_id?: string | null
          attributed_to_user_id?: string | null
          claimed_at?: string | null
          claimed_by_staff_id?: string | null
          client_id: string
          consultation_only_reason?: string | null
          created_at?: string
          discount_applied_at?: string | null
          discount_applied_by?: string | null
          duration_minutes?: number | null
          final_total?: number | null
          follow_up_decision?: string | null
          follow_up_required?: boolean | null
          id?: string
          logged_by_staff_id?: string | null
          manual_discount_amount?: number | null
          manual_discount_reason?: string | null
          manual_discount_type?: string | null
          manual_discount_value?: number | null
          next_appointment_recommended?: boolean | null
          notes?: string | null
          outcome?: Database["public"]["Enums"]["visit_outcome"]
          payment_state?: string | null
          promo_code_applied?: string | null
          promo_discount_amount?: number | null
          promo_discount_pct?: number | null
          promo_staff_user_id?: string | null
          reason_for_visit?: Database["public"]["Enums"]["visit_reason"]
          reassignment_at?: string | null
          reassignment_by_staff_id?: string | null
          reassignment_reason?: string | null
          recommendation_summary?: string | null
          removal_group_id?: string | null
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          safety_intake_id?: string | null
          same_day_prior_visit_id?: string | null
          second_visit_reason?: string | null
          service_delivered?: string | null
          sign_in_request_id?: string | null
          sign_in_source?: string | null
          sign_in_time?: string
          sign_out_time?: string | null
          signed_out_by_staff_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          treatment_completed_at?: string | null
          treatment_completed_by?: string | null
          treatment_completion_notes?: string | null
          treatment_outcome?: string | null
          treatment_plan_confirmed_at?: string | null
          treatment_plan_confirmed_by?: string | null
          treatment_plan_decision?: string | null
          treatment_started_at?: string | null
          treatment_started_by?: string | null
          updated_at?: string
          visit_date?: string
          visit_type?: string | null
        }
        Update: {
          amended_at?: string | null
          amended_by?: string | null
          amendment_reason?: string | null
          appointment_id?: string | null
          assigned_medical_expert_id?: string | null
          attributed_to_user_id?: string | null
          claimed_at?: string | null
          claimed_by_staff_id?: string | null
          client_id?: string
          consultation_only_reason?: string | null
          created_at?: string
          discount_applied_at?: string | null
          discount_applied_by?: string | null
          duration_minutes?: number | null
          final_total?: number | null
          follow_up_decision?: string | null
          follow_up_required?: boolean | null
          id?: string
          logged_by_staff_id?: string | null
          manual_discount_amount?: number | null
          manual_discount_reason?: string | null
          manual_discount_type?: string | null
          manual_discount_value?: number | null
          next_appointment_recommended?: boolean | null
          notes?: string | null
          outcome?: Database["public"]["Enums"]["visit_outcome"]
          payment_state?: string | null
          promo_code_applied?: string | null
          promo_discount_amount?: number | null
          promo_discount_pct?: number | null
          promo_staff_user_id?: string | null
          reason_for_visit?: Database["public"]["Enums"]["visit_reason"]
          reassignment_at?: string | null
          reassignment_by_staff_id?: string | null
          reassignment_reason?: string | null
          recommendation_summary?: string | null
          removal_group_id?: string | null
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          safety_intake_id?: string | null
          same_day_prior_visit_id?: string | null
          second_visit_reason?: string | null
          service_delivered?: string | null
          sign_in_request_id?: string | null
          sign_in_source?: string | null
          sign_in_time?: string
          sign_out_time?: string | null
          signed_out_by_staff_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          treatment_completed_at?: string | null
          treatment_completed_by?: string | null
          treatment_completion_notes?: string | null
          treatment_outcome?: string | null
          treatment_plan_confirmed_at?: string | null
          treatment_plan_confirmed_by?: string | null
          treatment_plan_decision?: string | null
          treatment_started_at?: string | null
          treatment_started_by?: string | null
          updated_at?: string
          visit_date?: string
          visit_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_visit_logs_promo_staff_user_id_fkey"
            columns: ["promo_staff_user_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "client_visit_logs_promo_staff_user_id_fkey"
            columns: ["promo_staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "client_visit_logs_promo_staff_user_id_fkey"
            columns: ["promo_staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_visit_logs_same_day_prior_visit_id_fkey"
            columns: ["same_day_prior_visit_id"]
            isOneToOne: false
            referencedRelation: "client_visit_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_visit_logs_same_day_prior_visit_id_fkey"
            columns: ["same_day_prior_visit_id"]
            isOneToOne: false
            referencedRelation: "client_visit_reconciliation_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "client_visit_logs_same_day_prior_visit_id_fkey"
            columns: ["same_day_prior_visit_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "client_visit_logs_same_day_prior_visit_id_fkey"
            columns: ["same_day_prior_visit_id"]
            isOneToOne: false
            referencedRelation: "visit_totals_v"
            referencedColumns: ["visit_id"]
          },
        ]
      }
      clients: {
        Row: {
          acquisition_locked: boolean
          acquisition_owner_id: string | null
          age_group: string | null
          archived: boolean
          archived_at: string | null
          archived_by: string | null
          attributed_staff_id: string | null
          captured_via: string | null
          client_code: string
          consent_captured_at: string | null
          consent_given_at: string | null
          consent_status: string
          consultation_owner_id: string | null
          created_at: string
          dob: string | null
          email: string | null
          first_seen_at: string | null
          full_name: string
          gender: string | null
          id: string
          intake_source: string | null
          intake_source_other: string | null
          is_demo: boolean
          last_contact_date: string | null
          last_interaction_at: string | null
          location: string | null
          marketing_consent: boolean
          media_purge_error: string | null
          media_purge_status: string | null
          media_purged_at: string | null
          membership_type: Database["public"]["Enums"]["membership_type"]
          normalized_phone: string | null
          notes: string | null
          origin_org_id: string | null
          origin_role: string | null
          origin_user_id: string | null
          original_source: string | null
          outreach_id: string | null
          phone: string | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"]
          recurring_owner_id: string | null
          referral_meta: Json
          skin_analysis: Json | null
          source_type: string | null
          status: Database["public"]["Enums"]["client_status"]
          tier_since: string | null
          treatment_plan: Json | null
          updated_at: string
        }
        Insert: {
          acquisition_locked?: boolean
          acquisition_owner_id?: string | null
          age_group?: string | null
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          attributed_staff_id?: string | null
          captured_via?: string | null
          client_code?: string
          consent_captured_at?: string | null
          consent_given_at?: string | null
          consent_status?: string
          consultation_owner_id?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          first_seen_at?: string | null
          full_name: string
          gender?: string | null
          id?: string
          intake_source?: string | null
          intake_source_other?: string | null
          is_demo?: boolean
          last_contact_date?: string | null
          last_interaction_at?: string | null
          location?: string | null
          marketing_consent?: boolean
          media_purge_error?: string | null
          media_purge_status?: string | null
          media_purged_at?: string | null
          membership_type?: Database["public"]["Enums"]["membership_type"]
          normalized_phone?: string | null
          notes?: string | null
          origin_org_id?: string | null
          origin_role?: string | null
          origin_user_id?: string | null
          original_source?: string | null
          outreach_id?: string | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          recurring_owner_id?: string | null
          referral_meta?: Json
          skin_analysis?: Json | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tier_since?: string | null
          treatment_plan?: Json | null
          updated_at?: string
        }
        Update: {
          acquisition_locked?: boolean
          acquisition_owner_id?: string | null
          age_group?: string | null
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          attributed_staff_id?: string | null
          captured_via?: string | null
          client_code?: string
          consent_captured_at?: string | null
          consent_given_at?: string | null
          consent_status?: string
          consultation_owner_id?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          first_seen_at?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          intake_source?: string | null
          intake_source_other?: string | null
          is_demo?: boolean
          last_contact_date?: string | null
          last_interaction_at?: string | null
          location?: string | null
          marketing_consent?: boolean
          media_purge_error?: string | null
          media_purge_status?: string | null
          media_purged_at?: string | null
          membership_type?: Database["public"]["Enums"]["membership_type"]
          normalized_phone?: string | null
          notes?: string | null
          origin_org_id?: string | null
          origin_role?: string | null
          origin_user_id?: string | null
          original_source?: string | null
          outreach_id?: string | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          recurring_owner_id?: string | null
          referral_meta?: Json
          skin_analysis?: Json | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tier_since?: string | null
          treatment_plan?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_acquisition_owner_id_fkey"
            columns: ["acquisition_owner_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "clients_acquisition_owner_id_fkey"
            columns: ["acquisition_owner_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "clients_acquisition_owner_id_fkey"
            columns: ["acquisition_owner_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "clients_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "clients_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_consultation_owner_id_fkey"
            columns: ["consultation_owner_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "clients_consultation_owner_id_fkey"
            columns: ["consultation_owner_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "clients_consultation_owner_id_fkey"
            columns: ["consultation_owner_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_origin_org_id_fkey"
            columns: ["origin_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "outreach_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_recurring_owner_id_fkey"
            columns: ["recurring_owner_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "clients_recurring_owner_id_fkey"
            columns: ["recurring_owner_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "clients_recurring_owner_id_fkey"
            columns: ["recurring_owner_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payouts: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          period_end: string
          period_start: string
          staff_user_id: string
          total_owed: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          period_end: string
          period_start: string
          staff_user_id: string
          total_owed?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          period_end?: string
          period_start?: string
          staff_user_id?: string
          total_owed?: number
          updated_at?: string
        }
        Relationships: []
      }
      commission_rules: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          name: string
          notes: string | null
          percent: number
          scope: string
          scope_ref_id: string | null
          scope_ref_text: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          name: string
          notes?: string | null
          percent?: number
          scope?: string
          scope_ref_id?: string | null
          scope_ref_text?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          name?: string
          notes?: string | null
          percent?: number
          scope?: string
          scope_ref_id?: string | null
          scope_ref_text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      commission_settings: {
        Row: {
          commission_basis: string
          enabled: boolean
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          commission_basis?: string
          enabled?: boolean
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          commission_basis?: string
          enabled?: boolean
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      consultation_tokens: {
        Row: {
          appointment_id: string | null
          client_id: string
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          client_id: string
          created_at?: string
          expires_at?: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          client_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_tokens_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_tokens_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["next_appointment_id"]
          },
          {
            foreignKeyName: "consultation_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "consultation_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "consultation_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "consultation_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
        ]
      }
      content_objectives: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          period: string
          progress: number
          staff_user_id: string
          target: number
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          period?: string
          progress?: number
          staff_user_id: string
          target?: number
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          period?: string
          progress?: number
          staff_user_id?: string
          target?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_objectives_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "content_objectives_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "content_objectives_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_objectives_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "content_objectives_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "content_objectives_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_ops_snapshots: {
        Row: {
          generated_at: string
          id: string
          metrics: Json
          snapshot_date: string
          staff_user_id: string | null
        }
        Insert: {
          generated_at?: string
          id?: string
          metrics: Json
          snapshot_date: string
          staff_user_id?: string | null
        }
        Update: {
          generated_at?: string
          id?: string
          metrics?: Json
          snapshot_date?: string
          staff_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_ops_snapshots_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "daily_ops_snapshots_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "daily_ops_snapshots_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_outcomes: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          expected_cost: number | null
          expected_impact: string | null
          expected_revenue: number | null
          id: string
          notes: string | null
          outcome_date: string
          priority: string
          skip_reason: string | null
          skipped_at: string | null
          sort_order: number
          staff_user_id: string
          status: Database["public"]["Enums"]["routine_status"]
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          expected_cost?: number | null
          expected_impact?: string | null
          expected_revenue?: number | null
          id?: string
          notes?: string | null
          outcome_date?: string
          priority?: string
          skip_reason?: string | null
          skipped_at?: string | null
          sort_order?: number
          staff_user_id: string
          status?: Database["public"]["Enums"]["routine_status"]
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          expected_cost?: number | null
          expected_impact?: string | null
          expected_revenue?: number | null
          id?: string
          notes?: string | null
          outcome_date?: string
          priority?: string
          skip_reason?: string | null
          skipped_at?: string | null
          sort_order?: number
          staff_user_id?: string
          status?: Database["public"]["Enums"]["routine_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_outcomes_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "daily_outcomes_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "daily_outcomes_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      deduction_rules: {
        Row: {
          active: boolean
          applies_ref: string | null
          applies_to: string
          bucket_label: string | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          kind: string
          method: string
          name: string
          notes: string | null
          priority: number
          updated_at: string
          value: number
        }
        Insert: {
          active?: boolean
          applies_ref?: string | null
          applies_to?: string
          bucket_label?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          kind?: string
          method?: string
          name: string
          notes?: string | null
          priority?: number
          updated_at?: string
          value?: number
        }
        Update: {
          active?: boolean
          applies_ref?: string | null
          applies_to?: string
          bucket_label?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          kind?: string
          method?: string
          name?: string
          notes?: string | null
          priority?: number
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      deliverables: {
        Row: {
          blocker: string | null
          category: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_cost: number | null
          estimated_revenue: number | null
          expected_outcome: string | null
          id: string
          outcome_required: string | null
          owner_name: string | null
          owner_role: string | null
          owner_staff_id: string | null
          priority: Database["public"]["Enums"]["deliverable_priority"]
          proof_uploaded_at: string | null
          proof_url: string | null
          skip_reason: string | null
          skipped_at: string | null
          status: Database["public"]["Enums"]["deliverable_status"]
          title: string
          updated_at: string
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
          week_of: string
        }
        Insert: {
          blocker?: string | null
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          estimated_revenue?: number | null
          expected_outcome?: string | null
          id?: string
          outcome_required?: string | null
          owner_name?: string | null
          owner_role?: string | null
          owner_staff_id?: string | null
          priority?: Database["public"]["Enums"]["deliverable_priority"]
          proof_uploaded_at?: string | null
          proof_url?: string | null
          skip_reason?: string | null
          skipped_at?: string | null
          status?: Database["public"]["Enums"]["deliverable_status"]
          title: string
          updated_at?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
          week_of?: string
        }
        Update: {
          blocker?: string | null
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          estimated_revenue?: number | null
          expected_outcome?: string | null
          id?: string
          outcome_required?: string | null
          owner_name?: string | null
          owner_role?: string | null
          owner_staff_id?: string | null
          priority?: Database["public"]["Enums"]["deliverable_priority"]
          proof_uploaded_at?: string | null
          proof_url?: string | null
          skip_reason?: string | null
          skipped_at?: string | null
          status?: Database["public"]["Enums"]["deliverable_status"]
          title?: string
          updated_at?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "deliverables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "deliverables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_owner_staff_id_fkey"
            columns: ["owner_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "deliverables_owner_staff_id_fkey"
            columns: ["owner_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "deliverables_owner_staff_id_fkey"
            columns: ["owner_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "deliverables_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "deliverables_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      distribution_run_items: {
        Row: {
          created_at: string
          id: string
          loss_reason: string | null
          product_id: string
          qty_lost: number | null
          qty_out: number
          qty_returned: number | null
          qty_sold: number | null
          run_id: string
          unit_cost_at_time: number
          unit_price_at_time: number
        }
        Insert: {
          created_at?: string
          id?: string
          loss_reason?: string | null
          product_id: string
          qty_lost?: number | null
          qty_out?: number
          qty_returned?: number | null
          qty_sold?: number | null
          run_id: string
          unit_cost_at_time?: number
          unit_price_at_time?: number
        }
        Update: {
          created_at?: string
          id?: string
          loss_reason?: string | null
          product_id?: string
          qty_lost?: number | null
          qty_out?: number
          qty_returned?: number | null
          qty_sold?: number | null
          run_id?: string
          unit_cost_at_time?: number
          unit_price_at_time?: number
        }
        Relationships: [
          {
            foreignKeyName: "distribution_run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "distribution_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_run_snapshots: {
        Row: {
          id: string
          image_path: string | null
          run_id: string
          saved_at: string
          saved_by: string | null
          state: Json
        }
        Insert: {
          id?: string
          image_path?: string | null
          run_id: string
          saved_at?: string
          saved_by?: string | null
          state: Json
        }
        Update: {
          id?: string
          image_path?: string | null
          run_id?: string
          saved_at?: string
          saved_by?: string | null
          state?: Json
        }
        Relationships: [
          {
            foreignKeyName: "distribution_run_snapshots_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "distribution_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_runs: {
        Row: {
          created_at: string
          created_by: string | null
          event_date: string
          id: string
          location: string | null
          name: string
          notes: string | null
          outreach_id: string | null
          reconciled_at: string | null
          reconciled_by: string | null
          responsible_staff_id: string | null
          snapshot_url: string | null
          status: string
          total_loss_value: number
          total_revenue: number
          total_value_out: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_date?: string
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          outreach_id?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          responsible_staff_id?: string | null
          snapshot_url?: string | null
          status?: string
          total_loss_value?: number
          total_revenue?: number
          total_value_out?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_date?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          outreach_id?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          responsible_staff_id?: string | null
          snapshot_url?: string | null
          status?: string
          total_loss_value?: number
          total_revenue?: number
          total_value_out?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribution_runs_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "outreach_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_deliveries: {
        Row: {
          channel: string
          client_id: string
          created_at: string
          error_message: string | null
          id: string
          media_id: string
          phone_number: string | null
          provider_reference: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          channel?: string
          client_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          media_id: string
          phone_number?: string | null
          provider_reference?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          client_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          media_id?: string
          phone_number?: string | null
          provider_reference?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
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
      eod_reports: {
        Row: {
          completed: string | null
          created_at: string
          id: string
          issues: string | null
          notes: string | null
          pending: string | null
          report_date: string
          skipped: string | null
          staff_user_id: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          completed?: string | null
          created_at?: string
          id?: string
          issues?: string | null
          notes?: string | null
          pending?: string | null
          report_date?: string
          skipped?: string | null
          staff_user_id: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          completed?: string | null
          created_at?: string
          id?: string
          issues?: string | null
          notes?: string | null
          pending?: string | null
          report_date?: string
          skipped?: string | null
          staff_user_id?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eod_reports_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "eod_reports_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "eod_reports_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invitations: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          event_id: string
          id: string
          responded_at: string | null
          response_status: string
          token_hash: string
          token_prefix: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          responded_at?: string | null
          response_status?: string
          token_hash: string
          token_prefix: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          responded_at?: string | null
          response_status?: string
          token_hash?: string
          token_prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "event_invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "event_invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "event_invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "event_invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          active: boolean
          code: string
          created_at: string
          default_department_id: string | null
          group_name: string
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          default_department_id?: string | null
          group_name?: string
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          default_department_id?: string | null
          group_name?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_default_department_id_fkey"
            columns: ["default_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_default_department_id_fkey"
            columns: ["default_department_id"]
            isOneToOne: false
            referencedRelation: "expenses_attributed"
            referencedColumns: ["department_id"]
          },
        ]
      }
      finance_entries: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          attributed_staff_id: string | null
          capital_source_name: string | null
          capital_source_type: string | null
          category: string
          cogs_for_entry_id: string | null
          created_at: string
          date: string
          department_id: string | null
          expense_category_id: string | null
          float_status: string | null
          id: string
          inventory_batch_id: string | null
          kind: string
          notes: string | null
          operation_kind: string | null
          operation_ref_id: string | null
          outreach_id: string | null
          paid_to_staff_id: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string
          product_id: string | null
          quantity: number | null
          receipt_url: string | null
          reconciliation_group_id: string | null
          reconciliation_metadata: Json
          revenue_attribution_id: string | null
          signout_request_id: string | null
          source_client_id: string | null
          staff_user_id: string
          status: string
          supersedes_entry_id: string | null
          transaction_intent: string | null
          visit_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          attributed_staff_id?: string | null
          capital_source_name?: string | null
          capital_source_type?: string | null
          category: string
          cogs_for_entry_id?: string | null
          created_at?: string
          date?: string
          department_id?: string | null
          expense_category_id?: string | null
          float_status?: string | null
          id?: string
          inventory_batch_id?: string | null
          kind: string
          notes?: string | null
          operation_kind?: string | null
          operation_ref_id?: string | null
          outreach_id?: string | null
          paid_to_staff_id?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          product_id?: string | null
          quantity?: number | null
          receipt_url?: string | null
          reconciliation_group_id?: string | null
          reconciliation_metadata?: Json
          revenue_attribution_id?: string | null
          signout_request_id?: string | null
          source_client_id?: string | null
          staff_user_id: string
          status?: string
          supersedes_entry_id?: string | null
          transaction_intent?: string | null
          visit_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          attributed_staff_id?: string | null
          capital_source_name?: string | null
          capital_source_type?: string | null
          category?: string
          cogs_for_entry_id?: string | null
          created_at?: string
          date?: string
          department_id?: string | null
          expense_category_id?: string | null
          float_status?: string | null
          id?: string
          inventory_batch_id?: string | null
          kind?: string
          notes?: string | null
          operation_kind?: string | null
          operation_ref_id?: string | null
          outreach_id?: string | null
          paid_to_staff_id?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          product_id?: string | null
          quantity?: number | null
          receipt_url?: string | null
          reconciliation_group_id?: string | null
          reconciliation_metadata?: Json
          revenue_attribution_id?: string | null
          signout_request_id?: string | null
          source_client_id?: string | null
          staff_user_id?: string
          status?: string
          supersedes_entry_id?: string | null
          transaction_intent?: string | null
          visit_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "finance_entries_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "finance_entries_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_cogs_for_entry_id_fkey"
            columns: ["cogs_for_entry_id"]
            isOneToOne: false
            referencedRelation: "expenses_attributed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_cogs_for_entry_id_fkey"
            columns: ["cogs_for_entry_id"]
            isOneToOne: false
            referencedRelation: "finance_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_cogs_for_entry_id_fkey"
            columns: ["cogs_for_entry_id"]
            isOneToOne: false
            referencedRelation: "suspicious_finance_duplicates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "expenses_attributed"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "finance_entries_expense_category_id_fkey"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_expense_category_id_fkey"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "expenses_attributed"
            referencedColumns: ["expense_category_id"]
          },
          {
            foreignKeyName: "finance_entries_inventory_batch_id_fkey"
            columns: ["inventory_batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "outreach_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_paid_to_staff_id_fkey"
            columns: ["paid_to_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "finance_entries_paid_to_staff_id_fkey"
            columns: ["paid_to_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "finance_entries_paid_to_staff_id_fkey"
            columns: ["paid_to_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "finance_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "finance_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_revenue_attribution_id_fkey"
            columns: ["revenue_attribution_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "finance_entries_revenue_attribution_id_fkey"
            columns: ["revenue_attribution_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "finance_entries_revenue_attribution_id_fkey"
            columns: ["revenue_attribution_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_source_client_id_fkey"
            columns: ["source_client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "finance_entries_source_client_id_fkey"
            columns: ["source_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_source_client_id_fkey"
            columns: ["source_client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "finance_entries_source_client_id_fkey"
            columns: ["source_client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "finance_entries_source_client_id_fkey"
            columns: ["source_client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "finance_entries_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "finance_entries_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "finance_entries_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_supersedes_entry_id_fkey"
            columns: ["supersedes_entry_id"]
            isOneToOne: false
            referencedRelation: "expenses_attributed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_supersedes_entry_id_fkey"
            columns: ["supersedes_entry_id"]
            isOneToOne: false
            referencedRelation: "finance_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_supersedes_entry_id_fkey"
            columns: ["supersedes_entry_id"]
            isOneToOne: false
            referencedRelation: "suspicious_finance_duplicates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "client_visit_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "client_visit_reconciliation_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "finance_entries_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "finance_entries_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_totals_v"
            referencedColumns: ["visit_id"]
          },
        ]
      }
      finance_entry_history: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          changed_fields: string[] | null
          entry_id: string
          id: string
          impact_summary: Json | null
          new_row: Json | null
          old_row: Json
          reason: string | null
          related_entry_ids: string[] | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          entry_id: string
          id?: string
          impact_summary?: Json | null
          new_row?: Json | null
          old_row: Json
          reason?: string | null
          related_entry_ids?: string[] | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          entry_id?: string
          id?: string
          impact_summary?: Json | null
          new_row?: Json | null
          old_row?: Json
          reason?: string | null
          related_entry_ids?: string[] | null
        }
        Relationships: []
      }
      finished_goods_intake_items: {
        Row: {
          created_at: string
          estimated_unit_cost: number
          expected_quantity_ordered: number
          id: string
          intake_id: string
          notes: string | null
          product_id: string
          quantity_received_total: number
          selling_price_snapshot: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          estimated_unit_cost?: number
          expected_quantity_ordered?: number
          id?: string
          intake_id: string
          notes?: string | null
          product_id: string
          quantity_received_total?: number
          selling_price_snapshot?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          estimated_unit_cost?: number
          expected_quantity_ordered?: number
          id?: string
          intake_id?: string
          notes?: string | null
          product_id?: string
          quantity_received_total?: number
          selling_price_snapshot?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finished_goods_intake_items_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "finished_goods_intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_intake_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "finished_goods_intake_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "finished_goods_intake_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      finished_goods_intake_receipts: {
        Row: {
          id: string
          intake_id: string
          intake_item_id: string
          inventory_batch_id: string | null
          notes: string | null
          product_id: string
          quantity_received: number
          received_at: string
          received_by: string | null
          unit_cost_used: number
        }
        Insert: {
          id?: string
          intake_id: string
          intake_item_id: string
          inventory_batch_id?: string | null
          notes?: string | null
          product_id: string
          quantity_received: number
          received_at?: string
          received_by?: string | null
          unit_cost_used: number
        }
        Update: {
          id?: string
          intake_id?: string
          intake_item_id?: string
          inventory_batch_id?: string | null
          notes?: string | null
          product_id?: string
          quantity_received?: number
          received_at?: string
          received_by?: string | null
          unit_cost_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "finished_goods_intake_receipts_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "finished_goods_intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_intake_receipts_intake_item_id_fkey"
            columns: ["intake_item_id"]
            isOneToOne: false
            referencedRelation: "finished_goods_intake_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_intake_receipts_inventory_batch_id_fkey"
            columns: ["inventory_batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_intake_receipts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "finished_goods_intake_receipts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "finished_goods_intake_receipts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      finished_goods_intakes: {
        Row: {
          auto_finance_entry_id: string | null
          capital_source: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          finance_already_recorded: boolean
          id: string
          intake_date: string
          intake_name: string
          linked_finance_entry_id: string | null
          notes: string | null
          status: string
          total_capital_invested: number | null
          updated_at: string
        }
        Insert: {
          auto_finance_entry_id?: string | null
          capital_source?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          finance_already_recorded?: boolean
          id?: string
          intake_date?: string
          intake_name: string
          linked_finance_entry_id?: string | null
          notes?: string | null
          status?: string
          total_capital_invested?: number | null
          updated_at?: string
        }
        Update: {
          auto_finance_entry_id?: string | null
          capital_source?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          finance_already_recorded?: boolean
          id?: string
          intake_date?: string
          intake_name?: string
          linked_finance_entry_id?: string | null
          notes?: string | null
          status?: string
          total_capital_invested?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finished_goods_intakes_auto_finance_entry_id_fkey"
            columns: ["auto_finance_entry_id"]
            isOneToOne: false
            referencedRelation: "expenses_attributed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_intakes_auto_finance_entry_id_fkey"
            columns: ["auto_finance_entry_id"]
            isOneToOne: false
            referencedRelation: "finance_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_intakes_auto_finance_entry_id_fkey"
            columns: ["auto_finance_entry_id"]
            isOneToOne: false
            referencedRelation: "suspicious_finance_duplicates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_intakes_linked_finance_entry_id_fkey"
            columns: ["linked_finance_entry_id"]
            isOneToOne: false
            referencedRelation: "expenses_attributed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_intakes_linked_finance_entry_id_fkey"
            columns: ["linked_finance_entry_id"]
            isOneToOne: false
            referencedRelation: "finance_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_intakes_linked_finance_entry_id_fkey"
            columns: ["linked_finance_entry_id"]
            isOneToOne: false
            referencedRelation: "suspicious_finance_duplicates"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_submissions: {
        Row: {
          age_group: string | null
          attributed_staff_id: string | null
          client_id: string | null
          consent_given: boolean
          created_at: string
          email: string | null
          full_name: string
          gender: string | null
          id: string
          intake_source: string
          intake_source_other: string | null
          ip_hash: string | null
          phone: string | null
          user_agent: string | null
        }
        Insert: {
          age_group?: string | null
          attributed_staff_id?: string | null
          client_id?: string | null
          consent_given?: boolean
          created_at?: string
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          intake_source: string
          intake_source_other?: string | null
          ip_hash?: string | null
          phone?: string | null
          user_agent?: string | null
        }
        Update: {
          age_group?: string | null
          attributed_staff_id?: string | null
          client_id?: string | null
          consent_given?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          intake_source?: string
          intake_source_other?: string | null
          ip_hash?: string | null
          phone?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_submissions_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "intake_submissions_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "intake_submissions_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "intake_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "intake_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "intake_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
        ]
      }
      inventory_batches: {
        Row: {
          cost_per_unit: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          product_cost_id: string | null
          product_id: string
          production_date: string
          quantity_produced: number
          quantity_remaining: number
          recipe_version_id: string | null
          source_intake_id: string | null
          source_kind: string
          total_batch_cost: number | null
        }
        Insert: {
          cost_per_unit: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_cost_id?: string | null
          product_id: string
          production_date?: string
          quantity_produced: number
          quantity_remaining: number
          recipe_version_id?: string | null
          source_intake_id?: string | null
          source_kind?: string
          total_batch_cost?: number | null
        }
        Update: {
          cost_per_unit?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_cost_id?: string | null
          product_id?: string
          production_date?: string
          quantity_produced?: number
          quantity_remaining?: number
          recipe_version_id?: string | null
          source_intake_id?: string | null
          source_kind?: string
          total_batch_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_product_cost_id_fkey"
            columns: ["product_cost_id"]
            isOneToOne: false
            referencedRelation: "product_costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "recipe_version_costs"
            referencedColumns: ["recipe_version_id"]
          },
          {
            foreignKeyName: "inventory_batches_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "recipe_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_corrections: {
        Row: {
          batch_id: string | null
          correction_type: string
          created_at: string
          created_by: string | null
          finance_entry_id: string | null
          id: string
          intake_id: string | null
          new_values: Json
          old_values: Json
          product_id: string | null
          quantity_delta: number | null
          reason: string
          value_delta: number | null
        }
        Insert: {
          batch_id?: string | null
          correction_type: string
          created_at?: string
          created_by?: string | null
          finance_entry_id?: string | null
          id?: string
          intake_id?: string | null
          new_values?: Json
          old_values?: Json
          product_id?: string | null
          quantity_delta?: number | null
          reason: string
          value_delta?: number | null
        }
        Update: {
          batch_id?: string | null
          correction_type?: string
          created_at?: string
          created_by?: string | null
          finance_entry_id?: string | null
          id?: string
          intake_id?: string | null
          new_values?: Json
          old_values?: Json
          product_id?: string | null
          quantity_delta?: number | null
          reason?: string
          value_delta?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_corrections_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_corrections_finance_entry_id_fkey"
            columns: ["finance_entry_id"]
            isOneToOne: false
            referencedRelation: "expenses_attributed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_corrections_finance_entry_id_fkey"
            columns: ["finance_entry_id"]
            isOneToOne: false
            referencedRelation: "finance_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_corrections_finance_entry_id_fkey"
            columns: ["finance_entry_id"]
            isOneToOne: false
            referencedRelation: "suspicious_finance_duplicates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_corrections_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "finished_goods_intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_corrections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_corrections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_corrections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_events: {
        Row: {
          client_id: string | null
          consumption_status: string
          created_at: string
          created_by: string | null
          event_type: string
          funding_source: string
          id: string
          idempotency_key: string
          is_complimentary: boolean
          occurred_at: string
          payload: Json
          quantity: number
          schedule_item_id: string | null
          service_id: string | null
          source_id: string | null
          source_type: string
          treatment_plan_id: string | null
          treatment_plan_session_id: string | null
          visit_id: string | null
        }
        Insert: {
          client_id?: string | null
          consumption_status?: string
          created_at?: string
          created_by?: string | null
          event_type: string
          funding_source: string
          id?: string
          idempotency_key: string
          is_complimentary?: boolean
          occurred_at?: string
          payload?: Json
          quantity?: number
          schedule_item_id?: string | null
          service_id?: string | null
          source_id?: string | null
          source_type: string
          treatment_plan_id?: string | null
          treatment_plan_session_id?: string | null
          visit_id?: string | null
        }
        Update: {
          client_id?: string | null
          consumption_status?: string
          created_at?: string
          created_by?: string | null
          event_type?: string
          funding_source?: string
          id?: string
          idempotency_key?: string
          is_complimentary?: boolean
          occurred_at?: string
          payload?: Json
          quantity?: number
          schedule_item_id?: string | null
          service_id?: string | null
          source_id?: string | null
          source_type?: string
          treatment_plan_id?: string | null
          treatment_plan_session_id?: string | null
          visit_id?: string | null
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          active: boolean
          category: Database["public"]["Enums"]["inventory_category"]
          created_at: string
          created_by: string | null
          current_stock: number
          id: string
          name: string
          notes: string | null
          reorder_point: number
          retail_price: number
          sku: string | null
          supplier: string | null
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: Database["public"]["Enums"]["inventory_category"]
          created_at?: string
          created_by?: string | null
          current_stock?: number
          id?: string
          name: string
          notes?: string | null
          reorder_point?: number
          retail_price?: number
          sku?: string | null
          supplier?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["inventory_category"]
          created_at?: string
          created_by?: string | null
          current_stock?: number
          id?: string
          name?: string
          notes?: string | null
          reorder_point?: number
          retail_price?: number
          sku?: string | null
          supplier?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          item_id: string
          kind: Database["public"]["Enums"]["inventory_movement_kind"]
          notes: string | null
          occurred_at: string
          qty: number
          reference_id: string | null
          reference_type: string | null
          staff_user_id: string | null
          unit_cost_at_time: number | null
          unit_price_at_time: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          item_id: string
          kind: Database["public"]["Enums"]["inventory_movement_kind"]
          notes?: string | null
          occurred_at?: string
          qty: number
          reference_id?: string | null
          reference_type?: string | null
          staff_user_id?: string | null
          unit_cost_at_time?: number | null
          unit_price_at_time?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          item_id?: string
          kind?: Database["public"]["Enums"]["inventory_movement_kind"]
          notes?: string | null
          occurred_at?: string
          qty?: number
          reference_id?: string | null
          reference_type?: string | null
          staff_user_id?: string | null
          unit_cost_at_time?: number | null
          unit_price_at_time?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_usage_estimates"
            referencedColumns: ["item_id"]
          },
        ]
      }
      job_roles: {
        Row: {
          active: boolean
          content_objective_templates: Json
          created_at: string
          department: string | null
          description: string | null
          id: string
          legacy_role: string | null
          objective_targets: Json
          permissions: Json
          reporting_fields: Json
          routine_steps: Json
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          content_objective_templates?: Json
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          legacy_role?: string | null
          objective_targets?: Json
          permissions?: Json
          reporting_fields?: Json
          routine_steps?: Json
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          content_objective_templates?: Json
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          legacy_role?: string | null
          objective_targets?: Json
          permissions?: Json
          reporting_fields?: Json
          routine_steps?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_interactions: {
        Row: {
          client_id: string
          created_at: string
          id: string
          method: string
          next_action_date: string | null
          notes: string | null
          occurred_at: string
          outcome: string
          outreach_id: string | null
          staff_user_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          method: string
          next_action_date?: string | null
          notes?: string | null
          occurred_at?: string
          outcome: string
          outreach_id?: string | null
          staff_user_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          method?: string
          next_action_date?: string | null
          notes?: string | null
          occurred_at?: string
          outcome?: string
          outreach_id?: string | null
          staff_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "lead_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "lead_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "lead_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "lead_interactions_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "outreach_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_interactions_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "lead_interactions_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "lead_interactions_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_journey_events: {
        Row: {
          by_staff_id: string | null
          client_id: string
          created_at: string
          id: string
          note: string | null
          occurred_at: string
          status: string
        }
        Insert: {
          by_staff_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          note?: string | null
          occurred_at?: string
          status: string
        }
        Update: {
          by_staff_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          note?: string | null
          occurred_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_journey_events_by_staff_id_fkey"
            columns: ["by_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "lead_journey_events_by_staff_id_fkey"
            columns: ["by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "lead_journey_events_by_staff_id_fkey"
            columns: ["by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_journey_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "lead_journey_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_journey_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "lead_journey_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "lead_journey_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
        ]
      }
      member_benefit_usage: {
        Row: {
          benefit_label: string | null
          benefit_type: string
          client_id: string
          created_at: string
          granted_by: string | null
          id: string
          notes: string | null
          period_year_month: string
          updated_at: string
          used_on: string
        }
        Insert: {
          benefit_label?: string | null
          benefit_type: string
          client_id: string
          created_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          period_year_month?: string
          updated_at?: string
          used_on?: string
        }
        Update: {
          benefit_label?: string | null
          benefit_type?: string
          client_id?: string
          created_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          period_year_month?: string
          updated_at?: string
          used_on?: string
        }
        Relationships: []
      }
      membership_benefit_allowances: {
        Row: {
          active: boolean
          benefit_label: string
          benefit_type: string
          created_at: string
          id: string
          monthly_limit: number
          tier: Database["public"]["Enums"]["membership_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          benefit_label: string
          benefit_type: string
          created_at?: string
          id?: string
          monthly_limit?: number
          tier: Database["public"]["Enums"]["membership_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          benefit_label?: string
          benefit_type?: string
          created_at?: string
          id?: string
          monthly_limit?: number
          tier?: Database["public"]["Enums"]["membership_type"]
          updated_at?: string
        }
        Relationships: []
      }
      membership_events: {
        Row: {
          client_id: string
          created_at: string
          event_type: string
          from_tier: Database["public"]["Enums"]["membership_type"] | null
          id: string
          metadata: Json | null
          reason: string | null
          to_tier: Database["public"]["Enums"]["membership_type"] | null
          triggered_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          event_type: string
          from_tier?: Database["public"]["Enums"]["membership_type"] | null
          id?: string
          metadata?: Json | null
          reason?: string | null
          to_tier?: Database["public"]["Enums"]["membership_type"] | null
          triggered_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          event_type?: string
          from_tier?: Database["public"]["Enums"]["membership_type"] | null
          id?: string
          metadata?: Json | null
          reason?: string | null
          to_tier?: Database["public"]["Enums"]["membership_type"] | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      notification_recipients: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          id: string
          notification_id: string
          read_at: string | null
          recipient_user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          notification_id: string
          read_at?: string | null
          recipient_user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          notification_id?: string
          read_at?: string | null
          recipient_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_recipients_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_replies: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          kind: string
          notification_id: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          kind?: string
          notification_id: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          kind?: string
          notification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_replies_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_user_id: string | null
          body: string | null
          category: string
          created_at: string
          id: string
          kind: string
          metadata: Json
          severity: string
          subject_user_id: string | null
          target_id: string | null
          target_table: string | null
          title: string
        }
        Insert: {
          actor_user_id?: string | null
          body?: string | null
          category: string
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          severity?: string
          subject_user_id?: string | null
          target_id?: string | null
          target_table?: string | null
          title: string
        }
        Update: {
          actor_user_id?: string | null
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          severity?: string
          subject_user_id?: string | null
          target_id?: string | null
          target_table?: string | null
          title?: string
        }
        Relationships: []
      }
      operational_event_links: {
        Row: {
          created_at: string
          event_id: string
          id: string
          metadata: Json
          role: string
          target_id: string
          target_table: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          metadata?: Json
          role: string
          target_id: string
          target_table: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          metadata?: Json
          role?: string
          target_id?: string
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_event_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "operational_events"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_events: {
        Row: {
          actor_id: string | null
          appointment_id: string | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          committed_at: string | null
          complimentary_value: number
          created_at: string
          delivery_address: Json | null
          discount_value: number
          event_no: string | null
          id: string
          idempotency_key: string | null
          impersonated_by: string | null
          kind: Database["public"]["Enums"]["operational_event_kind"]
          new_money_received: number
          notes: string | null
          occurred_at: string
          order_group_id: string | null
          outstanding: number
          parent_event_id: string | null
          payload: Json
          payment_claim_id: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_state: string | null
          prior_credit_used: number
          receipt_no: string | null
          reconciliation_state: Database["public"]["Enums"]["operational_reconciliation_state"]
          recorded_at: string
          source_ui: string | null
          standard_value: number
          status: Database["public"]["Enums"]["operational_event_status"]
          stock_cost: number
          treatment_plan_id: string | null
          updated_at: string
          visit_id: string | null
          warnings: Json
        }
        Insert: {
          actor_id?: string | null
          appointment_id?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          committed_at?: string | null
          complimentary_value?: number
          created_at?: string
          delivery_address?: Json | null
          discount_value?: number
          event_no?: string | null
          id?: string
          idempotency_key?: string | null
          impersonated_by?: string | null
          kind: Database["public"]["Enums"]["operational_event_kind"]
          new_money_received?: number
          notes?: string | null
          occurred_at?: string
          order_group_id?: string | null
          outstanding?: number
          parent_event_id?: string | null
          payload?: Json
          payment_claim_id?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_state?: string | null
          prior_credit_used?: number
          receipt_no?: string | null
          reconciliation_state?: Database["public"]["Enums"]["operational_reconciliation_state"]
          recorded_at?: string
          source_ui?: string | null
          standard_value?: number
          status?: Database["public"]["Enums"]["operational_event_status"]
          stock_cost?: number
          treatment_plan_id?: string | null
          updated_at?: string
          visit_id?: string | null
          warnings?: Json
        }
        Update: {
          actor_id?: string | null
          appointment_id?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          committed_at?: string | null
          complimentary_value?: number
          created_at?: string
          delivery_address?: Json | null
          discount_value?: number
          event_no?: string | null
          id?: string
          idempotency_key?: string | null
          impersonated_by?: string | null
          kind?: Database["public"]["Enums"]["operational_event_kind"]
          new_money_received?: number
          notes?: string | null
          occurred_at?: string
          order_group_id?: string | null
          outstanding?: number
          parent_event_id?: string | null
          payload?: Json
          payment_claim_id?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_state?: string | null
          prior_credit_used?: number
          receipt_no?: string | null
          reconciliation_state?: Database["public"]["Enums"]["operational_reconciliation_state"]
          recorded_at?: string
          source_ui?: string | null
          standard_value?: number
          status?: Database["public"]["Enums"]["operational_event_status"]
          stock_cost?: number
          treatment_plan_id?: string | null
          updated_at?: string
          visit_id?: string | null
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "operational_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "operational_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "operational_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "operational_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "operational_events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "operational_events"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          member_role: string
          organization_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_role?: string
          organization_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_role?: string
          organization_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_product_prices: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          currency: string
          id: string
          organization_id: string
          price: number
          product_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          organization_id: string
          price: number
          product_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          organization_id?: string
          price?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_product_prices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "organization_product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "organization_product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          cdp_fee_amount_paid: number | null
          cdp_fee_paid_at: string | null
          cdp_fee_reference: string | null
          cdp_fee_status: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          location: string | null
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          cdp_fee_amount_paid?: number | null
          cdp_fee_paid_at?: string | null
          cdp_fee_reference?: string | null
          cdp_fee_status?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          location?: string | null
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          cdp_fee_amount_paid?: number | null
          cdp_fee_paid_at?: string | null
          cdp_fee_reference?: string | null
          cdp_fee_status?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          location?: string | null
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      outreach_assigned_staff: {
        Row: {
          created_at: string
          id: string
          outreach_id: string
          reward_share_percent: number
          role_in_outreach: string
          staff_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          outreach_id: string
          reward_share_percent?: number
          role_in_outreach?: string
          staff_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          outreach_id?: string
          reward_share_percent?: number
          role_in_outreach?: string
          staff_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_assigned_staff_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "outreach_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_assigned_staff_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "outreach_assigned_staff_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "outreach_assigned_staff_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_logs: {
        Row: {
          clicked_at: string
          client_id: string
          created_at: string
          id: string
          message_text: string
          phone_number: string | null
          sent_at: string | null
          staff_user_id: string | null
          status: string
          template_category: string | null
          template_id: string | null
        }
        Insert: {
          clicked_at?: string
          client_id: string
          created_at?: string
          id?: string
          message_text: string
          phone_number?: string | null
          sent_at?: string | null
          staff_user_id?: string | null
          status?: string
          template_category?: string | null
          template_id?: string | null
        }
        Update: {
          clicked_at?: string
          client_id?: string
          created_at?: string
          id?: string
          message_text?: string
          phone_number?: string | null
          sent_at?: string | null
          staff_user_id?: string | null
          status?: string
          template_category?: string | null
          template_id?: string | null
        }
        Relationships: []
      }
      outreach_reconciliation_lines: {
        Row: {
          allocated_qty: number
          created_at: string
          damaged_qty: number
          id: string
          missing_qty: number
          notes: string | null
          outreach_id: string
          product_id: string
          returned_qty: number
          updated_at: string
        }
        Insert: {
          allocated_qty?: number
          created_at?: string
          damaged_qty?: number
          id?: string
          missing_qty?: number
          notes?: string | null
          outreach_id: string
          product_id: string
          returned_qty?: number
          updated_at?: string
        }
        Update: {
          allocated_qty?: number
          created_at?: string
          damaged_qty?: number
          id?: string
          missing_qty?: number
          notes?: string | null
          outreach_id?: string
          product_id?: string
          returned_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_reconciliation_lines_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "outreach_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_reconciliation_state: {
        Row: {
          attendance_signed_off: boolean
          created_at: string
          expenses_signed_off: boolean
          follow_ups_pending: number | null
          leads_signed_off: boolean
          lessons_learned: string | null
          outcomes_signed_off: boolean
          outreach_id: string
          products_signed_off: boolean
          sales_signed_off: boolean
          signed_off_at: string | null
          signed_off_by_user_id: string | null
          updated_at: string
        }
        Insert: {
          attendance_signed_off?: boolean
          created_at?: string
          expenses_signed_off?: boolean
          follow_ups_pending?: number | null
          leads_signed_off?: boolean
          lessons_learned?: string | null
          outcomes_signed_off?: boolean
          outreach_id: string
          products_signed_off?: boolean
          sales_signed_off?: boolean
          signed_off_at?: string | null
          signed_off_by_user_id?: string | null
          updated_at?: string
        }
        Update: {
          attendance_signed_off?: boolean
          created_at?: string
          expenses_signed_off?: boolean
          follow_ups_pending?: number | null
          leads_signed_off?: boolean
          lessons_learned?: string | null
          outcomes_signed_off?: boolean
          outreach_id?: string
          products_signed_off?: boolean
          sales_signed_off?: boolean
          signed_off_at?: string | null
          signed_off_by_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_reconciliation_state_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: true
            referencedRelation: "outreach_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_rewards: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          basis_amount: number
          beneficiary_staff_id: string
          created_at: string
          finance_entry_id: string | null
          id: string
          notes: string | null
          outreach_id: string
          percent: number
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          basis_amount: number
          beneficiary_staff_id: string
          created_at?: string
          finance_entry_id?: string | null
          id?: string
          notes?: string | null
          outreach_id: string
          percent: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          basis_amount?: number
          beneficiary_staff_id?: string
          created_at?: string
          finance_entry_id?: string | null
          id?: string
          notes?: string | null
          outreach_id?: string
          percent?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_rewards_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "outreach_rewards_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "outreach_rewards_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_rewards_beneficiary_staff_id_fkey"
            columns: ["beneficiary_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "outreach_rewards_beneficiary_staff_id_fkey"
            columns: ["beneficiary_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "outreach_rewards_beneficiary_staff_id_fkey"
            columns: ["beneficiary_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_rewards_finance_entry_id_fkey"
            columns: ["finance_entry_id"]
            isOneToOne: false
            referencedRelation: "expenses_attributed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_rewards_finance_entry_id_fkey"
            columns: ["finance_entry_id"]
            isOneToOne: false
            referencedRelation: "finance_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_rewards_finance_entry_id_fkey"
            columns: ["finance_entry_id"]
            isOneToOne: false
            referencedRelation: "suspicious_finance_duplicates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_rewards_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "outreach_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_sessions: {
        Row: {
          approval_notes: string | null
          approved_at: string | null
          approved_by_user_id: string | null
          capture_lead_user_id: string | null
          closed_at: string | null
          closed_by_user_id: string | null
          closer_user_id: string | null
          completed_at: string | null
          coordinator_user_id: string | null
          created_at: string
          created_by: string | null
          end_time: string | null
          equipment_list: string[] | null
          estimated_budget: number | null
          expected_analyses: number | null
          expected_attendance: number | null
          expected_bookings: number | null
          expected_leads: number | null
          expected_sales: number | null
          follow_up_owner_user_id: string | null
          id: string
          initiator_staff_id: string | null
          intake_slug: string | null
          location: string | null
          logistics_user_id: string | null
          materials_list: string[] | null
          name: string
          net_profit: number
          notes: string | null
          objective: string | null
          outreach_date: string
          outreach_type: string
          product_handler_user_id: string | null
          public_intake_enabled: boolean
          reconciled_at: string | null
          reconciled_by: string | null
          resources_not_required: boolean
          reward_amount: number
          skin_analyst_user_id: string | null
          start_time: string | null
          started_at: string | null
          status: string
          submitted_at: string | null
          submitted_by_user_id: string | null
          total_cogs: number
          total_leads: number
          total_op_expense: number
          total_revenue: number
          updated_at: string
          venue_contact_name: string | null
          venue_contact_phone: string | null
        }
        Insert: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by_user_id?: string | null
          capture_lead_user_id?: string | null
          closed_at?: string | null
          closed_by_user_id?: string | null
          closer_user_id?: string | null
          completed_at?: string | null
          coordinator_user_id?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          equipment_list?: string[] | null
          estimated_budget?: number | null
          expected_analyses?: number | null
          expected_attendance?: number | null
          expected_bookings?: number | null
          expected_leads?: number | null
          expected_sales?: number | null
          follow_up_owner_user_id?: string | null
          id?: string
          initiator_staff_id?: string | null
          intake_slug?: string | null
          location?: string | null
          logistics_user_id?: string | null
          materials_list?: string[] | null
          name: string
          net_profit?: number
          notes?: string | null
          objective?: string | null
          outreach_date?: string
          outreach_type?: string
          product_handler_user_id?: string | null
          public_intake_enabled?: boolean
          reconciled_at?: string | null
          reconciled_by?: string | null
          resources_not_required?: boolean
          reward_amount?: number
          skin_analyst_user_id?: string | null
          start_time?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by_user_id?: string | null
          total_cogs?: number
          total_leads?: number
          total_op_expense?: number
          total_revenue?: number
          updated_at?: string
          venue_contact_name?: string | null
          venue_contact_phone?: string | null
        }
        Update: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by_user_id?: string | null
          capture_lead_user_id?: string | null
          closed_at?: string | null
          closed_by_user_id?: string | null
          closer_user_id?: string | null
          completed_at?: string | null
          coordinator_user_id?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          equipment_list?: string[] | null
          estimated_budget?: number | null
          expected_analyses?: number | null
          expected_attendance?: number | null
          expected_bookings?: number | null
          expected_leads?: number | null
          expected_sales?: number | null
          follow_up_owner_user_id?: string | null
          id?: string
          initiator_staff_id?: string | null
          intake_slug?: string | null
          location?: string | null
          logistics_user_id?: string | null
          materials_list?: string[] | null
          name?: string
          net_profit?: number
          notes?: string | null
          objective?: string | null
          outreach_date?: string
          outreach_type?: string
          product_handler_user_id?: string | null
          public_intake_enabled?: boolean
          reconciled_at?: string | null
          reconciled_by?: string | null
          resources_not_required?: boolean
          reward_amount?: number
          skin_analyst_user_id?: string | null
          start_time?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by_user_id?: string | null
          total_cogs?: number
          total_leads?: number
          total_op_expense?: number
          total_revenue?: number
          updated_at?: string
          venue_contact_name?: string | null
          venue_contact_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "outreach_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "outreach_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_sessions_initiator_staff_id_fkey"
            columns: ["initiator_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "outreach_sessions_initiator_staff_id_fkey"
            columns: ["initiator_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "outreach_sessions_initiator_staff_id_fkey"
            columns: ["initiator_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_sessions_reconciled_by_fkey"
            columns: ["reconciled_by"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "outreach_sessions_reconciled_by_fkey"
            columns: ["reconciled_by"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "outreach_sessions_reconciled_by_fkey"
            columns: ["reconciled_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_settings: {
        Row: {
          address: string
          business_whatsapp_number: string
          consultation_duration_minutes: number
          id: boolean
          instagram_handle: string
          tiktok_handle: string
          updated_at: string
          updated_by: string | null
          website_url: string
          whatsapp_client_initiated_body: string
          whatsapp_template_body: string
        }
        Insert: {
          address?: string
          business_whatsapp_number?: string
          consultation_duration_minutes?: number
          id?: boolean
          instagram_handle?: string
          tiktok_handle?: string
          updated_at?: string
          updated_by?: string | null
          website_url?: string
          whatsapp_client_initiated_body?: string
          whatsapp_template_body?: string
        }
        Update: {
          address?: string
          business_whatsapp_number?: string
          consultation_duration_minutes?: number
          id?: boolean
          instagram_handle?: string
          tiktok_handle?: string
          updated_at?: string
          updated_by?: string | null
          website_url?: string
          whatsapp_client_initiated_body?: string
          whatsapp_template_body?: string
        }
        Relationships: []
      }
      outreach_sheet_rows: {
        Row: {
          created_at: string
          id: string
          product_name: string
          qty_sold: number
          sheet_id: string
          sort_order: number
          unit_cost: number
          unit_price: number
          units: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_name?: string
          qty_sold?: number
          sheet_id: string
          sort_order?: number
          unit_cost?: number
          unit_price?: number
          units?: number
        }
        Update: {
          created_at?: string
          id?: string
          product_name?: string
          qty_sold?: number
          sheet_id?: string
          sort_order?: number
          unit_cost?: number
          unit_price?: number
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "outreach_sheet_rows_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "outreach_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_sheets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          sheet_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          sheet_date?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          sheet_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      outreach_templates: {
        Row: {
          active: boolean
          body: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_name: string | null
          id: boolean
          instructions_markdown: string
          updated_at: string
          updated_by: string | null
          whatsapp_number: string | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          id?: boolean
          instructions_markdown?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          id?: boolean
          instructions_markdown?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "payment_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "payment_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_outreach_orders: {
        Row: {
          affiliate_payout_amount: number | null
          affiliate_payout_base: number | null
          affiliate_payout_status: string | null
          affiliate_split_percentage: number | null
          affiliate_user_id: string | null
          attributed_staff_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          customer_client_id: string | null
          customer_name: string | null
          customer_phone: string
          delivery_address: string | null
          delivery_fee: number
          delivery_method: string | null
          delivery_settings_snapshot: Json | null
          formula_snapshot_id: string | null
          formula_summary: Json | null
          fulfilment_org_id: string | null
          id: string
          notes: string | null
          order_ref: string | null
          origin_org_id: string | null
          origin_role: string | null
          origin_user_id: string | null
          outreach_id: string | null
          payment_method: string | null
          payment_reference: string | null
          price_snapshot: Json | null
          product_id: string
          promo_code: string | null
          promo_discount_amount: number | null
          promo_discount_pct: number | null
          promo_staff_id: string | null
          quantity: number
          report_link_id: string | null
          report_payment_claim_id: string | null
          resulting_finance_entry_id: string | null
          status: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          affiliate_payout_amount?: number | null
          affiliate_payout_base?: number | null
          affiliate_payout_status?: string | null
          affiliate_split_percentage?: number | null
          affiliate_user_id?: string | null
          attributed_staff_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_client_id?: string | null
          customer_name?: string | null
          customer_phone: string
          delivery_address?: string | null
          delivery_fee?: number
          delivery_method?: string | null
          delivery_settings_snapshot?: Json | null
          formula_snapshot_id?: string | null
          formula_summary?: Json | null
          fulfilment_org_id?: string | null
          id?: string
          notes?: string | null
          order_ref?: string | null
          origin_org_id?: string | null
          origin_role?: string | null
          origin_user_id?: string | null
          outreach_id?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          price_snapshot?: Json | null
          product_id: string
          promo_code?: string | null
          promo_discount_amount?: number | null
          promo_discount_pct?: number | null
          promo_staff_id?: string | null
          quantity: number
          report_link_id?: string | null
          report_payment_claim_id?: string | null
          resulting_finance_entry_id?: string | null
          status?: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          affiliate_payout_amount?: number | null
          affiliate_payout_base?: number | null
          affiliate_payout_status?: string | null
          affiliate_split_percentage?: number | null
          affiliate_user_id?: string | null
          attributed_staff_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_client_id?: string | null
          customer_name?: string | null
          customer_phone?: string
          delivery_address?: string | null
          delivery_fee?: number
          delivery_method?: string | null
          delivery_settings_snapshot?: Json | null
          formula_snapshot_id?: string | null
          formula_summary?: Json | null
          fulfilment_org_id?: string | null
          id?: string
          notes?: string | null
          order_ref?: string | null
          origin_org_id?: string | null
          origin_role?: string | null
          origin_user_id?: string | null
          outreach_id?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          price_snapshot?: Json | null
          product_id?: string
          promo_code?: string | null
          promo_discount_amount?: number | null
          promo_discount_pct?: number | null
          promo_staff_id?: string | null
          quantity?: number
          report_link_id?: string | null
          report_payment_claim_id?: string | null
          resulting_finance_entry_id?: string | null
          status?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_outreach_orders_customer_client_id_fkey"
            columns: ["customer_client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "pending_outreach_orders_customer_client_id_fkey"
            columns: ["customer_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_outreach_orders_customer_client_id_fkey"
            columns: ["customer_client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "pending_outreach_orders_customer_client_id_fkey"
            columns: ["customer_client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "pending_outreach_orders_customer_client_id_fkey"
            columns: ["customer_client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "pending_outreach_orders_formula_snapshot_id_fkey"
            columns: ["formula_snapshot_id"]
            isOneToOne: false
            referencedRelation: "xcape_formula_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_outreach_orders_fulfilment_org_id_fkey"
            columns: ["fulfilment_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_outreach_orders_origin_org_id_fkey"
            columns: ["origin_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_outreach_orders_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "outreach_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_outreach_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "pending_outreach_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "pending_outreach_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_outreach_orders_promo_staff_id_fkey"
            columns: ["promo_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "pending_outreach_orders_promo_staff_id_fkey"
            columns: ["promo_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "pending_outreach_orders_promo_staff_id_fkey"
            columns: ["promo_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_outreach_orders_report_link_id_fkey"
            columns: ["report_link_id"]
            isOneToOne: false
            referencedRelation: "client_report_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_outreach_orders_report_link_id_fkey"
            columns: ["report_link_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["report_link_id"]
          },
          {
            foreignKeyName: "pending_outreach_orders_report_payment_claim_id_fkey"
            columns: ["report_payment_claim_id"]
            isOneToOne: false
            referencedRelation: "xcape_report_payment_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_items: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          notes: string | null
          procurement_session_id: string
          quantity_received: number
          total_cost: number | null
          unit_cost: number
          unit_of_measure: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          notes?: string | null
          procurement_session_id: string
          quantity_received: number
          total_cost?: number | null
          unit_cost: number
          unit_of_measure?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          notes?: string | null
          procurement_session_id?: string
          quantity_received?: number
          total_cost?: number | null
          unit_cost?: number
          unit_of_measure?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procurement_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_usage_estimates"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "procurement_items_procurement_session_id_fkey"
            columns: ["procurement_session_id"]
            isOneToOne: false
            referencedRelation: "procurement_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_overheads: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          notes: string | null
          procurement_session_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          notes?: string | null
          procurement_session_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          notes?: string | null
          procurement_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_overheads_procurement_session_id_fkey"
            columns: ["procurement_session_id"]
            isOneToOne: false
            referencedRelation: "procurement_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          procurement_date: string
          received_at: string | null
          received_by: string | null
          status: string
          supplier_name: string
          supplier_notes: string | null
          supplier_phone: string | null
          total_misc_cost: number
          total_procurement_cost: number
          total_raw_cost: number
          total_transport_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          procurement_date?: string
          received_at?: string | null
          received_by?: string | null
          status?: string
          supplier_name: string
          supplier_notes?: string | null
          supplier_phone?: string | null
          total_misc_cost?: number
          total_procurement_cost?: number
          total_raw_cost?: number
          total_transport_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          procurement_date?: string
          received_at?: string | null
          received_by?: string | null
          status?: string
          supplier_name?: string
          supplier_notes?: string | null
          supplier_phone?: string | null
          total_misc_cost?: number
          total_procurement_cost?: number
          total_raw_cost?: number
          total_transport_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_costs: {
        Row: {
          batch_quantity: number
          cost_per_unit: number | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          operations_cost: number
          packaging_cost: number
          product_id: string
          raw_material_cost: number
          total_cost: number | null
        }
        Insert: {
          batch_quantity: number
          cost_per_unit?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          operations_cost?: number
          packaging_cost?: number
          product_id: string
          raw_material_cost?: number
          total_cost?: number | null
        }
        Update: {
          batch_quantity?: number
          cost_per_unit?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          operations_cost?: number
          packaging_cost?: number
          product_id?: string
          raw_material_cost?: number
          total_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_movements: {
        Row: {
          batch_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["product_movement_kind"]
          notes: string | null
          occurred_at: string
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          staff_user_id: string | null
          unit_cost: number | null
          unit_price: number | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["product_movement_kind"]
          notes?: string | null
          occurred_at?: string
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          staff_user_id?: string | null
          unit_cost?: number | null
          unit_price?: number | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["product_movement_kind"]
          notes?: string | null
          occurred_at?: string
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          staff_user_id?: string | null
          unit_cost?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_personalization_requests: {
        Row: {
          answers: Json
          client_id: string | null
          consent_given: boolean
          created_at: string
          email: string | null
          full_name: string
          handled_at: string | null
          handled_by: string | null
          id: string
          page_path: string | null
          phone: string
          preferred_contact: string
          source: string
          staff_notes: string | null
          status: string
          submission_key: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          answers?: Json
          client_id?: string | null
          consent_given?: boolean
          created_at?: string
          email?: string | null
          full_name: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          page_path?: string | null
          phone: string
          preferred_contact?: string
          source?: string
          staff_notes?: string | null
          status?: string
          submission_key?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          answers?: Json
          client_id?: string | null
          consent_given?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          page_path?: string | null
          phone?: string
          preferred_contact?: string
          source?: string
          staff_notes?: string | null
          status?: string
          submission_key?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_personalization_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "product_personalization_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_personalization_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "product_personalization_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "product_personalization_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "product_personalization_requests_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "product_personalization_requests_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "product_personalization_requests_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          benefits: string[]
          care_guidance: string | null
          category: string
          created_at: string
          description: string | null
          display_order: number
          faq: Json
          featured: boolean
          frequency_of_use: string | null
          gallery_urls: string[]
          hero_badge: string | null
          id: string
          image_url: string | null
          ingredients_summary: string | null
          inventory_tracking_enabled: boolean
          long_description: string | null
          market_price: number | null
          min_price_threshold: number | null
          name: string
          promo_price: number | null
          public_slug: string | null
          public_visible: boolean
          reorder_threshold: number | null
          secondary_image_url: string | null
          selling_price: number
          short_description: string | null
          size_label: string | null
          skin_concerns: string[]
          sku: string | null
          stock_status: string | null
          suitable_for: string | null
          tagline: string | null
          thumbnail_url: string | null
          unit_of_measure: string | null
          updated_at: string
          usage_instructions: string | null
          warnings: string | null
        }
        Insert: {
          active?: boolean
          benefits?: string[]
          care_guidance?: string | null
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          faq?: Json
          featured?: boolean
          frequency_of_use?: string | null
          gallery_urls?: string[]
          hero_badge?: string | null
          id?: string
          image_url?: string | null
          ingredients_summary?: string | null
          inventory_tracking_enabled?: boolean
          long_description?: string | null
          market_price?: number | null
          min_price_threshold?: number | null
          name: string
          promo_price?: number | null
          public_slug?: string | null
          public_visible?: boolean
          reorder_threshold?: number | null
          secondary_image_url?: string | null
          selling_price?: number
          short_description?: string | null
          size_label?: string | null
          skin_concerns?: string[]
          sku?: string | null
          stock_status?: string | null
          suitable_for?: string | null
          tagline?: string | null
          thumbnail_url?: string | null
          unit_of_measure?: string | null
          updated_at?: string
          usage_instructions?: string | null
          warnings?: string | null
        }
        Update: {
          active?: boolean
          benefits?: string[]
          care_guidance?: string | null
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          faq?: Json
          featured?: boolean
          frequency_of_use?: string | null
          gallery_urls?: string[]
          hero_badge?: string | null
          id?: string
          image_url?: string | null
          ingredients_summary?: string | null
          inventory_tracking_enabled?: boolean
          long_description?: string | null
          market_price?: number | null
          min_price_threshold?: number | null
          name?: string
          promo_price?: number | null
          public_slug?: string | null
          public_visible?: boolean
          reorder_threshold?: number | null
          secondary_image_url?: string | null
          selling_price?: number
          short_description?: string | null
          size_label?: string | null
          skin_concerns?: string[]
          sku?: string | null
          stock_status?: string | null
          suitable_for?: string | null
          tagline?: string | null
          thumbnail_url?: string | null
          unit_of_measure?: string | null
          updated_at?: string
          usage_instructions?: string | null
          warnings?: string | null
        }
        Relationships: []
      }
      promo_code_redemptions: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          created_at: string
          discount_amount: number | null
          discount_pct_applied: number | null
          gross_amount: number | null
          id: string
          net_amount: number | null
          notes: string | null
          promo_code_snapshot: string
          redeemed_at: string
          redeemed_by_user_id: string | null
          source: string
          staff_user_id: string | null
          updated_at: string
          visit_line_item_id: string | null
          visit_log_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          discount_amount?: number | null
          discount_pct_applied?: number | null
          gross_amount?: number | null
          id?: string
          net_amount?: number | null
          notes?: string | null
          promo_code_snapshot: string
          redeemed_at?: string
          redeemed_by_user_id?: string | null
          source: string
          staff_user_id?: string | null
          updated_at?: string
          visit_line_item_id?: string | null
          visit_log_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          discount_amount?: number | null
          discount_pct_applied?: number | null
          gross_amount?: number | null
          id?: string
          net_amount?: number | null
          notes?: string | null
          promo_code_snapshot?: string
          redeemed_at?: string
          redeemed_by_user_id?: string | null
          source?: string
          staff_user_id?: string | null
          updated_at?: string
          visit_line_item_id?: string | null
          visit_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_redemptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["next_appointment_id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_visit_line_item_id_fkey"
            columns: ["visit_line_item_id"]
            isOneToOne: false
            referencedRelation: "visit_delivered_billable_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_visit_line_item_id_fkey"
            columns: ["visit_line_item_id"]
            isOneToOne: false
            referencedRelation: "visit_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_visit_log_id_fkey"
            columns: ["visit_log_id"]
            isOneToOne: false
            referencedRelation: "client_visit_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_visit_log_id_fkey"
            columns: ["visit_log_id"]
            isOneToOne: false
            referencedRelation: "client_visit_reconciliation_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_visit_log_id_fkey"
            columns: ["visit_log_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_visit_log_id_fkey"
            columns: ["visit_log_id"]
            isOneToOne: false
            referencedRelation: "visit_totals_v"
            referencedColumns: ["visit_id"]
          },
        ]
      }
      public_analysis_consents: {
        Row: {
          consent_type: string
          created_at: string
          evidence: Json
          granted: boolean
          granted_at: string
          id: string
          ip_hmac: string | null
          session_id: string
        }
        Insert: {
          consent_type: string
          created_at?: string
          evidence?: Json
          granted: boolean
          granted_at?: string
          id?: string
          ip_hmac?: string | null
          session_id: string
        }
        Update: {
          consent_type?: string
          created_at?: string
          evidence?: Json
          granted?: boolean
          granted_at?: string
          id?: string
          ip_hmac?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_analysis_consents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "public_analysis_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      public_analysis_sessions: {
        Row: {
          ai_raw: Json | null
          ai_raw_purge_at: string | null
          analysis_attempts: number
          analysis_completed_at: string | null
          analysis_started_at: string | null
          assessment_id: string | null
          attempt_count: number
          capture_method: string | null
          client_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_channel: string | null
          engine: Json | null
          engine_version: string | null
          expires_at: string
          failure_code: string | null
          id: string
          idempotency_key: string | null
          image_paths: Json
          images_purge_at: string | null
          ip_hmac: string | null
          phase: string | null
          prompt_version: string | null
          purge_at: string
          status: string
          token_hash: string
          ua_hmac: string | null
          updated_at: string
          views_captured: Json
          views_issued: Json
          worker_heartbeat_at: string | null
          worker_lease: string | null
        }
        Insert: {
          ai_raw?: Json | null
          ai_raw_purge_at?: string | null
          analysis_attempts?: number
          analysis_completed_at?: string | null
          analysis_started_at?: string | null
          assessment_id?: string | null
          attempt_count?: number
          capture_method?: string | null
          client_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_channel?: string | null
          engine?: Json | null
          engine_version?: string | null
          expires_at: string
          failure_code?: string | null
          id?: string
          idempotency_key?: string | null
          image_paths?: Json
          images_purge_at?: string | null
          ip_hmac?: string | null
          phase?: string | null
          prompt_version?: string | null
          purge_at: string
          status?: string
          token_hash: string
          ua_hmac?: string | null
          updated_at?: string
          views_captured?: Json
          views_issued?: Json
          worker_heartbeat_at?: string | null
          worker_lease?: string | null
        }
        Update: {
          ai_raw?: Json | null
          ai_raw_purge_at?: string | null
          analysis_attempts?: number
          analysis_completed_at?: string | null
          analysis_started_at?: string | null
          assessment_id?: string | null
          attempt_count?: number
          capture_method?: string | null
          client_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_channel?: string | null
          engine?: Json | null
          engine_version?: string | null
          expires_at?: string
          failure_code?: string | null
          id?: string
          idempotency_key?: string | null
          image_paths?: Json
          images_purge_at?: string | null
          ip_hmac?: string | null
          phase?: string | null
          prompt_version?: string | null
          purge_at?: string
          status?: string
          token_hash?: string
          ua_hmac?: string | null
          updated_at?: string
          views_captured?: Json
          views_issued?: Json
          worker_heartbeat_at?: string | null
          worker_lease?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_analysis_sessions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "client_visit_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_analysis_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "public_analysis_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_analysis_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "public_analysis_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "public_analysis_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          quantity: number
          recipe_version_id: string
          unit: string | null
          unit_cost_snapshot: number
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          quantity: number
          recipe_version_id: string
          unit?: string | null
          unit_cost_snapshot?: number
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          quantity?: number
          recipe_version_id?: string
          unit?: string | null
          unit_cost_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_usage_estimates"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "recipe_version_costs"
            referencedColumns: ["recipe_version_id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "recipe_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_overheads: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          label: string | null
          recipe_version_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          recipe_version_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          recipe_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_overheads_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "recipe_version_costs"
            referencedColumns: ["recipe_version_id"]
          },
          {
            foreignKeyName: "recipe_overheads_recipe_version_id_fkey"
            columns: ["recipe_version_id"]
            isOneToOne: false
            referencedRelation: "recipe_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_versions: {
        Row: {
          activated_at: string | null
          batch_quantity: number
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          notes: string | null
          product_id: string
          status: string
          updated_at: string
          version_number: number
          wastage_percent: number
        }
        Insert: {
          activated_at?: string | null
          batch_quantity?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          product_id: string
          status?: string
          updated_at?: string
          version_number: number
          wastage_percent?: number
        }
        Update: {
          activated_at?: string | null
          batch_quantity?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          product_id?: string
          status?: string
          updated_at?: string
          version_number?: number
          wastage_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "recipe_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "recipe_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_visits: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          ip_hash: string | null
          landed_path: string | null
          slug: string
          staff_user_id: string | null
          user_agent: string | null
          utm: Json
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          landed_path?: string | null
          slug: string
          staff_user_id?: string | null
          user_agent?: string | null
          utm?: Json
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          landed_path?: string | null
          slug?: string
          staff_user_id?: string | null
          user_agent?: string | null
          utm?: Json
        }
        Relationships: [
          {
            foreignKeyName: "referral_visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "referral_visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "referral_visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "referral_visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "referral_visits_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "referral_visits_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "referral_visits_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      report_notes: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          range_end: string
          range_key: string
          range_start: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          range_end: string
          range_key: string
          range_start: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          range_end?: string
          range_key?: string
          range_start?: string
          updated_at?: string
        }
        Relationships: []
      }
      revenue_allocations: {
        Row: {
          amount: number
          basis_amount: number
          beneficiary_kind: string
          beneficiary_staff_id: string | null
          bucket_label: string | null
          computed_at: string
          finance_entry_id: string
          gross_amount: number
          id: string
          reverse_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          rule_id: string | null
          rule_kind: string
          rule_name: string
          status: string
        }
        Insert: {
          amount?: number
          basis_amount?: number
          beneficiary_kind: string
          beneficiary_staff_id?: string | null
          bucket_label?: string | null
          computed_at?: string
          finance_entry_id: string
          gross_amount?: number
          id?: string
          reverse_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          rule_id?: string | null
          rule_kind: string
          rule_name: string
          status?: string
        }
        Update: {
          amount?: number
          basis_amount?: number
          beneficiary_kind?: string
          beneficiary_staff_id?: string | null
          bucket_label?: string | null
          computed_at?: string
          finance_entry_id?: string
          gross_amount?: number
          id?: string
          reverse_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          rule_id?: string | null
          rule_kind?: string
          rule_name?: string
          status?: string
        }
        Relationships: []
      }
      routine_instances: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          routine_date: string
          skip_reason: string | null
          skipped_at: string | null
          staff_user_id: string
          status: Database["public"]["Enums"]["routine_status"]
          template_id: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          routine_date?: string
          skip_reason?: string | null
          skipped_at?: string | null
          staff_user_id: string
          status?: Database["public"]["Enums"]["routine_status"]
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          routine_date?: string
          skip_reason?: string | null
          skipped_at?: string | null
          staff_user_id?: string
          status?: Database["public"]["Enums"]["routine_status"]
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_instances_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "routine_instances_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "routine_instances_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "routine_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_templates: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          job_role_id: string | null
          role: string | null
          staff_user_id: string | null
          step_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          job_role_id?: string | null
          role?: string | null
          staff_user_id?: string | null
          step_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          job_role_id?: string | null
          role?: string | null
          staff_user_id?: string | null
          step_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_addon_links: {
        Row: {
          addon_service_id: string
          core_service_id: string
          created_at: string
          id: string
          price_override: number | null
          sort_order: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          addon_service_id: string
          core_service_id: string
          created_at?: string
          id?: string
          price_override?: number | null
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          addon_service_id?: string
          core_service_id?: string
          created_at?: string
          id?: string
          price_override?: number | null
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "service_addon_links_addon_service_id_fkey"
            columns: ["addon_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_addon_links_core_service_id_fkey"
            columns: ["core_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_bundle_items: {
        Row: {
          bundle_service_id: string
          component_service_id: string
          created_at: string
          display_note: string | null
          id: string
          quantity: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          bundle_service_id: string
          component_service_id: string
          created_at?: string
          display_note?: string | null
          id?: string
          quantity?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bundle_service_id?: string
          component_service_id?: string
          created_at?: string
          display_note?: string | null
          id?: string
          quantity?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_bundle_items_bundle_service_id_fkey"
            columns: ["bundle_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_bundle_items_component_service_id_fkey"
            columns: ["component_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          active: boolean
          concerns: Json | null
          created_at: string
          description: string | null
          discount_enabled: boolean
          discount_end_date: string | null
          discount_label: string | null
          discount_start_date: string | null
          discount_type: string | null
          discount_value: number | null
          faq: Json | null
          hero_image_url: string | null
          id: string
          image_aspect: string | null
          image_format: string | null
          image_url: string | null
          long_description: string | null
          menu_display_mode: string
          name: string
          promo_video_duration_seconds: number | null
          promo_video_url: string | null
          public_slug: string | null
          public_visible: boolean
          sort_order: number
          updated_at: string
          who_its_for: string[] | null
          youtube_url: string | null
        }
        Insert: {
          active?: boolean
          concerns?: Json | null
          created_at?: string
          description?: string | null
          discount_enabled?: boolean
          discount_end_date?: string | null
          discount_label?: string | null
          discount_start_date?: string | null
          discount_type?: string | null
          discount_value?: number | null
          faq?: Json | null
          hero_image_url?: string | null
          id?: string
          image_aspect?: string | null
          image_format?: string | null
          image_url?: string | null
          long_description?: string | null
          menu_display_mode?: string
          name: string
          promo_video_duration_seconds?: number | null
          promo_video_url?: string | null
          public_slug?: string | null
          public_visible?: boolean
          sort_order?: number
          updated_at?: string
          who_its_for?: string[] | null
          youtube_url?: string | null
        }
        Update: {
          active?: boolean
          concerns?: Json | null
          created_at?: string
          description?: string | null
          discount_enabled?: boolean
          discount_end_date?: string | null
          discount_label?: string | null
          discount_start_date?: string | null
          discount_type?: string | null
          discount_value?: number | null
          faq?: Json | null
          hero_image_url?: string | null
          id?: string
          image_aspect?: string | null
          image_format?: string | null
          image_url?: string | null
          long_description?: string | null
          menu_display_mode?: string
          name?: string
          promo_video_duration_seconds?: number | null
          promo_video_url?: string | null
          public_slug?: string | null
          public_visible?: boolean
          sort_order?: number
          updated_at?: string
          who_its_for?: string[] | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      service_experts: {
        Row: {
          created_at: string
          id: string
          service_id: string
          staff_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          service_id: string
          staff_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          service_id?: string
          staff_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_experts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_families: {
        Row: {
          card_image_url: string | null
          category_id: string
          created_at: string
          description: string | null
          featured: boolean
          hero_image_url: string | null
          id: string
          menu_display_mode: string
          name: string
          public_visible: boolean
          slug: string
          sort_order: number
          summary: string | null
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          card_image_url?: string | null
          category_id: string
          created_at?: string
          description?: string | null
          featured?: boolean
          hero_image_url?: string | null
          id?: string
          menu_display_mode?: string
          name: string
          public_visible?: boolean
          slug: string
          sort_order?: number
          summary?: string | null
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          card_image_url?: string | null
          category_id?: string
          created_at?: string
          description?: string | null
          featured?: boolean
          hero_image_url?: string | null
          id?: string
          menu_display_mode?: string
          name?: string
          public_visible?: boolean
          slug?: string
          sort_order?: number
          summary?: string | null
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_families_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      service_inventory_requirements: {
        Row: {
          created_at: string
          id: string
          item_name: string
          quantity_required: number
          service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          quantity_required?: number
          service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          quantity_required?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_inventory_requirements_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          addon_for_program: string | null
          aftercare: string | null
          base_service_id: string | null
          benefits: Json | null
          category_id: string
          created_at: string
          default_sessions: number
          description: string | null
          discount_enabled: boolean
          discount_end_date: string | null
          discount_label: string | null
          discount_start_date: string | null
          discount_type: string | null
          discount_value: number | null
          duration_minutes: number
          family_id: string | null
          faq: Json | null
          featured: boolean
          frequency: string | null
          gallery_urls: string[] | null
          hero_image_url: string | null
          id: string
          image_aspect: string | null
          image_format: string | null
          image_url: string | null
          included_treatments: Json | null
          is_addon: boolean
          is_consultation: boolean
          is_offer: boolean
          long_description: string | null
          menu_role: string
          name: string
          party_type: string
          preparation: string | null
          price_display_mode: string
          price_per_session: number
          program_description: string | null
          program_name: string | null
          promo_video_duration_seconds: number | null
          promo_video_url: string | null
          public_option_label: string | null
          public_slug: string | null
          public_summary: string | null
          public_visible: boolean
          sort_order: number
          suitable_for: Json | null
          updated_at: string
          what_to_expect: string | null
          youtube_url: string | null
        }
        Insert: {
          active?: boolean
          addon_for_program?: string | null
          aftercare?: string | null
          base_service_id?: string | null
          benefits?: Json | null
          category_id: string
          created_at?: string
          default_sessions?: number
          description?: string | null
          discount_enabled?: boolean
          discount_end_date?: string | null
          discount_label?: string | null
          discount_start_date?: string | null
          discount_type?: string | null
          discount_value?: number | null
          duration_minutes?: number
          family_id?: string | null
          faq?: Json | null
          featured?: boolean
          frequency?: string | null
          gallery_urls?: string[] | null
          hero_image_url?: string | null
          id?: string
          image_aspect?: string | null
          image_format?: string | null
          image_url?: string | null
          included_treatments?: Json | null
          is_addon?: boolean
          is_consultation?: boolean
          is_offer?: boolean
          long_description?: string | null
          menu_role?: string
          name: string
          party_type?: string
          preparation?: string | null
          price_display_mode?: string
          price_per_session?: number
          program_description?: string | null
          program_name?: string | null
          promo_video_duration_seconds?: number | null
          promo_video_url?: string | null
          public_option_label?: string | null
          public_slug?: string | null
          public_summary?: string | null
          public_visible?: boolean
          sort_order?: number
          suitable_for?: Json | null
          updated_at?: string
          what_to_expect?: string | null
          youtube_url?: string | null
        }
        Update: {
          active?: boolean
          addon_for_program?: string | null
          aftercare?: string | null
          base_service_id?: string | null
          benefits?: Json | null
          category_id?: string
          created_at?: string
          default_sessions?: number
          description?: string | null
          discount_enabled?: boolean
          discount_end_date?: string | null
          discount_label?: string | null
          discount_start_date?: string | null
          discount_type?: string | null
          discount_value?: number | null
          duration_minutes?: number
          family_id?: string | null
          faq?: Json | null
          featured?: boolean
          frequency?: string | null
          gallery_urls?: string[] | null
          hero_image_url?: string | null
          id?: string
          image_aspect?: string | null
          image_format?: string | null
          image_url?: string | null
          included_treatments?: Json | null
          is_addon?: boolean
          is_consultation?: boolean
          is_offer?: boolean
          long_description?: string | null
          menu_role?: string
          name?: string
          party_type?: string
          preparation?: string | null
          price_display_mode?: string
          price_per_session?: number
          program_description?: string | null
          program_name?: string | null
          promo_video_duration_seconds?: number | null
          promo_video_url?: string | null
          public_option_label?: string | null
          public_slug?: string | null
          public_summary?: string | null
          public_visible?: boolean
          sort_order?: number
          suitable_for?: Json | null
          updated_at?: string
          what_to_expect?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_base_service_id_fkey"
            columns: ["base_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "service_families"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      staff_accountability_events: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          deduction_amount: number
          id: string
          kind: string
          notes: string | null
          occurred_at: string
          points: number
          rule_id: string | null
          source: string
          staff_user_id: string
          waive_reason: string | null
          waived: boolean
          waived_at: string | null
          waived_by: string | null
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deduction_amount?: number
          id?: string
          kind: string
          notes?: string | null
          occurred_at?: string
          points?: number
          rule_id?: string | null
          source?: string
          staff_user_id: string
          waive_reason?: string | null
          waived?: boolean
          waived_at?: string | null
          waived_by?: string | null
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deduction_amount?: number
          id?: string
          kind?: string
          notes?: string | null
          occurred_at?: string
          points?: number
          rule_id?: string | null
          source?: string
          staff_user_id?: string
          waive_reason?: string | null
          waived?: boolean
          waived_at?: string | null
          waived_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_accountability_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "accountability_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_assignments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assigned_by: string | null
          created_at: string
          job_role_id: string | null
          staff_user_id: string
          tab_overrides: Json
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_by?: string | null
          created_at?: string
          job_role_id?: string | null
          staff_user_id: string
          tab_overrides?: Json
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_by?: string | null
          created_at?: string
          job_role_id?: string | null
          staff_user_id?: string
          tab_overrides?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_assignments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "staff_assignments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "staff_assignments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "staff_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "staff_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_assignments_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_assignments_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: true
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "staff_assignments_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: true
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "staff_assignments_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: true
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_attendance_logs: {
        Row: {
          attendance_date: string
          created_at: string
          duration_minutes: number | null
          end_of_day_notes: Json | null
          id: string
          location: string | null
          sign_in_time: string | null
          sign_out_time: string | null
          signed_in_by: string | null
          signed_out_by: string | null
          staff_user_id: string
          start_of_day_notes: Json | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
        }
        Insert: {
          attendance_date?: string
          created_at?: string
          duration_minutes?: number | null
          end_of_day_notes?: Json | null
          id?: string
          location?: string | null
          sign_in_time?: string | null
          sign_out_time?: string | null
          signed_in_by?: string | null
          signed_out_by?: string | null
          staff_user_id: string
          start_of_day_notes?: Json | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          created_at?: string
          duration_minutes?: number | null
          end_of_day_notes?: Json | null
          id?: string
          location?: string | null
          sign_in_time?: string | null
          sign_out_time?: string | null
          signed_in_by?: string | null
          signed_out_by?: string | null
          staff_user_id?: string
          start_of_day_notes?: Json | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Relationships: []
      }
      staff_users: {
        Row: {
          booking_slug: string | null
          calendly_event_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          promo_active: boolean
          promo_code: string | null
          promo_code_updated_at: string | null
          promo_discount_pct: number | null
          status: Database["public"]["Enums"]["staff_status"]
          updated_at: string
        }
        Insert: {
          booking_slug?: string | null
          calendly_event_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          phone?: string | null
          promo_active?: boolean
          promo_code?: string | null
          promo_code_updated_at?: string | null
          promo_discount_pct?: number | null
          status?: Database["public"]["Enums"]["staff_status"]
          updated_at?: string
        }
        Update: {
          booking_slug?: string | null
          calendly_event_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          promo_active?: boolean
          promo_code?: string | null
          promo_code_updated_at?: string | null
          promo_discount_pct?: number | null
          status?: Database["public"]["Enums"]["staff_status"]
          updated_at?: string
        }
        Relationships: []
      }
      subscription_accounts: {
        Row: {
          account_name: string
          account_slug: string
          amount: number
          billing_cycle: string
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          domain_name: string | null
          due_soon_threshold_days: number
          grace_period_end: string | null
          id: string
          last_payment_date: string | null
          next_due_date: string | null
          notes: string | null
          owner_email: string
          payment_reference: string | null
          pilot_rate_note: string | null
          pilot_rate_usd: number | null
          plan_name: string
          plan_price_usd: number
          plan_tier: string
          status: string
          updated_at: string
          updated_by: string | null
          website_url: string | null
        }
        Insert: {
          account_name?: string
          account_slug?: string
          amount?: number
          billing_cycle?: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          domain_name?: string | null
          due_soon_threshold_days?: number
          grace_period_end?: string | null
          id?: string
          last_payment_date?: string | null
          next_due_date?: string | null
          notes?: string | null
          owner_email?: string
          payment_reference?: string | null
          pilot_rate_note?: string | null
          pilot_rate_usd?: number | null
          plan_name?: string
          plan_price_usd?: number
          plan_tier?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          website_url?: string | null
        }
        Update: {
          account_name?: string
          account_slug?: string
          amount?: number
          billing_cycle?: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          domain_name?: string | null
          due_soon_threshold_days?: number
          grace_period_end?: string | null
          id?: string
          last_payment_date?: string | null
          next_due_date?: string | null
          notes?: string | null
          owner_email?: string
          payment_reference?: string | null
          pilot_rate_note?: string | null
          pilot_rate_usd?: number | null
          plan_name?: string
          plan_price_usd?: number
          plan_tier?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      subscription_action_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_status: string | null
          notes: string | null
          performed_by: string | null
          performed_from: string
          previous_status: string | null
          subscription_account_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_status?: string | null
          notes?: string | null
          performed_by?: string | null
          performed_from?: string
          previous_status?: string | null
          subscription_account_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_status?: string | null
          notes?: string | null
          performed_by?: string | null
          performed_from?: string
          previous_status?: string | null
          subscription_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_action_logs_subscription_account_id_fkey"
            columns: ["subscription_account_id"]
            isOneToOne: false
            referencedRelation: "subscription_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_notification_logs: {
        Row: {
          error_message: string | null
          id: string
          notification_type: string
          sent_at: string
          sent_to: string
          status: string
          subject: string | null
          subscription_account_id: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          notification_type: string
          sent_at?: string
          sent_to: string
          status?: string
          subject?: string | null
          subscription_account_id: string
        }
        Update: {
          error_message?: string | null
          id?: string
          notification_type?: string
          sent_at?: string
          sent_to?: string
          status?: string
          subject?: string | null
          subscription_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_notification_logs_subscription_account_id_fkey"
            columns: ["subscription_account_id"]
            isOneToOne: false
            referencedRelation: "subscription_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          currency: string
          id: string
          notes: string | null
          payment_method: string
          payment_reference: string | null
          status: string
          submitted_at: string
          submitted_by: string | null
          subscription_account_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          payment_method?: string
          payment_reference?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          subscription_account_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          payment_method?: string
          payment_reference?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          subscription_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_subscription_account_id_fkey"
            columns: ["subscription_account_id"]
            isOneToOne: false
            referencedRelation: "subscription_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          excluded_features: string[]
          included_features: string[]
          is_active: boolean
          name: string
          price_usd: number
          sort_order: number
          tagline: string
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          excluded_features?: string[]
          included_features?: string[]
          is_active?: boolean
          name: string
          price_usd: number
          sort_order?: number
          tagline: string
          tier: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          excluded_features?: string[]
          included_features?: string[]
          is_active?: boolean
          name?: string
          price_usd?: number
          sort_order?: number
          tagline?: string
          tier?: string
          updated_at?: string
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
      task_collaborators: {
        Row: {
          id: string
          invited_at: string
          invited_by: string | null
          is_primary: boolean
          staff_user_id: string
          task_id: string
          task_type: string
        }
        Insert: {
          id?: string
          invited_at?: string
          invited_by?: string | null
          is_primary?: boolean
          staff_user_id: string
          task_id: string
          task_type: string
        }
        Update: {
          id?: string
          invited_at?: string
          invited_by?: string | null
          is_primary?: boolean
          staff_user_id?: string
          task_id?: string
          task_type?: string
        }
        Relationships: []
      }
      treatment_payment_allocations: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          credit_id: string
          id: string
          schedule_item_id: string
          status: string
          supersede_reason: string | null
          superseded_at: string | null
          treatment_plan_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          credit_id: string
          id?: string
          schedule_item_id: string
          status?: string
          supersede_reason?: string | null
          superseded_at?: string | null
          treatment_plan_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          credit_id?: string
          id?: string
          schedule_item_id?: string
          status?: string
          supersede_reason?: string | null
          superseded_at?: string | null
          treatment_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_payment_allocations_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_payment_allocations_schedule_item_id_fkey"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["next_schedule_item_id"]
          },
          {
            foreignKeyName: "treatment_payment_allocations_schedule_item_id_fkey"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_schedule_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_payment_allocations_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_payment_claims: {
        Row: {
          claimed_amount: number | null
          client_id: string
          client_note: string | null
          client_present: boolean | null
          created_at: string
          finance_entry_id: string | null
          id: string
          payment_method: string | null
          payment_reference: string | null
          plan_credit_id: string | null
          report_link_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          staff_note: string | null
          status: string
          submission_channel: string | null
          submission_source: string
          submitted_by_staff_id: string | null
          treatment_plan_id: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          claimed_amount?: number | null
          client_id: string
          client_note?: string | null
          client_present?: boolean | null
          created_at?: string
          finance_entry_id?: string | null
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          plan_credit_id?: string | null
          report_link_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_note?: string | null
          status?: string
          submission_channel?: string | null
          submission_source?: string
          submitted_by_staff_id?: string | null
          treatment_plan_id: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          claimed_amount?: number | null
          client_id?: string
          client_note?: string | null
          client_present?: boolean | null
          created_at?: string
          finance_entry_id?: string | null
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          plan_credit_id?: string | null
          report_link_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_note?: string | null
          status?: string
          submission_channel?: string | null
          submission_source?: string
          submitted_by_staff_id?: string | null
          treatment_plan_id?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tpc_plan_credit_fk"
            columns: ["plan_credit_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_payment_claims_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "treatment_payment_claims_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_payment_claims_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "treatment_payment_claims_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "treatment_payment_claims_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "treatment_payment_claims_finance_entry_id_fkey"
            columns: ["finance_entry_id"]
            isOneToOne: false
            referencedRelation: "expenses_attributed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_payment_claims_finance_entry_id_fkey"
            columns: ["finance_entry_id"]
            isOneToOne: false
            referencedRelation: "finance_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_payment_claims_finance_entry_id_fkey"
            columns: ["finance_entry_id"]
            isOneToOne: false
            referencedRelation: "suspicious_finance_duplicates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_payment_claims_report_link_id_fkey"
            columns: ["report_link_id"]
            isOneToOne: false
            referencedRelation: "client_report_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_payment_claims_report_link_id_fkey"
            columns: ["report_link_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["report_link_id"]
          },
          {
            foreignKeyName: "treatment_payment_claims_submitted_by_staff_id_fkey"
            columns: ["submitted_by_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "treatment_payment_claims_submitted_by_staff_id_fkey"
            columns: ["submitted_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "treatment_payment_claims_submitted_by_staff_id_fkey"
            columns: ["submitted_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_payment_claims_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plan_credits: {
        Row: {
          amount: number
          claim_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          finance_entry_id: string
          id: string
          treatment_plan_id: string
        }
        Insert: {
          amount: number
          claim_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          finance_entry_id: string
          id?: string
          treatment_plan_id: string
        }
        Update: {
          amount?: number
          claim_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          finance_entry_id?: string
          id?: string
          treatment_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_credits_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "treatment_payment_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_credits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "treatment_plan_credits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_credits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "treatment_plan_credits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "treatment_plan_credits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "treatment_plan_credits_finance_entry_id_fkey"
            columns: ["finance_entry_id"]
            isOneToOne: false
            referencedRelation: "expenses_attributed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_credits_finance_entry_id_fkey"
            columns: ["finance_entry_id"]
            isOneToOne: false
            referencedRelation: "finance_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_credits_finance_entry_id_fkey"
            columns: ["finance_entry_id"]
            isOneToOne: false
            referencedRelation: "suspicious_finance_duplicates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_credits_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plan_projections: {
        Row: {
          assessment_id: string | null
          client_id: string
          created_at: string
          financial_readiness_summary: string
          last_event_at: string | null
          last_event_type: string | null
          lines_summary: Json
          next_schedule_item_id: string | null
          next_schedule_item_summary: Json | null
          plan_status: string
          progress_percent: number
          projection_version: number
          rebuilt_at: string
          rebuilt_reason: string | null
          schedule_summary: Json
          sessions_completed: number
          sessions_total: number
          total_agreed_value: number
          total_allocated: number
          total_paid: number
          total_unallocated: number
          treatment_plan_id: string
          updated_at: string
        }
        Insert: {
          assessment_id?: string | null
          client_id: string
          created_at?: string
          financial_readiness_summary?: string
          last_event_at?: string | null
          last_event_type?: string | null
          lines_summary?: Json
          next_schedule_item_id?: string | null
          next_schedule_item_summary?: Json | null
          plan_status?: string
          progress_percent?: number
          projection_version?: number
          rebuilt_at?: string
          rebuilt_reason?: string | null
          schedule_summary?: Json
          sessions_completed?: number
          sessions_total?: number
          total_agreed_value?: number
          total_allocated?: number
          total_paid?: number
          total_unallocated?: number
          treatment_plan_id: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string | null
          client_id?: string
          created_at?: string
          financial_readiness_summary?: string
          last_event_at?: string | null
          last_event_type?: string | null
          lines_summary?: Json
          next_schedule_item_id?: string | null
          next_schedule_item_summary?: Json | null
          plan_status?: string
          progress_percent?: number
          projection_version?: number
          rebuilt_at?: string
          rebuilt_reason?: string | null
          schedule_summary?: Json
          sessions_completed?: number
          sessions_total?: number
          total_agreed_value?: number
          total_allocated?: number
          total_paid?: number
          total_unallocated?: number
          treatment_plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_projections_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: true
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plan_schedule_items: {
        Row: {
          allocated_amount: number
          appointment_id: string | null
          cancelled_reason: string | null
          comp_authorized_by: string | null
          comp_created_at: string | null
          comp_reason: string | null
          comp_source: string | null
          created_at: string
          created_by: string | null
          credit_release_policy: string
          event_id: string | null
          funding_status: string
          id: string
          is_complimentary: boolean
          line_session_number: number
          notes: string | null
          override_by: string | null
          override_reason: string | null
          performed_at: string | null
          plan_sequence_number: number
          planned_date: string | null
          planned_interval_days: number | null
          planned_unit_cost: number
          skipped_reason: string | null
          started_at: string | null
          started_by: string | null
          status: string
          treatment_plan_id: string
          treatment_plan_session_id: string
          updated_at: string
        }
        Insert: {
          allocated_amount?: number
          appointment_id?: string | null
          cancelled_reason?: string | null
          comp_authorized_by?: string | null
          comp_created_at?: string | null
          comp_reason?: string | null
          comp_source?: string | null
          created_at?: string
          created_by?: string | null
          credit_release_policy?: string
          event_id?: string | null
          funding_status?: string
          id?: string
          is_complimentary?: boolean
          line_session_number: number
          notes?: string | null
          override_by?: string | null
          override_reason?: string | null
          performed_at?: string | null
          plan_sequence_number: number
          planned_date?: string | null
          planned_interval_days?: number | null
          planned_unit_cost?: number
          skipped_reason?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          treatment_plan_id: string
          treatment_plan_session_id: string
          updated_at?: string
        }
        Update: {
          allocated_amount?: number
          appointment_id?: string | null
          cancelled_reason?: string | null
          comp_authorized_by?: string | null
          comp_created_at?: string | null
          comp_reason?: string | null
          comp_source?: string | null
          created_at?: string
          created_by?: string | null
          credit_release_policy?: string
          event_id?: string | null
          funding_status?: string
          id?: string
          is_complimentary?: boolean
          line_session_number?: number
          notes?: string | null
          override_by?: string | null
          override_reason?: string | null
          performed_at?: string | null
          plan_sequence_number?: number
          planned_date?: string | null
          planned_interval_days?: number | null
          planned_unit_cost?: number
          skipped_reason?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          treatment_plan_id?: string
          treatment_plan_session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_schedule_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_session_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_schedule_items_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_schedule_items_treatment_plan_session_id_fkey"
            columns: ["treatment_plan_session_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plan_session_events: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          note: string | null
          performed_at: string
          performed_by: string | null
          plan_id: string
          schedule_item_id: string | null
          visit_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          performed_at?: string
          performed_by?: string | null
          plan_id: string
          schedule_item_id?: string | null
          visit_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          performed_at?: string
          performed_by?: string | null
          plan_id?: string
          schedule_item_id?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tpse_schedule_item_fk"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["next_schedule_item_id"]
          },
          {
            foreignKeyName: "tpse_schedule_item_fk"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_schedule_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_session_events_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_session_events_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "client_visit_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_session_events_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "client_visit_reconciliation_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "treatment_plan_session_events_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "treatment_plan_session_events_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_totals_v"
            referencedColumns: ["visit_id"]
          },
        ]
      }
      treatment_plan_sessions: {
        Row: {
          acceptance_snapshot: Json | null
          agreed_unit_price: number | null
          assessment_id: string | null
          catalogue_unit_price: number | null
          client_id: string
          created_at: string
          created_by: string | null
          discount_scope_snapshot: string | null
          id: string
          last_session_at: string | null
          line_discount_authorized_by: string | null
          line_discount_reason: string | null
          line_discount_type: string | null
          line_discount_value: number | null
          line_total_agreed: number | null
          payment_status: string | null
          service_id: string | null
          service_name: string
          sessions_completed: number
          sessions_paid_for: number | null
          sessions_recommended: number | null
          sessions_total: number
          source_finance_entry_id: string | null
          source_visit_line_item_id: string | null
          started_at: string | null
          status: string
          treatment_plan_id: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          acceptance_snapshot?: Json | null
          agreed_unit_price?: number | null
          assessment_id?: string | null
          catalogue_unit_price?: number | null
          client_id: string
          created_at?: string
          created_by?: string | null
          discount_scope_snapshot?: string | null
          id?: string
          last_session_at?: string | null
          line_discount_authorized_by?: string | null
          line_discount_reason?: string | null
          line_discount_type?: string | null
          line_discount_value?: number | null
          line_total_agreed?: number | null
          payment_status?: string | null
          service_id?: string | null
          service_name: string
          sessions_completed?: number
          sessions_paid_for?: number | null
          sessions_recommended?: number | null
          sessions_total?: number
          source_finance_entry_id?: string | null
          source_visit_line_item_id?: string | null
          started_at?: string | null
          status?: string
          treatment_plan_id?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          acceptance_snapshot?: Json | null
          agreed_unit_price?: number | null
          assessment_id?: string | null
          catalogue_unit_price?: number | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          discount_scope_snapshot?: string | null
          id?: string
          last_session_at?: string | null
          line_discount_authorized_by?: string | null
          line_discount_reason?: string | null
          line_discount_type?: string | null
          line_discount_value?: number | null
          line_total_agreed?: number | null
          payment_status?: string | null
          service_id?: string | null
          service_name?: string
          sessions_completed?: number
          sessions_paid_for?: number | null
          sessions_recommended?: number | null
          sessions_total?: number
          source_finance_entry_id?: string | null
          source_visit_line_item_id?: string | null
          started_at?: string | null
          status?: string
          treatment_plan_id?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_sessions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "client_visit_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "treatment_plan_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "treatment_plan_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "treatment_plan_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "treatment_plan_sessions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_sessions_source_visit_line_item_id_fkey"
            columns: ["source_visit_line_item_id"]
            isOneToOne: false
            referencedRelation: "visit_delivered_billable_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_sessions_source_visit_line_item_id_fkey"
            columns: ["source_visit_line_item_id"]
            isOneToOne: false
            referencedRelation: "visit_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_sessions_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          accepted_at: string | null
          activated_at: string | null
          assessment_id: string | null
          cancelled_at: string | null
          cancelled_reason: string | null
          client_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          discount_scope: string
          id: string
          notes: string | null
          plan_discount_authorized_by: string | null
          plan_discount_reason: string | null
          plan_discount_type: string | null
          plan_discount_value: number | null
          status: string
          total_agreed_value: number
          total_catalogue_value: number
          updated_at: string
          version: number
        }
        Insert: {
          accepted_at?: string | null
          activated_at?: string | null
          assessment_id?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          client_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          discount_scope?: string
          id?: string
          notes?: string | null
          plan_discount_authorized_by?: string | null
          plan_discount_reason?: string | null
          plan_discount_type?: string | null
          plan_discount_value?: number | null
          status?: string
          total_agreed_value?: number
          total_catalogue_value?: number
          updated_at?: string
          version?: number
        }
        Update: {
          accepted_at?: string | null
          activated_at?: string | null
          assessment_id?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          client_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          discount_scope?: string
          id?: string
          notes?: string | null
          plan_discount_authorized_by?: string | null
          plan_discount_reason?: string | null
          plan_discount_type?: string | null
          plan_discount_value?: number | null
          status?: string
          total_agreed_value?: number
          total_catalogue_value?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "client_visit_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "treatment_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "treatment_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "treatment_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
        ]
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
      visit_line_item_history: {
        Row: {
          action: string
          amendment_id: string | null
          changed_at: string
          changed_by: string | null
          diff: Json | null
          id: string
          line_id: string
          new_row: Json | null
          old_row: Json | null
          reason: string | null
          visit_id: string
        }
        Insert: {
          action: string
          amendment_id?: string | null
          changed_at?: string
          changed_by?: string | null
          diff?: Json | null
          id?: string
          line_id: string
          new_row?: Json | null
          old_row?: Json | null
          reason?: string | null
          visit_id: string
        }
        Update: {
          action?: string
          amendment_id?: string | null
          changed_at?: string
          changed_by?: string | null
          diff?: Json | null
          id?: string
          line_id?: string
          new_row?: Json | null
          old_row?: Json | null
          reason?: string | null
          visit_id?: string
        }
        Relationships: []
      }
      visit_line_items: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          agreed_unit_price: number | null
          amended_at: string | null
          amended_by: string | null
          amendment_id: string | null
          amendment_reason: string | null
          assessment_id: string | null
          catalogue_unit_price: number | null
          classification: string | null
          comp_reason: string | null
          created_at: string
          created_by: string | null
          id: string
          is_complimentary: boolean
          kind: string
          line_discount_reason: string | null
          line_discount_type: string | null
          line_discount_value: number | null
          line_total: number
          name: string
          product_id: string | null
          promotion_id: string | null
          qty: number
          removal_group_id: string | null
          removed_at: string | null
          removed_by: string | null
          service_id: string | null
          source: string | null
          source_item_key: string | null
          status: string
          supersedes_line_id: string | null
          treatment_plan_schedule_item_id: string | null
          treatment_plan_session_id: string | null
          unit_price: number
          updated_at: string
          usage_type: string
          validation_request_id: string | null
          visit_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          agreed_unit_price?: number | null
          amended_at?: string | null
          amended_by?: string | null
          amendment_id?: string | null
          amendment_reason?: string | null
          assessment_id?: string | null
          catalogue_unit_price?: number | null
          classification?: string | null
          comp_reason?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_complimentary?: boolean
          kind: string
          line_discount_reason?: string | null
          line_discount_type?: string | null
          line_discount_value?: number | null
          line_total?: number
          name: string
          product_id?: string | null
          promotion_id?: string | null
          qty?: number
          removal_group_id?: string | null
          removed_at?: string | null
          removed_by?: string | null
          service_id?: string | null
          source?: string | null
          source_item_key?: string | null
          status?: string
          supersedes_line_id?: string | null
          treatment_plan_schedule_item_id?: string | null
          treatment_plan_session_id?: string | null
          unit_price?: number
          updated_at?: string
          usage_type?: string
          validation_request_id?: string | null
          visit_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          agreed_unit_price?: number | null
          amended_at?: string | null
          amended_by?: string | null
          amendment_id?: string | null
          amendment_reason?: string | null
          assessment_id?: string | null
          catalogue_unit_price?: number | null
          classification?: string | null
          comp_reason?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_complimentary?: boolean
          kind?: string
          line_discount_reason?: string | null
          line_discount_type?: string | null
          line_discount_value?: number | null
          line_total?: number
          name?: string
          product_id?: string | null
          promotion_id?: string | null
          qty?: number
          removal_group_id?: string | null
          removed_at?: string | null
          removed_by?: string | null
          service_id?: string | null
          source?: string | null
          source_item_key?: string | null
          status?: string
          supersedes_line_id?: string | null
          treatment_plan_schedule_item_id?: string | null
          treatment_plan_session_id?: string | null
          unit_price?: number
          updated_at?: string
          usage_type?: string
          validation_request_id?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_line_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "client_visit_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "visit_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "visit_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_line_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_line_items_supersedes_line_id_fkey"
            columns: ["supersedes_line_id"]
            isOneToOne: false
            referencedRelation: "visit_delivered_billable_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_line_items_supersedes_line_id_fkey"
            columns: ["supersedes_line_id"]
            isOneToOne: false
            referencedRelation: "visit_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_line_items_treatment_plan_schedule_item_id_fkey"
            columns: ["treatment_plan_schedule_item_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["next_schedule_item_id"]
          },
          {
            foreignKeyName: "visit_line_items_treatment_plan_schedule_item_id_fkey"
            columns: ["treatment_plan_schedule_item_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_schedule_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_line_items_treatment_plan_session_id_fkey"
            columns: ["treatment_plan_session_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_line_items_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "client_visit_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_line_items_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "client_visit_reconciliation_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "visit_line_items_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "visit_line_items_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_totals_v"
            referencedColumns: ["visit_id"]
          },
        ]
      }
      visit_removal_history: {
        Row: {
          before_snapshot: Json
          client_id: string
          created_at: string
          id: string
          impact: Json
          reason: string
          removal_group_id: string
          removed_at: string
          removed_by: string | null
          restore_reason: string | null
          restored_at: string | null
          restored_by: string | null
          visit_id: string
        }
        Insert: {
          before_snapshot: Json
          client_id: string
          created_at?: string
          id?: string
          impact: Json
          reason: string
          removal_group_id: string
          removed_at?: string
          removed_by?: string | null
          restore_reason?: string | null
          restored_at?: string | null
          restored_by?: string | null
          visit_id: string
        }
        Update: {
          before_snapshot?: Json
          client_id?: string
          created_at?: string
          id?: string
          impact?: Json
          reason?: string
          removal_group_id?: string
          removed_at?: string
          removed_by?: string | null
          restore_reason?: string | null
          restored_at?: string | null
          restored_by?: string | null
          visit_id?: string
        }
        Relationships: []
      }
      xcape_activation_rules: {
        Row: {
          area: string
          category: string
          config_id: string
          created_at: string
          foundation: boolean
          id: string
          min_severity: number
          priority_weight: number
          product_sku: string
          satisfies_need: boolean
          updated_at: string
        }
        Insert: {
          area?: string
          category: string
          config_id: string
          created_at?: string
          foundation?: boolean
          id?: string
          min_severity?: number
          priority_weight?: number
          product_sku: string
          satisfies_need?: boolean
          updated_at?: string
        }
        Update: {
          area?: string
          category?: string
          config_id?: string
          created_at?: string
          foundation?: boolean
          id?: string
          min_severity?: number
          priority_weight?: number
          product_sku?: string
          satisfies_need?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "xcape_activation_rules_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "xcape_recommendation_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      xcape_admin_mockups: {
        Row: {
          config: Json
          created_at: string
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      xcape_category_customization: {
        Row: {
          active_product_id: string | null
          aggressiveness: string
          base_product_id: string | null
          category: string
          companion_product_id: string | null
          companion_ratio: number
          created_at: string
          created_by: string | null
          id: string
          instructions: string | null
          is_demo: boolean
          kit_product_id: string | null
          status: string
          updated_at: string
          warnings: Json
        }
        Insert: {
          active_product_id?: string | null
          aggressiveness?: string
          base_product_id?: string | null
          category: string
          companion_product_id?: string | null
          companion_ratio?: number
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          is_demo?: boolean
          kit_product_id?: string | null
          status?: string
          updated_at?: string
          warnings?: Json
        }
        Update: {
          active_product_id?: string | null
          aggressiveness?: string
          base_product_id?: string | null
          category?: string
          companion_product_id?: string | null
          companion_ratio?: number
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          is_demo?: boolean
          kit_product_id?: string | null
          status?: string
          updated_at?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "xcape_category_customization_active_product_id_fkey"
            columns: ["active_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_category_customization_active_product_id_fkey"
            columns: ["active_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_category_customization_active_product_id_fkey"
            columns: ["active_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xcape_category_customization_base_product_id_fkey"
            columns: ["base_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_category_customization_base_product_id_fkey"
            columns: ["base_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_category_customization_base_product_id_fkey"
            columns: ["base_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xcape_category_customization_companion_product_id_fkey"
            columns: ["companion_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_category_customization_companion_product_id_fkey"
            columns: ["companion_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_category_customization_companion_product_id_fkey"
            columns: ["companion_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xcape_category_customization_kit_product_id_fkey"
            columns: ["kit_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_category_customization_kit_product_id_fkey"
            columns: ["kit_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_category_customization_kit_product_id_fkey"
            columns: ["kit_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      xcape_commerce_settings: {
        Row: {
          commerce_enabled: boolean
          created_at: string
          currency: string
          momo_provider: string | null
          momo_recipient_name: string | null
          momo_recipient_number: string | null
          order_contact_phone: string | null
          organization_id: string
          updated_at: string
          updated_by: string | null
          whatsapp_number: string | null
        }
        Insert: {
          commerce_enabled?: boolean
          created_at?: string
          currency?: string
          momo_provider?: string | null
          momo_recipient_name?: string | null
          momo_recipient_number?: string | null
          order_contact_phone?: string | null
          organization_id: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          commerce_enabled?: boolean
          created_at?: string
          currency?: string
          momo_provider?: string | null
          momo_recipient_name?: string | null
          momo_recipient_number?: string | null
          order_contact_phone?: string | null
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "xcape_commerce_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      xcape_compatibility_rules: {
        Row: {
          config_id: string
          created_at: string
          id: string
          note: string | null
          product_sku_a: string
          product_sku_b: string
          status: string
          updated_at: string
        }
        Insert: {
          config_id: string
          created_at?: string
          id?: string
          note?: string | null
          product_sku_a: string
          product_sku_b: string
          status?: string
          updated_at?: string
        }
        Update: {
          config_id?: string
          created_at?: string
          id?: string
          note?: string | null
          product_sku_a?: string
          product_sku_b?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "xcape_compatibility_rules_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "xcape_recommendation_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      xcape_contraindications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          message: string
          name: string
          severity: string
          status: string
          target_id: string | null
          target_kind: string
          target_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          message: string
          name: string
          severity?: string
          status?: string
          target_id?: string | null
          target_kind?: string
          target_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          message?: string
          name?: string
          severity?: string
          status?: string
          target_id?: string | null
          target_kind?: string
          target_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      xcape_customization_usage_events: {
        Row: {
          active_name: string | null
          active_product_id: string | null
          approved_at: string | null
          approved_by: string | null
          assessment_id: string
          base_product_id: string | null
          base_product_name: string | null
          captured_by: string | null
          category: string
          cdp_org_id: string
          cdp_org_name: string | null
          client_id: string
          companion_dose_ml: number | null
          companion_name: string | null
          companion_product_id: string | null
          dose_ml: number | null
          formula_lines: Json
          formula_snapshot_id: string
          id: string
          kit_name: string | null
          kit_product_id: string | null
          product_catalogue_version: string | null
          protocol_version: string | null
          recommendation_rule_version: number | null
          recorded_at: string
          rule_id: string | null
          rule_version: number | null
          rule_version_id: string | null
        }
        Insert: {
          active_name?: string | null
          active_product_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assessment_id: string
          base_product_id?: string | null
          base_product_name?: string | null
          captured_by?: string | null
          category: string
          cdp_org_id: string
          cdp_org_name?: string | null
          client_id: string
          companion_dose_ml?: number | null
          companion_name?: string | null
          companion_product_id?: string | null
          dose_ml?: number | null
          formula_lines?: Json
          formula_snapshot_id: string
          id?: string
          kit_name?: string | null
          kit_product_id?: string | null
          product_catalogue_version?: string | null
          protocol_version?: string | null
          recommendation_rule_version?: number | null
          recorded_at?: string
          rule_id?: string | null
          rule_version?: number | null
          rule_version_id?: string | null
        }
        Update: {
          active_name?: string | null
          active_product_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assessment_id?: string
          base_product_id?: string | null
          base_product_name?: string | null
          captured_by?: string | null
          category?: string
          cdp_org_id?: string
          cdp_org_name?: string | null
          client_id?: string
          companion_dose_ml?: number | null
          companion_name?: string | null
          companion_product_id?: string | null
          dose_ml?: number | null
          formula_lines?: Json
          formula_snapshot_id?: string
          id?: string
          kit_name?: string | null
          kit_product_id?: string | null
          product_catalogue_version?: string | null
          protocol_version?: string | null
          recommendation_rule_version?: number | null
          recorded_at?: string
          rule_id?: string | null
          rule_version?: number | null
          rule_version_id?: string | null
        }
        Relationships: []
      }
      xcape_formula_snapshots: {
        Row: {
          active_name: string | null
          active_product_id: string | null
          approved_at: string | null
          approved_by: string | null
          assessment_id: string
          base_product_id: string | null
          base_product_name: string | null
          category: string
          client_id: string
          companion_dose_ml: number | null
          companion_name: string | null
          companion_product_id: string | null
          created_at: string
          created_by: string | null
          decision_reason: string | null
          decisions: Json
          dose_ml: number | null
          dose_tier: Json | null
          formula_lines: Json
          id: string
          instructions: string | null
          is_demo: boolean
          kit_name: string | null
          kit_product_id: string | null
          kit_unit_price: number | null
          override_note: string | null
          product_catalogue_version: string | null
          proposal_id: string | null
          protocol_version: string | null
          recommendation_rule_version: number | null
          rule_id: string | null
          rule_version: number | null
          rule_version_id: string | null
          score: number | null
          status: string
          updated_at: string
          warnings: Json
        }
        Insert: {
          active_name?: string | null
          active_product_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assessment_id: string
          base_product_id?: string | null
          base_product_name?: string | null
          category: string
          client_id: string
          companion_dose_ml?: number | null
          companion_name?: string | null
          companion_product_id?: string | null
          created_at?: string
          created_by?: string | null
          decision_reason?: string | null
          decisions?: Json
          dose_ml?: number | null
          dose_tier?: Json | null
          formula_lines?: Json
          id?: string
          instructions?: string | null
          is_demo?: boolean
          kit_name?: string | null
          kit_product_id?: string | null
          kit_unit_price?: number | null
          override_note?: string | null
          product_catalogue_version?: string | null
          proposal_id?: string | null
          protocol_version?: string | null
          recommendation_rule_version?: number | null
          rule_id?: string | null
          rule_version?: number | null
          rule_version_id?: string | null
          score?: number | null
          status?: string
          updated_at?: string
          warnings?: Json
        }
        Update: {
          active_name?: string | null
          active_product_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assessment_id?: string
          base_product_id?: string | null
          base_product_name?: string | null
          category?: string
          client_id?: string
          companion_dose_ml?: number | null
          companion_name?: string | null
          companion_product_id?: string | null
          created_at?: string
          created_by?: string | null
          decision_reason?: string | null
          decisions?: Json
          dose_ml?: number | null
          dose_tier?: Json | null
          formula_lines?: Json
          id?: string
          instructions?: string | null
          is_demo?: boolean
          kit_name?: string | null
          kit_product_id?: string | null
          kit_unit_price?: number | null
          override_note?: string | null
          product_catalogue_version?: string | null
          proposal_id?: string | null
          protocol_version?: string | null
          recommendation_rule_version?: number | null
          rule_id?: string | null
          rule_version?: number | null
          rule_version_id?: string | null
          score?: number | null
          status?: string
          updated_at?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "xcape_formula_snapshots_active_product_id_fkey"
            columns: ["active_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_formula_snapshots_active_product_id_fkey"
            columns: ["active_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_formula_snapshots_active_product_id_fkey"
            columns: ["active_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xcape_formula_snapshots_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "client_visit_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xcape_formula_snapshots_base_product_id_fkey"
            columns: ["base_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_formula_snapshots_base_product_id_fkey"
            columns: ["base_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_formula_snapshots_base_product_id_fkey"
            columns: ["base_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xcape_formula_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "xcape_formula_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xcape_formula_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "xcape_formula_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "xcape_formula_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "xcape_formula_snapshots_companion_product_id_fkey"
            columns: ["companion_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_formula_snapshots_companion_product_id_fkey"
            columns: ["companion_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_formula_snapshots_companion_product_id_fkey"
            columns: ["companion_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xcape_formula_snapshots_kit_product_id_fkey"
            columns: ["kit_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_formula_snapshots_kit_product_id_fkey"
            columns: ["kit_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_formula_snapshots_kit_product_id_fkey"
            columns: ["kit_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xcape_formula_snapshots_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "xcape_recommendation_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      xcape_interaction_rules: {
        Row: {
          and_category: string | null
          and_max_severity: number
          and_min_severity: number
          boost_category: string | null
          client_text: string
          code: string
          config_id: string
          created_at: string
          id: string
          practitioner_text: string
          priority_boost: number
          sort_order: number
          updated_at: string
          when_category: string
          when_min_severity: number
        }
        Insert: {
          and_category?: string | null
          and_max_severity?: number
          and_min_severity?: number
          boost_category?: string | null
          client_text: string
          code: string
          config_id: string
          created_at?: string
          id?: string
          practitioner_text: string
          priority_boost?: number
          sort_order?: number
          updated_at?: string
          when_category: string
          when_min_severity?: number
        }
        Update: {
          and_category?: string | null
          and_max_severity?: number
          and_min_severity?: number
          boost_category?: string | null
          client_text?: string
          code?: string
          config_id?: string
          created_at?: string
          id?: string
          practitioner_text?: string
          priority_boost?: number
          sort_order?: number
          updated_at?: string
          when_category?: string
          when_min_severity?: number
        }
        Relationships: [
          {
            foreignKeyName: "xcape_interaction_rules_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "xcape_recommendation_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      xcape_kit_components: {
        Row: {
          component_product_id: string
          created_at: string
          created_by: string | null
          id: string
          is_customizable: boolean
          kit_product_id: string
          role: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          component_product_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_customizable?: boolean
          kit_product_id: string
          role?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          component_product_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_customizable?: boolean
          kit_product_id?: string
          role?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "xcape_kit_components_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_kit_components_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_kit_components_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xcape_kit_components_kit_product_id_fkey"
            columns: ["kit_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_kit_components_kit_product_id_fkey"
            columns: ["kit_product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_kit_components_kit_product_id_fkey"
            columns: ["kit_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      xcape_product_alignments: {
        Row: {
          area: string
          category: string
          created_at: string
          created_by: string | null
          dose_multiplier: number
          id: string
          is_active: boolean
          product_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          area: string
          category: string
          created_at?: string
          created_by?: string | null
          dose_multiplier?: number
          id?: string
          is_active?: boolean
          product_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          area?: string
          category?: string
          created_at?: string
          created_by?: string | null
          dose_multiplier?: number
          id?: string
          is_active?: boolean
          product_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "xcape_product_alignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_product_alignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "xcape_product_alignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      xcape_protocols: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration: string | null
          follow_up_weeks: number | null
          frequency: string | null
          home_care: string | null
          id: string
          is_demo: boolean
          linked_product_ids: string[]
          linked_service_ids: string[]
          name: string
          sessions: number | null
          status: string
          steps: Json
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration?: string | null
          follow_up_weeks?: number | null
          frequency?: string | null
          home_care?: string | null
          id?: string
          is_demo?: boolean
          linked_product_ids?: string[]
          linked_service_ids?: string[]
          name: string
          sessions?: number | null
          status?: string
          steps?: Json
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration?: string | null
          follow_up_weeks?: number | null
          frequency?: string | null
          home_care?: string | null
          id?: string
          is_demo?: boolean
          linked_product_ids?: string[]
          linked_service_ids?: string[]
          name?: string
          sessions?: number | null
          status?: string
          steps?: Json
          updated_at?: string
        }
        Relationships: []
      }
      xcape_recommendation_configs: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          published_at: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          published_at?: string | null
          status?: string
          updated_at?: string
          version: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          published_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      xcape_recommendation_proposals: {
        Row: {
          assessment_id: string
          client_id: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          engine_version: string | null
          final_result: Json | null
          id: string
          matched_reasons: Json
          proposal: Json
          rule_id: string | null
          rule_name: string | null
          rule_version: number | null
          rule_version_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          client_id: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          engine_version?: string | null
          final_result?: Json | null
          id?: string
          matched_reasons?: Json
          proposal: Json
          rule_id?: string | null
          rule_name?: string | null
          rule_version?: number | null
          rule_version_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          engine_version?: string | null
          final_result?: Json | null
          id?: string
          matched_reasons?: Json
          proposal?: Json
          rule_id?: string | null
          rule_name?: string | null
          rule_version?: number | null
          rule_version_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "xcape_recommendation_proposals_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "client_visit_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xcape_recommendation_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "xcape_recommendation_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xcape_recommendation_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "xcape_recommendation_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "xcape_recommendation_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "xcape_recommendation_proposals_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "xcape_recommendation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xcape_recommendation_proposals_rule_version_id_fkey"
            columns: ["rule_version_id"]
            isOneToOne: false
            referencedRelation: "xcape_rule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      xcape_recommendation_rules: {
        Row: {
          created_at: string
          created_by: string | null
          current_version: number
          description: string | null
          draft_conditions: Json
          draft_outputs: Json
          id: string
          is_demo: boolean
          name: string
          priority: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_version?: number
          description?: string | null
          draft_conditions?: Json
          draft_outputs?: Json
          id?: string
          is_demo?: boolean
          name: string
          priority?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_version?: number
          description?: string | null
          draft_conditions?: Json
          draft_outputs?: Json
          id?: string
          is_demo?: boolean
          name?: string
          priority?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      xcape_report_payment_claims: {
        Row: {
          amount_due: number
          buyer_email: string | null
          buyer_name: string | null
          buyer_note: string | null
          buyer_phone: string | null
          client_id: string | null
          created_at: string
          currency: string
          id: string
          merchant_contact_snapshot: Json | null
          merchant_org_id: string | null
          order_ref: string
          origin_org_id: string | null
          origin_role: string | null
          origin_user_id: string | null
          provider: string | null
          recipient_number: string | null
          reference: string | null
          rejected_reason: string | null
          report_link_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sender_phone: string
          status: string
          submitted_amount: number
          updated_at: string
        }
        Insert: {
          amount_due: number
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_note?: string | null
          buyer_phone?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          merchant_contact_snapshot?: Json | null
          merchant_org_id?: string | null
          order_ref: string
          origin_org_id?: string | null
          origin_role?: string | null
          origin_user_id?: string | null
          provider?: string | null
          recipient_number?: string | null
          reference?: string | null
          rejected_reason?: string | null
          report_link_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_phone: string
          status?: string
          submitted_amount: number
          updated_at?: string
        }
        Update: {
          amount_due?: number
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_note?: string | null
          buyer_phone?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          merchant_contact_snapshot?: Json | null
          merchant_org_id?: string | null
          order_ref?: string
          origin_org_id?: string | null
          origin_role?: string | null
          origin_user_id?: string | null
          provider?: string | null
          recipient_number?: string | null
          reference?: string | null
          rejected_reason?: string | null
          report_link_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_phone?: string
          status?: string
          submitted_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "xcape_report_payment_claims_merchant_org_id_fkey"
            columns: ["merchant_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xcape_report_payment_claims_report_link_id_fkey"
            columns: ["report_link_id"]
            isOneToOne: false
            referencedRelation: "client_report_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xcape_report_payment_claims_report_link_id_fkey"
            columns: ["report_link_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["report_link_id"]
          },
        ]
      }
      xcape_rule_audit: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          id: string
          rule_id: string
          snapshot: Json | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          id?: string
          rule_id: string
          snapshot?: Json | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          id?: string
          rule_id?: string
          snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "xcape_rule_audit_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "xcape_recommendation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      xcape_rule_versions: {
        Row: {
          change_note: string | null
          conditions: Json
          created_at: string
          id: string
          outputs: Json
          published_at: string
          published_by: string | null
          rule_id: string
          status: string
          version: number
        }
        Insert: {
          change_note?: string | null
          conditions: Json
          created_at?: string
          id?: string
          outputs: Json
          published_at?: string
          published_by?: string | null
          rule_id: string
          status?: string
          version: number
        }
        Update: {
          change_note?: string | null
          conditions?: Json
          created_at?: string
          id?: string
          outputs?: Json
          published_at?: string
          published_by?: string | null
          rule_id?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "xcape_rule_versions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "xcape_recommendation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      xcape_severity_bands: {
        Row: {
          code: string
          config_id: string
          created_at: string
          id: string
          label: string
          severity_max: number
          severity_min: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          config_id: string
          created_at?: string
          id?: string
          label: string
          severity_max: number
          severity_min: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          config_id?: string
          created_at?: string
          id?: string
          label?: string
          severity_max?: number
          severity_min?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "xcape_severity_bands_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "xcape_recommendation_configs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      bottleneck_view: {
        Row: {
          hours_stuck: number | null
          kind: string | null
          label: string | null
          ref_id: string | null
          staff_user_id: string | null
        }
        Relationships: []
      }
      client_communications: {
        Row: {
          channel: string | null
          client_id: string | null
          client_name: string | null
          detail: string | null
          occurred_at: string | null
          staff_user_id: string | null
          status: string | null
          subtype: string | null
          target: string | null
        }
        Relationships: []
      }
      client_media_usage: {
        Row: {
          archived_count: number | null
          bytes_total: number | null
          client_archived: boolean | null
          client_code: string | null
          client_id: string | null
          client_name: string | null
          media_count: number | null
        }
        Relationships: []
      }
      client_visit_reconciliation_v: {
        Row: {
          active_line_count: number | null
          agreed_total: number | null
          appointment_id: string | null
          assigned_medical_expert_id: string | null
          billable_agreed_total: number | null
          billable_line_count: number | null
          catalogue_total: number | null
          charge_total: number | null
          client_id: string | null
          credit_balance: number | null
          delivered_summary: string | null
          final_total: number | null
          health_status: string | null
          issue_codes: string[] | null
          logged_by_staff_id: string | null
          notes: string | null
          outcome: Database["public"]["Enums"]["visit_outcome"] | null
          outstanding: number | null
          paid_total: number | null
          payment_state: string | null
          product_line_count: number | null
          reason_for_visit: Database["public"]["Enums"]["visit_reason"] | null
          revenue_active: number | null
          revenue_entries_count: number | null
          service_line_count: number | null
          sign_in_time: string | null
          sign_out_time: string | null
          signed_out_by_staff_id: string | null
          treatment_completed_at: string | null
          treatment_started_at: string | null
          visit_date: string | null
          visit_id: string | null
          visit_status: string | null
        }
        Relationships: []
      }
      conversion_funnel_view: {
        Row: {
          n: number | null
          staff_user_id: string | null
          stage: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_attributed_staff_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "clients_attributed_staff_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "clients_attributed_staff_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_ops_metrics: {
        Row: {
          accountability_deductions: number | null
          appointments_booked: number | null
          appointments_completed: number | null
          appointments_no_show: number | null
          deliverables_failed: number | null
          deliverables_verified: number | null
          full_name: string | null
          interactions_count: number | null
          leads_contacted: number | null
          leads_created: number | null
          metric_date: string | null
          products_sold_units: number | null
          products_sold_value: number | null
          revenue_attributed: number | null
          show_up_rate_pct: number | null
          staff_user_id: string | null
        }
        Relationships: []
      }
      daily_ops_metrics_org: {
        Row: {
          accountability_deductions: number | null
          appointments_booked: number | null
          appointments_completed: number | null
          appointments_no_show: number | null
          deliverables_failed: number | null
          deliverables_verified: number | null
          interactions_count: number | null
          leads_contacted: number | null
          leads_created: number | null
          metric_date: string | null
          products_sold_units: number | null
          products_sold_value: number | null
          revenue_attributed: number | null
          show_up_rate_pct: number | null
        }
        Relationships: []
      }
      expenses_attributed: {
        Row: {
          amount: number | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          date: string | null
          department_code: string | null
          department_id: string | null
          department_label: string | null
          expense_category_code: string | null
          expense_category_id: string | null
          expense_category_label: string | null
          expense_group: string | null
          id: string | null
          notes: string | null
          operation_kind: string | null
          operation_label: string | null
          operation_ref_id: string | null
          receipt_url: string | null
          staff_user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "finance_entries_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "finance_entries_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_usage_estimates: {
        Row: {
          avg_daily_usage: number | null
          category: Database["public"]["Enums"]["inventory_category"] | null
          current_stock: number | null
          days_of_stock_left: number | null
          item_id: string | null
          name: string | null
          qty_consumed_30d: number | null
          reorder_point: number | null
          stock_status: string | null
          suggested_reorder_qty: number | null
          supplier: string | null
          unit: string | null
          unit_cost: number | null
        }
        Relationships: []
      }
      member_spend_monthly: {
        Row: {
          attributed_staff_id: string | null
          client_code: string | null
          client_id: string | null
          full_name: string | null
          membership_type: Database["public"]["Enums"]["membership_type"] | null
          period: string | null
          remaining_to_threshold: number | null
          spend_this_month: number | null
          threshold: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "clients_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "clients_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_lifecycle_status: {
        Row: {
          attributed_staff_id: string | null
          churn_risk: string | null
          client_code: string | null
          client_id: string | null
          current_tier: Database["public"]["Enums"]["membership_type"] | null
          email: string | null
          full_name: string | null
          last_activity_date: string | null
          phone: string | null
          spend_30d: number | null
          spend_60d: number | null
          suggested_tier: Database["public"]["Enums"]["membership_type"] | null
          tier_since: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "clients_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "clients_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_truth_shadow_v: {
        Row: {
          amended_at: string | null
          amendment_reason: string | null
          client_email: string | null
          client_id: string | null
          client_location: string | null
          client_name: string | null
          client_phone: string | null
          complimentary_count: number | null
          complimentary_value: number | null
          duration_minutes: number | null
          explicit_discount_value: number | null
          integrity_state: string | null
          manual_discount_amount: number | null
          new_money_received: number | null
          next_appointment_date: string | null
          next_appointment_id: string | null
          next_appointment_status: string | null
          next_appointment_time: string | null
          next_appointment_treatment: string | null
          next_schedule_date: string | null
          next_schedule_item_id: string | null
          op_id: string | null
          op_provenance: string | null
          outstanding_amount: number | null
          payment_method: string | null
          payment_status: string | null
          practitioner_id: string | null
          prior_credit_used: number | null
          product_count: number | null
          product_value: number | null
          promo_code_applied: string | null
          promo_discount_amount: number | null
          removal_count: number | null
          removed_at: string | null
          report_available: boolean | null
          report_created_at: string | null
          report_link_id: string | null
          revenue_entry_count: number | null
          sign_in_time: string | null
          sign_out_time: string | null
          signed_in_by_staff_id: string | null
          signed_out_by_staff_id: string | null
          standard_value: number | null
          summary_text: string | null
          treatment_count: number | null
          treatment_value: number | null
          visit_appointment_id: string | null
          visit_date: string | null
          visit_final_total: number | null
          visit_id: string | null
          visit_outcome: string | null
          visit_payment_state: string | null
          visit_reason: string | null
          visit_status: string | null
          warnings: string[] | null
        }
        Relationships: []
      }
      overdue_followups_view: {
        Row: {
          attributed_staff_id: string | null
          client_id: string | null
          client_name: string | null
          days_overdue: number | null
          id: string | null
          last_logged_by: string | null
          next_action_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "clients_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "clients_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "lead_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "lead_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "lead_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "lead_interactions_staff_user_id_fkey"
            columns: ["last_logged_by"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "lead_interactions_staff_user_id_fkey"
            columns: ["last_logged_by"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "lead_interactions_staff_user_id_fkey"
            columns: ["last_logged_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_performance: {
        Row: {
          active: boolean | null
          category: string | null
          name: string | null
          product_id: string | null
          remaining_stock: number | null
          selling_price: number | null
          total_cost: number | null
          total_produced: number | null
          total_profit: number | null
          total_revenue: number | null
          total_sold: number | null
        }
        Relationships: []
      }
      product_performance_v2: {
        Row: {
          active: boolean | null
          asset_value_remaining: number | null
          category: string | null
          gross_margin_percent: number | null
          gross_profit: number | null
          market_price: number | null
          min_price_threshold: number | null
          name: string | null
          oldest_batch_at: string | null
          product_id: string | null
          promo_price: number | null
          reorder_threshold: number | null
          total_cogs: number | null
          total_revenue: number | null
          units_produced: number | null
          units_remaining: number | null
          units_sold: number | null
        }
        Relationships: []
      }
      product_sales_by_staff: {
        Row: {
          gross_revenue: number | null
          last_sold_at: string | null
          paid_count: number | null
          pending_count: number | null
          product_id: string | null
          product_name: string | null
          sale_count: number | null
          size_label: string | null
          staff_user_id: string | null
          units_sold: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_attributed_staff_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "finance_entries_attributed_staff_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "finance_entries_attributed_staff_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "finance_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "finance_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_version_costs: {
        Row: {
          batch_quantity: number | null
          effective_units: number | null
          estimated_unit_cost: number | null
          gross_batch_cost: number | null
          logistics_cost: number | null
          manufacturing_cost: number | null
          other_cost: number | null
          packaging_cost: number | null
          product_id: string | null
          raw_material_cost: number | null
          recipe_version_id: string | null
          status: string | null
          version_number: number | null
          wastage_percent: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "recipe_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "recipe_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_daily_series: {
        Row: {
          amount: number | null
          date: string | null
          kind: string | null
        }
        Relationships: []
      }
      staff_performance_summary: {
        Row: {
          appointments_30d: number | null
          appointments_completed: number | null
          appointments_total: number | null
          conversion_rate_pct: number | null
          conversions_30d: number | null
          conversions_total: number | null
          email: string | null
          full_name: string | null
          income_30d: number | null
          income_total: number | null
          leads_30d: number | null
          leads_total: number | null
          logged_income_30d: number | null
          logged_income_total: number | null
          outreach_30d: number | null
          outreach_sales_30d: number | null
          outreach_sales_total: number | null
          outreach_total: number | null
          product_revenue_30d: number | null
          product_revenue_total: number | null
          product_units_30d: number | null
          product_units_total: number | null
          revenue_30d: number | null
          revenue_total: number | null
          staff_status: Database["public"]["Enums"]["staff_status"] | null
          staff_user_id: string | null
        }
        Relationships: []
      }
      stale_leads_view: {
        Row: {
          attributed_staff_id: string | null
          client_id: string | null
          created_at: string | null
          full_name: string | null
          hours_since_touch: number | null
          last_interaction_at: string | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"] | null
        }
        Insert: {
          attributed_staff_id?: string | null
          client_id?: string | null
          created_at?: string | null
          full_name?: string | null
          hours_since_touch?: never
          last_interaction_at?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
        }
        Update: {
          attributed_staff_id?: string | null
          client_id?: string | null
          created_at?: string | null
          full_name?: string | null
          hours_since_touch?: never
          last_interaction_at?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "clients_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "clients_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      suspicious_finance_duplicates: {
        Row: {
          amount: number | null
          attributed_staff_id: string | null
          category: string | null
          created_at: string | null
          date: string | null
          entries_in_group: number | null
          id: string | null
          notes: string | null
          payment_reference: string | null
          signature: string | null
          source_client_id: string | null
          visit_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "daily_ops_metrics"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "finance_entries_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_performance_summary"
            referencedColumns: ["staff_user_id"]
          },
          {
            foreignKeyName: "finance_entries_attributed_staff_id_fkey"
            columns: ["attributed_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_source_client_id_fkey"
            columns: ["source_client_id"]
            isOneToOne: false
            referencedRelation: "client_media_usage"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "finance_entries_source_client_id_fkey"
            columns: ["source_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_source_client_id_fkey"
            columns: ["source_client_id"]
            isOneToOne: false
            referencedRelation: "member_spend_monthly"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "finance_entries_source_client_id_fkey"
            columns: ["source_client_id"]
            isOneToOne: false
            referencedRelation: "membership_lifecycle_status"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "finance_entries_source_client_id_fkey"
            columns: ["source_client_id"]
            isOneToOne: false
            referencedRelation: "stale_leads_view"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "finance_entries_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "client_visit_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "client_visit_reconciliation_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "finance_entries_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "finance_entries_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_totals_v"
            referencedColumns: ["visit_id"]
          },
        ]
      }
      system_health: {
        Row: {
          appointments_30d: number | null
          appointments_today: number | null
          clients_active: number | null
          clients_archived: number | null
          elites_total: number | null
          finance_entries_30d: number | null
          leads_total: number | null
          media_active: number | null
          media_archived: number | null
          media_bytes_active: number | null
          media_bytes_archived: number | null
          members_total: number | null
          outreach_30d: number | null
          staff_active: number | null
          staff_total: number | null
          visits_30d: number | null
        }
        Relationships: []
      }
      visit_amendment_history_v: {
        Row: {
          action: string | null
          amendment_id: string | null
          changed_at: string | null
          changed_by: string | null
          id: string | null
          item_name: string | null
          line_id: string | null
          new_agreed_unit_price: number | null
          new_is_complimentary: boolean | null
          new_line_total: number | null
          new_qty: number | null
          old_agreed_unit_price: number | null
          old_is_complimentary: boolean | null
          old_line_total: number | null
          old_qty: number | null
          reason: string | null
          visit_id: string | null
        }
        Insert: {
          action?: string | null
          amendment_id?: string | null
          changed_at?: string | null
          changed_by?: string | null
          id?: string | null
          item_name?: never
          line_id?: string | null
          new_agreed_unit_price?: never
          new_is_complimentary?: never
          new_line_total?: never
          new_qty?: never
          old_agreed_unit_price?: never
          old_is_complimentary?: never
          old_line_total?: never
          old_qty?: never
          reason?: string | null
          visit_id?: string | null
        }
        Update: {
          action?: string | null
          amendment_id?: string | null
          changed_at?: string | null
          changed_by?: string | null
          id?: string | null
          item_name?: never
          line_id?: string | null
          new_agreed_unit_price?: never
          new_is_complimentary?: never
          new_line_total?: never
          new_qty?: never
          old_agreed_unit_price?: never
          old_is_complimentary?: never
          old_line_total?: never
          old_qty?: never
          reason?: string | null
          visit_id?: string | null
        }
        Relationships: []
      }
      visit_delivered_billable_lines: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          agreed_unit_price: number | null
          amended_at: string | null
          amended_by: string | null
          amendment_id: string | null
          amendment_reason: string | null
          assessment_id: string | null
          catalogue_unit_price: number | null
          comp_reason: string | null
          created_at: string | null
          created_by: string | null
          delivery_priority: number | null
          id: string | null
          is_complimentary: boolean | null
          kind: string | null
          line_discount_reason: string | null
          line_discount_type: string | null
          line_discount_value: number | null
          line_total: number | null
          name: string | null
          product_id: string | null
          promotion_id: string | null
          qty: number | null
          removal_group_id: string | null
          removed_at: string | null
          removed_by: string | null
          service_id: string | null
          source: string | null
          status: string | null
          supersedes_line_id: string | null
          treatment_plan_schedule_item_id: string | null
          treatment_plan_session_id: string | null
          unit_price: number | null
          updated_at: string | null
          usage_type: string | null
          visit_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          agreed_unit_price?: number | null
          amended_at?: string | null
          amended_by?: string | null
          amendment_id?: string | null
          amendment_reason?: string | null
          assessment_id?: string | null
          catalogue_unit_price?: number | null
          comp_reason?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_priority?: never
          id?: string | null
          is_complimentary?: boolean | null
          kind?: string | null
          line_discount_reason?: string | null
          line_discount_type?: string | null
          line_discount_value?: number | null
          line_total?: number | null
          name?: string | null
          product_id?: string | null
          promotion_id?: string | null
          qty?: number | null
          removal_group_id?: string | null
          removed_at?: string | null
          removed_by?: string | null
          service_id?: string | null
          source?: string | null
          status?: string | null
          supersedes_line_id?: string | null
          treatment_plan_schedule_item_id?: string | null
          treatment_plan_session_id?: string | null
          unit_price?: number | null
          updated_at?: string | null
          usage_type?: string | null
          visit_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          agreed_unit_price?: number | null
          amended_at?: string | null
          amended_by?: string | null
          amendment_id?: string | null
          amendment_reason?: string | null
          assessment_id?: string | null
          catalogue_unit_price?: number | null
          comp_reason?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_priority?: never
          id?: string | null
          is_complimentary?: boolean | null
          kind?: string | null
          line_discount_reason?: string | null
          line_discount_type?: string | null
          line_discount_value?: number | null
          line_total?: number | null
          name?: string | null
          product_id?: string | null
          promotion_id?: string | null
          qty?: number | null
          removal_group_id?: string | null
          removed_at?: string | null
          removed_by?: string | null
          service_id?: string | null
          source?: string | null
          status?: string | null
          supersedes_line_id?: string | null
          treatment_plan_schedule_item_id?: string | null
          treatment_plan_session_id?: string | null
          unit_price?: number | null
          updated_at?: string | null
          usage_type?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_line_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "client_visit_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "visit_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_performance_v2"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "visit_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_line_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_line_items_supersedes_line_id_fkey"
            columns: ["supersedes_line_id"]
            isOneToOne: false
            referencedRelation: "visit_delivered_billable_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_line_items_supersedes_line_id_fkey"
            columns: ["supersedes_line_id"]
            isOneToOne: false
            referencedRelation: "visit_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_line_items_treatment_plan_schedule_item_id_fkey"
            columns: ["treatment_plan_schedule_item_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["next_schedule_item_id"]
          },
          {
            foreignKeyName: "visit_line_items_treatment_plan_schedule_item_id_fkey"
            columns: ["treatment_plan_schedule_item_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_schedule_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_line_items_treatment_plan_session_id_fkey"
            columns: ["treatment_plan_session_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_line_items_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "client_visit_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_line_items_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "client_visit_reconciliation_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "visit_line_items_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "operational_truth_shadow_v"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "visit_line_items_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_totals_v"
            referencedColumns: ["visit_id"]
          },
        ]
      }
      visit_totals_v: {
        Row: {
          active_line_count: number | null
          agreed_total: number | null
          catalogue_total: number | null
          client_id: string | null
          comp_line_count: number | null
          comp_total: number | null
          credit_balance: number | null
          discount_total: number | null
          is_amended: boolean | null
          outstanding: number | null
          paid_total: number | null
          reconciliation_drift: number | null
          revenue_recognized: number | null
          visit_date: string | null
          visit_id: string | null
          visit_status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _amend_visit_projection: {
        Args: { p_lines: Json; p_visit_id: string }
        Returns: Json
      }
      _recon_facts_preview: {
        Args: {
          p_amount_paid: number
          p_lines: Json
          p_payment_state: string
          p_request_id: string
          p_visit_id: string
        }
        Returns: Json
      }
      _slugify: { Args: { txt: string }; Returns: string }
      accept_treatment_plan: {
        Args: {
          p_assessment_id: string
          p_lines: Json
          p_notes?: string
          p_plan_discount?: Json
        }
        Returns: Json
      }
      activate_recipe_version: {
        Args: { _recipe_version_id: string }
        Returns: undefined
      }
      add_complimentary_treatments: {
        Args: {
          p_client_id: string
          p_idempotency_key: string
          p_lines: Json
          p_visit_id: string
        }
        Returns: Json
      }
      admin_amend_visit_lines: {
        Args: {
          p_amount_paid: number
          p_lines: Json
          p_reason: string
          p_request_id?: string
          p_visit_id: string
        }
        Returns: Json
      }
      admin_amend_visit_lines_dry_run: {
        Args: {
          p_amount_paid?: number
          p_lines: Json
          p_reason?: string
          p_request_id?: string
          p_visit_id: string
        }
        Returns: Json
      }
      admin_amend_visit_receipt: {
        Args: {
          _line_item_patch?: Json
          _reason: string
          _visit_id: string
          _visit_patch?: Json
        }
        Returns: Json
      }
      admin_force_close_visit: {
        Args: { p_reason: string; p_visit_id: string }
        Returns: Json
      }
      admin_reconcile_dry_run: {
        Args: {
          _action: string
          _entry_id: string
          _patch?: Json
          _related_entry_ids?: string[]
        }
        Returns: Json
      }
      admin_reconcile_finance_entry: {
        Args: {
          _action: string
          _entry_id: string
          _patch?: Json
          _reason: string
          _related_entry_ids?: string[]
        }
        Returns: Json
      }
      admin_record_visit_facts: {
        Args: {
          p_amount_paid?: number
          p_finance_date?: string
          p_lines?: Json
          p_outcome?: string
          p_payment_method?: string
          p_payment_state?: string
          p_reason: string
          p_request_id?: string
          p_visit_id: string
        }
        Returns: Json
      }
      admin_record_visit_facts_dry_run: {
        Args: {
          p_amount_paid?: number
          p_finance_date?: string
          p_lines?: Json
          p_outcome?: string
          p_payment_method?: string
          p_payment_state?: string
          p_reason: string
          p_request_id?: string
          p_visit_id: string
        }
        Returns: Json
      }
      admin_remove_visit: {
        Args: {
          p_client_id: string
          p_confirm_surname: string
          p_reason: string
          p_visit_id: string
        }
        Returns: Json
      }
      admin_remove_visit_dry_run: {
        Args: { p_client_id: string; p_visit_id: string }
        Returns: Json
      }
      admin_restore_visit: {
        Args: { p_reason: string; p_removal_group_id: string }
        Returns: Json
      }
      advance_pipeline_stage: {
        Args: {
          _client_id: string
          _to: Database["public"]["Enums"]["pipeline_stage"]
        }
        Returns: undefined
      }
      allocate_plan_credit: { Args: { p_plan_id: string }; Returns: undefined }
      approve_outreach_reward: {
        Args: { _approver_notes?: string; _reward_id: string }
        Returns: string
      }
      approve_team_member: { Args: { _staff_id: string }; Returns: undefined }
      assert_visit_clinically_complete: {
        Args: { p_visit_id: string }
        Returns: undefined
      }
      attach_intake_photos: {
        Args: {
          _client_id: string
          _outreach_id: string
          _paths: string[]
          _visit_id: string
        }
        Returns: number
      }
      attach_social_intake_photos: {
        Args: { _client_id: string; _paths: string[] }
        Returns: number
      }
      backfill_attribution_events: {
        Args: never
        Returns: {
          inserted: number
          kind: string
        }[]
      }
      backfill_revenue_allocations: { Args: never; Returns: number }
      can_manage_org_pricing: {
        Args: { _org: string; _user: string }
        Returns: boolean
      }
      can_manage_outreach: {
        Args: { _outreach_id: string; _user_id: string }
        Returns: boolean
      }
      can_read_org_scope: {
        Args: { _org: string; _user: string }
        Returns: boolean
      }
      can_receive_appointment: {
        Args: { _kind?: string; _user_id: string }
        Returns: boolean
      }
      cancel_pending_order_group: {
        Args: { _order_ref: string; _reason?: string }
        Returns: Json
      }
      cancel_pending_outreach_order: {
        Args: { _id: string; _reason?: string }
        Returns: Json
      }
      cancel_procurement_session: {
        Args: { _reason?: string; _session_id: string }
        Returns: undefined
      }
      cancel_scheduled_item: {
        Args: { p_reason: string; p_schedule_item_id: string }
        Returns: Json
      }
      capture_outreach_lead:
        | {
            Args: {
              _email?: string
              _full_name: string
              _gender?: string
              _marketing_consent?: boolean
              _notes?: string
              _outreach_id: string
              _phone: string
              _staff_id?: string
              _wants_consult?: boolean
            }
            Returns: Json
          }
        | {
            Args: { _outreach_id: string; _payload: Json; _staff_id: string }
            Returns: Json
          }
      claim_team_intent: { Args: never; Returns: Json }
      claim_visit: {
        Args: { p_visit_id: string }
        Returns: {
          amended_at: string | null
          amended_by: string | null
          amendment_reason: string | null
          appointment_id: string | null
          assigned_medical_expert_id: string | null
          attributed_to_user_id: string | null
          claimed_at: string | null
          claimed_by_staff_id: string | null
          client_id: string
          consultation_only_reason: string | null
          created_at: string
          discount_applied_at: string | null
          discount_applied_by: string | null
          duration_minutes: number | null
          final_total: number | null
          follow_up_decision: string | null
          follow_up_required: boolean | null
          id: string
          logged_by_staff_id: string | null
          manual_discount_amount: number | null
          manual_discount_reason: string | null
          manual_discount_type: string | null
          manual_discount_value: number | null
          next_appointment_recommended: boolean | null
          notes: string | null
          outcome: Database["public"]["Enums"]["visit_outcome"]
          payment_state: string | null
          promo_code_applied: string | null
          promo_discount_amount: number | null
          promo_discount_pct: number | null
          promo_staff_user_id: string | null
          reason_for_visit: Database["public"]["Enums"]["visit_reason"]
          reassignment_at: string | null
          reassignment_by_staff_id: string | null
          reassignment_reason: string | null
          recommendation_summary: string | null
          removal_group_id: string | null
          removal_reason: string | null
          removed_at: string | null
          removed_by: string | null
          safety_intake_id: string | null
          same_day_prior_visit_id: string | null
          second_visit_reason: string | null
          service_delivered: string | null
          sign_in_request_id: string | null
          sign_in_source: string | null
          sign_in_time: string
          sign_out_time: string | null
          signed_out_by_staff_id: string | null
          source_id: string | null
          source_type: string | null
          status: string
          treatment_completed_at: string | null
          treatment_completed_by: string | null
          treatment_completion_notes: string | null
          treatment_outcome: string | null
          treatment_plan_confirmed_at: string | null
          treatment_plan_confirmed_by: string | null
          treatment_plan_decision: string | null
          treatment_started_at: string | null
          treatment_started_by: string | null
          updated_at: string
          visit_date: string
          visit_type: string | null
        }
        SetofOptions: {
          from: "*"
          to: "client_visit_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_xcape_account_role: {
        Args: { _org_name?: string; _role: string }
        Returns: Json
      }
      cleanup_expired_booking_tokens: { Args: never; Returns: number }
      client_has_completed_consultation: {
        Args: { _client_id: string }
        Returns: boolean
      }
      client_integrity_preview: { Args: { p_client_id: string }; Returns: Json }
      client_is_contactable: { Args: { _client_id: string }; Returns: boolean }
      close_finished_goods_intake: {
        Args: { _intake_id: string; _reason?: string }
        Returns: undefined
      }
      complete_treatment: {
        Args: {
          p_consultation_only?: boolean
          p_reason?: string
          p_visit_id: string
        }
        Returns: Json
      }
      complete_treatment_v2: {
        Args: { p_payload: Json; p_visit_id: string }
        Returns: Json
      }
      compute_outreach_reward: {
        Args: { _outreach_id: string }
        Returns: number
      }
      compute_revenue_allocation: {
        Args: { _entry_id: string }
        Returns: undefined
      }
      confirm_finished_goods_intake: {
        Args: { _intake_id: string }
        Returns: string
      }
      confirm_payment_claim: {
        Args: {
          p_claim_id: string
          p_finance_date?: string
          p_review_note?: string
        }
        Returns: Json
      }
      confirm_pending_order_group: {
        Args: {
          _order_ref: string
          _payment_method?: string
          _payment_reference?: string
        }
        Returns: Json
      }
      confirm_pending_outreach_order: {
        Args: {
          _id: string
          _payment_method?: string
          _payment_reference?: string
        }
        Returns: Json
      }
      confirm_visit_delivery: {
        Args: {
          p_adhoc_items?: Json
          p_plan_selections?: Json
          p_product_selections?: Json
          p_start_now?: boolean
          p_underfunded_override_reason?: string
          p_validation_request_id?: string
          p_visit_id: string
        }
        Returns: Json
      }
      correct_finished_goods_intake: {
        Args: {
          _intake_id: string
          _intake_notes?: string
          _items: Json
          _reason: string
        }
        Returns: number
      }
      correct_inventory_batch: {
        Args: {
          _allow_remaining_over_produced?: boolean
          _batch_id: string
          _new_qty_produced: number
          _new_qty_remaining: number
          _new_unit_cost: number
          _reason: string
          _reconcile_historical_cogs?: boolean
        }
        Returns: string
      }
      count_active_aestheticians: { Args: never; Returns: number }
      create_pending_outreach_order:
        | {
            Args: {
              _attributed_staff_id?: string
              _customer_name?: string
              _customer_phone: string
              _notes?: string
              _outreach_id: string
              _payment_method?: string
              _payment_reference?: string
              _product_id: string
              _quantity: number
              _unit_price: number
            }
            Returns: Json
          }
        | {
            Args: {
              _attributed_staff_id?: string
              _customer_name?: string
              _customer_phone: string
              _formula_snapshot_id?: string
              _notes?: string
              _outreach_id: string
              _payment_method?: string
              _payment_reference?: string
              _product_id: string
              _quantity: number
              _unit_price: number
            }
            Returns: Json
          }
      create_public_analysis_session: {
        Args: {
          _capture_method: string
          _ip_hmac: string
          _max_per_hour: number
          _purge_seconds: number
          _token_hash: string
          _ttl_seconds: number
          _ua_hmac: string
        }
        Returns: {
          expires_at: string
          rate_limited: boolean
          session_id: string
        }[]
      }
      current_impersonation: {
        Args: never
        Returns: {
          admin_user_id: string
          effective_staff_id: string
          expires_at: string
          reason: string
          session_id: string
          started_at: string
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      emit_notification: {
        Args: {
          _body: string
          _category: string
          _include_admins?: boolean
          _include_subject?: boolean
          _kind: string
          _metadata: Json
          _recipient_user_ids: string[]
          _severity: string
          _subject_user_id: string
          _target_id: string
          _target_table: string
          _title: string
        }
        Returns: string
      }
      end_impersonation: { Args: { session_id: string }; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_routines_for_today: {
        Args: { _staff_id: string }
        Returns: number
      }
      evaluate_membership_tier: {
        Args: { _client_id: string }
        Returns: Database["public"]["Enums"]["membership_type"]
      }
      finalise_visit_signout: {
        Args: {
          p_collected: number
          p_follow_up_required?: boolean
          p_manual_discount_reason?: string
          p_manual_discount_type?: string
          p_manual_discount_value?: number
          p_next_appointment_recommended?: boolean
          p_notes?: string
          p_outcome: string
          p_payment_state: string
          p_promo_code?: string
          p_service_delivered?: string
          p_treatment_completed?: boolean
          p_visit_id: string
        }
        Returns: Json
      }
      generate_client_code: { Args: never; Returns: string }
      get_finished_goods_intake_report: {
        Args: { _intake_id: string }
        Returns: {
          cogs: number
          estimated_gross_margin_pct: number
          estimated_unit_cost: number
          gross_profit: number
          intake_item_id: string
          ordered: number
          pending: number
          product_id: string
          product_name: string
          received: number
          remaining: number
          revenue: number
          selling_price: number
          sold: number
        }[]
      }
      get_outreach_by_slug: {
        Args: { _slug: string }
        Returns: {
          end_time: string
          id: string
          initiator_staff_id: string
          intake_slug: string
          location: string
          name: string
          outreach_date: string
          public_intake_enabled: boolean
          start_time: string
          status: string
        }[]
      }
      get_payment_instructions: {
        Args: never
        Returns: {
          account_name: string
          account_number: string
          bank_name: string
          instructions_markdown: string
          whatsapp_number: string
        }[]
      }
      get_staff_by_slug: {
        Args: { _slug: string }
        Returns: {
          booking_slug: string
          calendly_event_url: string
          full_name: string
          id: string
        }[]
      }
      has_client_touchpoint: {
        Args: { _client: string; _user: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_section_access: {
        Args: { _section: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_assigned_to_outreach: {
        Args: { _outreach_id: string; _user_id: string }
        Returns: boolean
      }
      is_clinical_writer: { Args: { _uid: string }; Returns: boolean }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      is_task_collaborator: {
        Args: { _task_id: string; _task_type: string; _user_id: string }
        Returns: boolean
      }
      is_task_owner: {
        Args: { _task_id: string; _task_type: string; _user_id: string }
        Returns: boolean
      }
      list_eligible_receivers: {
        Args: { _kind?: string }
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      list_public_analysis_image_purge: {
        Args: { _limit?: number }
        Returns: {
          id: string
          image_paths: string[]
        }[]
      }
      log_accountability_event: {
        Args: {
          _appointment_id?: string
          _appt_total?: number
          _client_id?: string
          _kind: string
          _notes?: string
          _source?: string
          _staff_user_id: string
        }
        Returns: string
      }
      log_impersonated_action: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_table?: string
          p_payload?: Json
          p_session_id: string
        }
        Returns: undefined
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
      outreach_checklist_missing: { Args: { _id: string }; Returns: string[] }
      perform_scheduled_item: {
        Args: {
          p_note?: string
          p_override_reason?: string
          p_override_underfunding?: boolean
          p_schedule_item_id: string
          p_visit_id?: string
        }
        Returns: Json
      }
      physical_stock_count_adjustment: {
        Args: {
          _actual_count: number
          _product_id: string
          _reason: string
          _target_batch_id?: string
          _unit_cost_for_increase?: number
        }
        Returns: string
      }
      pipeline_stage_rank: {
        Args: { _s: Database["public"]["Enums"]["pipeline_stage"] }
        Returns: number
      }
      primary_org_id: { Args: { _user: string }; Returns: string }
      produce_batch_v2: {
        Args: {
          _notes?: string
          _quantity_produced: number
          _recipe_version_id: string
        }
        Returns: string
      }
      produce_inventory_batch: {
        Args: {
          _notes?: string
          _product_cost_id?: string
          _product_id: string
          _quantity: number
        }
        Returns: string
      }
      public_analysis_claim_lead: {
        Args: {
          p_consent?: boolean
          p_email?: string
          p_full_name: string
          p_phone: string
          p_token_hash: string
        }
        Returns: Json
      }
      public_analysis_claim_run: {
        Args: {
          p_idempotency_key: string
          p_retry?: boolean
          p_token_hash: string
        }
        Returns: Json
      }
      public_analysis_commit_view: {
        Args: { p_meta: Json; p_token_hash: string; p_view: string }
        Returns: Json
      }
      public_analysis_complete_run: {
        Args: {
          p_ai_result: Json
          p_engine: Json
          p_engine_version: string
          p_prompt_version: string
          p_session_id: string
          p_worker_lease: string
        }
        Returns: Json
      }
      public_analysis_fail_run: {
        Args: {
          p_failure_code: string
          p_session_id: string
          p_worker_lease: string
        }
        Returns: Json
      }
      public_analysis_heartbeat: {
        Args: { p_session_id: string; p_worker_lease: string }
        Returns: Json
      }
      public_analysis_issue_view: {
        Args: { p_token_hash: string; p_view: string }
        Returns: Json
      }
      public_analysis_report: { Args: { p_token_hash: string }; Returns: Json }
      public_analysis_resolve_view: {
        Args: { p_token_hash: string; p_view: string }
        Returns: Json
      }
      public_analysis_set_phase: {
        Args: { p_phase: string; p_session_id: string; p_worker_lease: string }
        Returns: Json
      }
      public_analysis_status: { Args: { p_token_hash: string }; Returns: Json }
      public_analysis_store_protocol_snapshot: {
        Args: { p_assessment_id: string; p_snapshot: Json }
        Returns: Json
      }
      purge_public_analysis_expired: { Args: never; Returns: Json }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reassign_visit_practitioner: {
        Args: {
          p_new_practitioner_id: string
          p_reason?: string
          p_visit_id: string
        }
        Returns: {
          amended_at: string | null
          amended_by: string | null
          amendment_reason: string | null
          appointment_id: string | null
          assigned_medical_expert_id: string | null
          attributed_to_user_id: string | null
          claimed_at: string | null
          claimed_by_staff_id: string | null
          client_id: string
          consultation_only_reason: string | null
          created_at: string
          discount_applied_at: string | null
          discount_applied_by: string | null
          duration_minutes: number | null
          final_total: number | null
          follow_up_decision: string | null
          follow_up_required: boolean | null
          id: string
          logged_by_staff_id: string | null
          manual_discount_amount: number | null
          manual_discount_reason: string | null
          manual_discount_type: string | null
          manual_discount_value: number | null
          next_appointment_recommended: boolean | null
          notes: string | null
          outcome: Database["public"]["Enums"]["visit_outcome"]
          payment_state: string | null
          promo_code_applied: string | null
          promo_discount_amount: number | null
          promo_discount_pct: number | null
          promo_staff_user_id: string | null
          reason_for_visit: Database["public"]["Enums"]["visit_reason"]
          reassignment_at: string | null
          reassignment_by_staff_id: string | null
          reassignment_reason: string | null
          recommendation_summary: string | null
          removal_group_id: string | null
          removal_reason: string | null
          removed_at: string | null
          removed_by: string | null
          safety_intake_id: string | null
          same_day_prior_visit_id: string | null
          second_visit_reason: string | null
          service_delivered: string | null
          sign_in_request_id: string | null
          sign_in_source: string | null
          sign_in_time: string
          sign_out_time: string | null
          signed_out_by_staff_id: string | null
          source_id: string | null
          source_type: string | null
          status: string
          treatment_completed_at: string | null
          treatment_completed_by: string | null
          treatment_completion_notes: string | null
          treatment_outcome: string | null
          treatment_plan_confirmed_at: string | null
          treatment_plan_confirmed_by: string | null
          treatment_plan_decision: string | null
          treatment_started_at: string | null
          treatment_started_by: string | null
          updated_at: string
          visit_date: string
          visit_type: string | null
        }
        SetofOptions: {
          from: "*"
          to: "client_visit_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rebuild_treatment_plan_projection: {
        Args: { p_plan_id: string; p_reason?: string }
        Returns: undefined
      }
      receive_more_finished_goods: {
        Args: {
          _intake_item_id: string
          _notes?: string
          _qty: number
          _unit_cost: number
        }
        Returns: string
      }
      receive_procurement_session: {
        Args: { _session_id: string }
        Returns: string
      }
      recompute_outreach_totals: {
        Args: { _outreach_id: string }
        Returns: undefined
      }
      recompute_procurement_totals: {
        Args: { _session_id: string }
        Returns: undefined
      }
      reconcile_distribution_run: {
        Args: { _items: Json; _run_id: string; _run_notes?: string }
        Returns: undefined
      }
      reconcile_visit_finance: {
        Args: { p_allow_invent_cash?: boolean; p_visit_id: string }
        Returns: undefined
      }
      reconcile_visit_finance_unsafe: {
        Args: { p_visit_id: string }
        Returns: number
      }
      record_assisted_payment_claim: {
        Args: {
          p_amount: number
          p_client_present: boolean
          p_payment_method: string
          p_payment_reference: string
          p_staff_note: string
          p_submission_channel: string
          p_submission_source: string
          p_treatment_plan_id: string
        }
        Returns: string
      }
      record_attribution_event: {
        Args: {
          p_actor_staff_id?: string
          p_amount_naira?: number
          p_client_id: string
          p_dedupe_key?: string
          p_kind: Database["public"]["Enums"]["attribution_event_kind"]
          p_occurred_at?: string
          p_outreach_id?: string
          p_owner_staff_id?: string
          p_quantity?: number
          p_source_context?: Json
          p_visit_id?: string
        }
        Returns: string
      }
      record_outreach_sale: {
        Args: {
          _attributed_staff_id?: string
          _customer_name?: string
          _customer_phone: string
          _notes?: string
          _outreach_id: string
          _payment_method?: string
          _payment_reference?: string
          _payment_status?: string
          _product_id: string
          _quantity: number
          _unit_price: number
        }
        Returns: Json
      }
      reject_outreach_reward: {
        Args: { _reason?: string; _reward_id: string }
        Returns: undefined
      }
      reject_payment_claim: {
        Args: { p_claim_id: string; p_review_note?: string; p_status: string }
        Returns: Json
      }
      reschedule_treatment_item: {
        Args: {
          p_new_date: string
          p_new_time: string
          p_notes?: string
          p_practitioner_id?: string
          p_schedule_item_id: string
        }
        Returns: Json
      }
      resolve_attribution_owner: {
        Args: { p_actor_staff_id: string; p_client_id: string }
        Returns: string
      }
      resolve_promo_code: {
        Args: { _code: string }
        Returns: {
          active: boolean
          discount_pct: number
          full_name: string
          promo_code: string
          staff_user_id: string
        }[]
      }
      resolve_service_system_price: {
        Args: { p_at?: string; p_service_id: string }
        Returns: Json
      }
      resolve_signout_discount: {
        Args: {
          p_manual_type?: string
          p_manual_value?: number
          p_promo_code?: string
          p_visit_id: string
        }
        Returns: Json
      }
      rpc_my_promo_stats: {
        Args: { _from?: string; _to?: string }
        Returns: {
          conversions: number
          redemptions: number
          reports_shared: number
          revenue_attributed: number
          unique_visitors: number
        }[]
      }
      schedule_treatment_item: {
        Args: {
          p_date: string
          p_duration_minutes?: number
          p_notes?: string
          p_practitioner_id: string
          p_schedule_item_id: string
          p_time: string
        }
        Returns: Json
      }
      sequence_treatment_plan: {
        Args: { p_items: Json; p_plan_id: string }
        Returns: Json
      }
      set_cdp_fee_status: {
        Args: {
          _amount?: number
          _org_id: string
          _reference?: string
          _status: string
        }
        Returns: Json
      }
      set_xcape_admin_settings: {
        Args: {
          _affiliate_split_percentage?: number
          _cdp_required_fee?: number
        }
        Returns: Json
      }
      set_xcape_partner_status: {
        Args: { _org_id: string; _status: string }
        Returns: Json
      }
      sign_in_client_v2: {
        Args: {
          p_allow_second_same_day?: boolean
          p_appointment_id?: string
          p_assigned_medical_expert_id?: string
          p_attributed_to_user_id?: string
          p_client_id: string
          p_logged_by_staff_id?: string
          p_notes?: string
          p_reason_for_visit?: string
          p_request_id?: string
          p_second_visit_reason?: string
          p_sign_in_source?: string
          p_source_id?: string
          p_source_type?: string
          p_visit_type?: string
        }
        Returns: Json
      }
      skip_scheduled_item: {
        Args: {
          p_reason: string
          p_release_credit?: boolean
          p_schedule_item_id: string
        }
        Returns: Json
      }
      start_distribution_run: { Args: { _run_id: string }; Returns: undefined }
      start_impersonation: {
        Args: { reason: string; target_staff_id: string }
        Returns: string
      }
      start_schedule_item: {
        Args: { p_schedule_item_id: string; p_visit_id: string }
        Returns: Json
      }
      start_treatment: { Args: { p_visit_id: string }; Returns: Json }
      submit_public_cart_order: {
        Args: {
          _attributed_staff_id?: string
          _customer_email?: string
          _customer_name: string
          _customer_phone: string
          _delivery_address?: string
          _delivery_method?: string
          _items: Json
          _notes?: string
          _order_ref?: string
          _outreach_id?: string
          _promo_code?: string
          _referral_staff_id?: string
        }
        Returns: Json
      }
      submit_public_cart_order_from_report: {
        Args: {
          _attributed_staff_id?: string
          _customer_email?: string
          _customer_name: string
          _customer_phone: string
          _delivery_address?: string
          _delivery_method?: string
          _items: Json
          _notes?: string
          _order_ref?: string
          _outreach_id?: string
          _promo_code?: string
          _referral_staff_id?: string
          _report_token: string
        }
        Returns: Json
      }
      submit_public_product_order: {
        Args: {
          _customer_email?: string
          _customer_name: string
          _customer_phone: string
          _notes?: string
          _outreach_id?: string
          _payment_method?: string
          _product_id: string
          _quantity: number
          _referral_staff_id?: string
        }
        Returns: Json
      }
      submit_report_momo_order: {
        Args: {
          _amount_sent: number
          _buyer_email?: string
          _buyer_name: string
          _buyer_phone: string
          _items: Json
          _notes?: string
          _payment_reference?: string
          _report_token: string
          _sender_phone: string
        }
        Returns: Json
      }
      sync_plan_appointments: {
        Args: {
          p_assigned_aesthetician_id?: string
          p_default_time?: string
          p_duration_minutes?: number
          p_plan_id: string
        }
        Returns: Json
      }
      tpsi_is_locked: { Args: { p_status: string }; Returns: boolean }
      transition_outreach: {
        Args: { _id: string; _to: string }
        Returns: {
          approval_notes: string | null
          approved_at: string | null
          approved_by_user_id: string | null
          capture_lead_user_id: string | null
          closed_at: string | null
          closed_by_user_id: string | null
          closer_user_id: string | null
          completed_at: string | null
          coordinator_user_id: string | null
          created_at: string
          created_by: string | null
          end_time: string | null
          equipment_list: string[] | null
          estimated_budget: number | null
          expected_analyses: number | null
          expected_attendance: number | null
          expected_bookings: number | null
          expected_leads: number | null
          expected_sales: number | null
          follow_up_owner_user_id: string | null
          id: string
          initiator_staff_id: string | null
          intake_slug: string | null
          location: string | null
          logistics_user_id: string | null
          materials_list: string[] | null
          name: string
          net_profit: number
          notes: string | null
          objective: string | null
          outreach_date: string
          outreach_type: string
          product_handler_user_id: string | null
          public_intake_enabled: boolean
          reconciled_at: string | null
          reconciled_by: string | null
          resources_not_required: boolean
          reward_amount: number
          skin_analyst_user_id: string | null
          start_time: string | null
          started_at: string | null
          status: string
          submitted_at: string | null
          submitted_by_user_id: string | null
          total_cogs: number
          total_leads: number
          total_op_expense: number
          total_revenue: number
          updated_at: string
          venue_contact_name: string | null
          venue_contact_phone: string | null
        }
        SetofOptions: {
          from: "*"
          to: "outreach_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      user_org_ids: { Args: { _user: string }; Returns: string[] }
      validate_public_promo_code: { Args: { _code: string }; Returns: Json }
      validate_visit_reconciled: {
        Args: { p_visit_id: string }
        Returns: {
          agreed_total: number
          drift: number
          is_reconciled: boolean
          revenue_recognized: number
          visit_id: string
        }[]
      }
      verify_cron_secret: { Args: { candidate: string }; Returns: boolean }
      visit_finance_netting: { Args: { p_visit_id: string }; Returns: Json }
      xcape_admin_customization_usage: {
        Args: { _from?: string; _org_id?: string; _to?: string }
        Returns: {
          active_name: string
          active_product_id: string
          approved_formula_count: number
          category: string
          cdp_org_id: string
          cdp_org_name: string
          companion_name: string
          companion_product_id: string
          first_approved_at: string
          kit_name: string
          kit_product_id: string
          last_approved_at: string
          total_combined_ml: number
          total_companion_dose_ml: number
          total_dose_ml: number
        }[]
      }
      xcape_affiliate_split_pct: { Args: never; Returns: number }
      xcape_archive_client: {
        Args: { _actor: string; _client_id: string }
        Returns: Json
      }
      xcape_authorization_state: { Args: { _user?: string }; Returns: Json }
      xcape_build_report_commercial_snapshot: {
        Args: { _link_id: string }
        Returns: Json
      }
      xcape_fulfil_report_order: { Args: { _claim_id: string }; Returns: Json }
      xcape_get_commerce_settings: { Args: never; Returns: Json }
      xcape_is_authorized: { Args: { _user?: string }; Returns: boolean }
      xcape_lookup_client_by_phone: {
        Args: { _phone: string }
        Returns: {
          already_accessible: boolean
          assessment_count: number
          created_at: string
          full_name: string
          id: string
          phone_masked: string
        }[]
      }
      xcape_mark_client_media_purged: {
        Args: { _client_id: string; _error?: string; _status: string }
        Returns: undefined
      }
      xcape_may_access_assessment_media: {
        Args: { _actor: string; _assessment_id: string }
        Returns: boolean
      }
      xcape_may_archive_client: {
        Args: { _actor: string; _client_id: string }
        Returns: boolean
      }
      xcape_may_manage_pending_order: {
        Args: { _pending_order_id: string }
        Returns: boolean
      }
      xcape_may_review_claim: { Args: { _claim_id: string }; Returns: boolean }
      xcape_media_path_parts: { Args: { _name: string }; Returns: string[] }
      xcape_my_commerce_org: { Args: never; Returns: string }
      xcape_normalise_phone: { Args: { _raw: string }; Returns: string }
      xcape_phone_key: {
        Args: { _default_dial?: string; _raw: string }
        Returns: string
      }
      xcape_reject_payment_claim: {
        Args: { _claim_id: string; _reason: string }
        Returns: Json
      }
      xcape_report_context: { Args: { _token: string }; Returns: Json }
      xcape_report_eligible_product: {
        Args: { _assessment_id: string; _product_id: string }
        Returns: boolean
      }
      xcape_report_merchant_org: { Args: { _token: string }; Returns: string }
      xcape_required_cdp_fee: { Args: never; Returns: number }
      xcape_resolved_price: {
        Args: { _org: string; _product: string }
        Returns: number
      }
      xcape_retail_price_book: {
        Args: never
        Returns: {
          currency: string
          default_price: number
          image_url: string
          name: string
          org_id: string
          org_kind: string
          override_price: number
          product_id: string
          resolved_price: number
          sku: string
        }[]
      }
      xcape_retail_skus: { Args: never; Returns: string[] }
      xcape_reuse_client: {
        Args: { _client_id: string; _phone: string }
        Returns: {
          acquisition_locked: boolean
          acquisition_owner_id: string | null
          age_group: string | null
          archived: boolean
          archived_at: string | null
          archived_by: string | null
          attributed_staff_id: string | null
          captured_via: string | null
          client_code: string
          consent_captured_at: string | null
          consent_given_at: string | null
          consent_status: string
          consultation_owner_id: string | null
          created_at: string
          dob: string | null
          email: string | null
          first_seen_at: string | null
          full_name: string
          gender: string | null
          id: string
          intake_source: string | null
          intake_source_other: string | null
          is_demo: boolean
          last_contact_date: string | null
          last_interaction_at: string | null
          location: string | null
          marketing_consent: boolean
          media_purge_error: string | null
          media_purge_status: string | null
          media_purged_at: string | null
          membership_type: Database["public"]["Enums"]["membership_type"]
          normalized_phone: string | null
          notes: string | null
          origin_org_id: string | null
          origin_role: string | null
          origin_user_id: string | null
          original_source: string | null
          outreach_id: string | null
          phone: string | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"]
          recurring_owner_id: string | null
          referral_meta: Json
          skin_analysis: Json | null
          source_type: string | null
          status: Database["public"]["Enums"]["client_status"]
          tier_since: string | null
          treatment_plan: Json | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "clients"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      xcape_root_org_id: { Args: never; Returns: string }
      xcape_set_default_price: {
        Args: { _price: number; _product_id: string }
        Returns: undefined
      }
      xcape_set_org_price: {
        Args: { _price: number; _product_id: string }
        Returns: undefined
      }
      xcape_setting_num: {
        Args: { _default: number; _field: string; _key: string }
        Returns: number
      }
      xcape_unit_price: {
        Args: { _merchant_org: string; _product_id: string }
        Returns: number
      }
      xcape_update_commerce_settings: {
        Args: {
          _commerce_enabled: boolean
          _momo_provider?: string
          _momo_recipient_name?: string
          _momo_recipient_number?: string
          _order_contact_phone?: string
          _whatsapp_number?: string
        }
        Returns: Json
      }
      xcape_verify_payment_claim: {
        Args: { _claim_id: string; _note?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "front_desk"
        | "medical_aesthetician"
        | "cleaner"
        | "outreach"
        | "team"
        | "affiliate"
        | "cdp"
      appointment_status:
        | "scheduled"
        | "arrived"
        | "completed"
        | "cancelled"
        | "no_show"
      attendance_status: "signed_in" | "signed_out" | "absent"
      attribution_event_kind:
        | "lead_captured"
        | "outreach_signed_in"
        | "assessment_completed"
        | "report_link_created"
        | "report_shared"
        | "report_viewed"
        | "treatment_started"
        | "treatment_completed"
        | "visit_signed_out"
        | "sale_recorded"
        | "promo_redeemed"
        | "commission_earned"
        | "follow_up_logged"
        | "client_converted"
        | "client_reattributed"
        | "sale_voided"
      calendar_event_type:
        | "appointment"
        | "client_walk_in"
        | "client_sign_out"
        | "staff_sign_in"
        | "staff_sign_out"
        | "internal_task"
        | "follow_up"
        | "client_event"
      client_status:
        | "lead"
        | "contacted"
        | "booked"
        | "converted"
        | "member"
        | "elite"
        | "inactive"
        | "new_lead"
        | "consultation_booked"
        | "scheduled"
        | "payment_pending"
        | "follow_up_required"
        | "renewal_due"
        | "no_show"
        | "not_reached"
      deliverable_priority: "low" | "medium" | "high" | "urgent"
      deliverable_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "skipped"
        | "awaiting_verification"
        | "verified"
        | "failed"
        | "blocked"
      inventory_category: "consumable" | "retail"
      inventory_movement_kind:
        | "receive"
        | "usage"
        | "sale"
        | "adjustment"
        | "waste"
      membership_type: "none" | "one_time" | "member" | "elite"
      operational_event_kind:
        | "visit_checkout"
        | "outreach_sale"
        | "public_cart"
        | "product_sale"
        | "payment_claim_confirm"
        | "complimentary_grant"
        | "stock_intake"
        | "correction_amend"
        | "correction_remove"
        | "correction_restore"
      operational_event_status:
        | "pending"
        | "committed"
        | "superseded"
        | "voided"
      operational_reconciliation_state:
        | "ok"
        | "warning"
        | "blocked"
        | "corrected"
        | "legacy"
      pipeline_stage:
        | "new"
        | "contacted"
        | "interested"
        | "booked"
        | "showed"
        | "paid"
        | "lost"
      product_movement_kind:
        | "produce"
        | "sale"
        | "waste"
        | "adjustment"
        | "opening_stock"
      routine_status: "pending" | "completed" | "skipped"
      staff_status: "active" | "inactive" | "invited"
      visit_outcome:
        | "completed_consultation"
        | "booked_appointment"
        | "treatment_completed"
        | "purchased_product"
        | "no_conversion"
        | "follow_up_required"
        | "pending"
        | "analysis_incomplete"
        | "left_before_analysis"
        | "interest_only"
        | "recommendations_given"
        | "clinic_follow_up_booked"
      visit_reason:
        | "consultation"
        | "treatment"
        | "follow_up"
        | "product_purchase"
        | "walk_in_enquiry"
        | "other"
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
      app_role: [
        "admin",
        "front_desk",
        "medical_aesthetician",
        "cleaner",
        "outreach",
        "team",
        "affiliate",
        "cdp",
      ],
      appointment_status: [
        "scheduled",
        "arrived",
        "completed",
        "cancelled",
        "no_show",
      ],
      attendance_status: ["signed_in", "signed_out", "absent"],
      attribution_event_kind: [
        "lead_captured",
        "outreach_signed_in",
        "assessment_completed",
        "report_link_created",
        "report_shared",
        "report_viewed",
        "treatment_started",
        "treatment_completed",
        "visit_signed_out",
        "sale_recorded",
        "promo_redeemed",
        "commission_earned",
        "follow_up_logged",
        "client_converted",
        "client_reattributed",
        "sale_voided",
      ],
      calendar_event_type: [
        "appointment",
        "client_walk_in",
        "client_sign_out",
        "staff_sign_in",
        "staff_sign_out",
        "internal_task",
        "follow_up",
        "client_event",
      ],
      client_status: [
        "lead",
        "contacted",
        "booked",
        "converted",
        "member",
        "elite",
        "inactive",
        "new_lead",
        "consultation_booked",
        "scheduled",
        "payment_pending",
        "follow_up_required",
        "renewal_due",
        "no_show",
        "not_reached",
      ],
      deliverable_priority: ["low", "medium", "high", "urgent"],
      deliverable_status: [
        "pending",
        "in_progress",
        "completed",
        "skipped",
        "awaiting_verification",
        "verified",
        "failed",
        "blocked",
      ],
      inventory_category: ["consumable", "retail"],
      inventory_movement_kind: [
        "receive",
        "usage",
        "sale",
        "adjustment",
        "waste",
      ],
      membership_type: ["none", "one_time", "member", "elite"],
      operational_event_kind: [
        "visit_checkout",
        "outreach_sale",
        "public_cart",
        "product_sale",
        "payment_claim_confirm",
        "complimentary_grant",
        "stock_intake",
        "correction_amend",
        "correction_remove",
        "correction_restore",
      ],
      operational_event_status: [
        "pending",
        "committed",
        "superseded",
        "voided",
      ],
      operational_reconciliation_state: [
        "ok",
        "warning",
        "blocked",
        "corrected",
        "legacy",
      ],
      pipeline_stage: [
        "new",
        "contacted",
        "interested",
        "booked",
        "showed",
        "paid",
        "lost",
      ],
      product_movement_kind: [
        "produce",
        "sale",
        "waste",
        "adjustment",
        "opening_stock",
      ],
      routine_status: ["pending", "completed", "skipped"],
      staff_status: ["active", "inactive", "invited"],
      visit_outcome: [
        "completed_consultation",
        "booked_appointment",
        "treatment_completed",
        "purchased_product",
        "no_conversion",
        "follow_up_required",
        "pending",
        "analysis_incomplete",
        "left_before_analysis",
        "interest_only",
        "recommendations_given",
        "clinic_follow_up_booked",
      ],
      visit_reason: [
        "consultation",
        "treatment",
        "follow_up",
        "product_purchase",
        "walk_in_enquiry",
        "other",
      ],
    },
  },
} as const
