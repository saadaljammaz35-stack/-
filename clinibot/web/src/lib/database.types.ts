// Generated from the live Supabase project (clpfcrsoxokhcbrzxgkt) with
// `supabase gen types typescript`, then patched by hand where marked
// "MANUAL" (functions from supabase/manual/ that are not applied yet).
// Regenerate after every migration:
//   npx supabase gen types typescript --project-id clpfcrsoxokhcbrzxgkt > src/lib/database.types.ts
// and re-apply the MANUAL block if those functions are still missing.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      ai_usage_monthly: {
        Row: {
          input_tokens: number;
          month: string;
          organization_id: string;
          output_tokens: number;
          replies: number;
          test_replies: number;
          updated_at: string;
        };
        Insert: {
          input_tokens?: number;
          month: string;
          organization_id: string;
          output_tokens?: number;
          replies?: number;
          test_replies?: number;
          updated_at?: string;
        };
        Update: {
          input_tokens?: number;
          month?: string;
          organization_id?: string;
          output_tokens?: number;
          replies?: number;
          test_replies?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_usage_monthly_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      appointment_request_notes: {
        Row: {
          appointment_request_id: string;
          author_id: string | null;
          body: string;
          created_at: string;
          id: string;
          organization_id: string;
        };
        Insert: {
          appointment_request_id: string;
          author_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          organization_id: string;
        };
        Update: {
          appointment_request_id?: string;
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_request_notes_appointment_request_id_organizat_fkey";
            columns: ["appointment_request_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "appointment_requests";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      appointment_requests: {
        Row: {
          assigned_to: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          confirmed_at: string | null;
          confirmed_by: string | null;
          conversation_id: string | null;
          created_at: string;
          created_by: string | null;
          customer_name: string;
          customer_notes: string | null;
          customer_notified_at: string | null;
          customer_phone: string;
          id: string;
          organization_id: string;
          preferred_date: string | null;
          preferred_time_window: string;
          scheduled_for: string | null;
          service_id: string | null;
          source: string;
          status: Database["public"]["Enums"]["appointment_status"];
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_name: string;
          customer_notes?: string | null;
          customer_notified_at?: string | null;
          customer_phone: string;
          id?: string;
          organization_id: string;
          preferred_date?: string | null;
          preferred_time_window?: string;
          scheduled_for?: string | null;
          service_id?: string | null;
          source?: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_name?: string;
          customer_notes?: string | null;
          customer_notified_at?: string | null;
          customer_phone?: string;
          id?: string;
          organization_id?: string;
          preferred_date?: string | null;
          preferred_time_window?: string;
          scheduled_for?: string | null;
          service_id?: string | null;
          source?: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_requests_conversation_id_organization_id_fkey";
            columns: ["conversation_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "appointment_requests_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_requests_service_id_organization_id_fkey";
            columns: ["service_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "clinic_services";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      approved_faqs: {
        Row: {
          answer_ar: string | null;
          answer_en: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          organization_id: string;
          question_ar: string | null;
          question_en: string | null;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          answer_ar?: string | null;
          answer_en?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          organization_id: string;
          question_ar?: string | null;
          question_en?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          answer_ar?: string | null;
          answer_en?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          organization_id?: string;
          question_ar?: string | null;
          question_en?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approved_faqs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_type: string;
          actor_user_id: string | null;
          created_at: string;
          details: Json;
          entity_id: string | null;
          entity_type: string | null;
          id: number;
          organization_id: string | null;
        };
        Insert: {
          action: string;
          actor_type: string;
          actor_user_id?: string | null;
          created_at?: string;
          details?: Json;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: never;
          organization_id?: string | null;
        };
        Update: {
          action?: string;
          actor_type?: string;
          actor_user_id?: string | null;
          created_at?: string;
          details?: Json;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: never;
          organization_id?: string | null;
        };
        Relationships: [];
      };
      clinic_services: {
        Row: {
          created_at: string;
          description_ar: string | null;
          description_en: string | null;
          duration_minutes: number | null;
          id: string;
          is_active: boolean;
          name_ar: string | null;
          name_en: string | null;
          organization_id: string;
          price_sar: number | null;
          price_type: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description_ar?: string | null;
          description_en?: string | null;
          duration_minutes?: number | null;
          id?: string;
          is_active?: boolean;
          name_ar?: string | null;
          name_en?: string | null;
          organization_id: string;
          price_sar?: number | null;
          price_type?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description_ar?: string | null;
          description_en?: string | null;
          duration_minutes?: number | null;
          id?: string;
          is_active?: boolean;
          name_ar?: string | null;
          name_en?: string | null;
          organization_id?: string;
          price_sar?: number | null;
          price_type?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clinic_services_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      clinic_settings: {
        Row: {
          address_ar: string | null;
          address_en: string | null;
          ai_last_test_at: string | null;
          ai_last_test_ok: boolean | null;
          appointment_retention_days: number;
          assistant_enabled: boolean;
          assistant_name: string;
          assistant_tone: string;
          created_at: string;
          display_name_ar: string | null;
          display_name_en: string | null;
          emergency_number: string;
          extra_instructions: string | null;
          maps_url: string | null;
          message_retention_days: number;
          organization_id: string;
          privacy_notice_ar: string | null;
          privacy_notice_en: string | null;
          public_chat_enabled: boolean;
          reception_phone: string | null;
          timezone: string;
          updated_at: string;
          updated_by: string | null;
          welcome_message_ar: string | null;
          welcome_message_en: string | null;
          working_hours: Json;
          working_hours_note_ar: string | null;
          working_hours_note_en: string | null;
        };
        Insert: {
          address_ar?: string | null;
          address_en?: string | null;
          ai_last_test_at?: string | null;
          ai_last_test_ok?: boolean | null;
          appointment_retention_days?: number;
          assistant_enabled?: boolean;
          assistant_name?: string;
          assistant_tone?: string;
          created_at?: string;
          display_name_ar?: string | null;
          display_name_en?: string | null;
          emergency_number?: string;
          extra_instructions?: string | null;
          maps_url?: string | null;
          message_retention_days?: number;
          organization_id: string;
          privacy_notice_ar?: string | null;
          privacy_notice_en?: string | null;
          public_chat_enabled?: boolean;
          reception_phone?: string | null;
          timezone?: string;
          updated_at?: string;
          updated_by?: string | null;
          welcome_message_ar?: string | null;
          welcome_message_en?: string | null;
          working_hours?: Json;
          working_hours_note_ar?: string | null;
          working_hours_note_en?: string | null;
        };
        Update: {
          address_ar?: string | null;
          address_en?: string | null;
          ai_last_test_at?: string | null;
          ai_last_test_ok?: boolean | null;
          appointment_retention_days?: number;
          assistant_enabled?: boolean;
          assistant_name?: string;
          assistant_tone?: string;
          created_at?: string;
          display_name_ar?: string | null;
          display_name_en?: string | null;
          emergency_number?: string;
          extra_instructions?: string | null;
          maps_url?: string | null;
          message_retention_days?: number;
          organization_id?: string;
          privacy_notice_ar?: string | null;
          privacy_notice_en?: string | null;
          public_chat_enabled?: boolean;
          reception_phone?: string | null;
          timezone?: string;
          updated_at?: string;
          updated_by?: string | null;
          welcome_message_ar?: string | null;
          welcome_message_en?: string | null;
          working_hours?: Json;
          working_hours_note_ar?: string | null;
          working_hours_note_en?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clinic_settings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          ai_paused: boolean;
          assigned_to: string | null;
          channel: Database["public"]["Enums"]["conversation_channel"];
          consent_at: string | null;
          created_at: string;
          customer_name: string | null;
          customer_wa_id: string | null;
          first_inbound_at: string | null;
          first_response_at: string | null;
          handoff_reason: string | null;
          id: string;
          language: string | null;
          last_inbound_at: string | null;
          last_message_at: string | null;
          last_message_direction: Database["public"]["Enums"]["message_direction"] | null;
          opted_out_at: string | null;
          organization_id: string;
          privacy_notice_sent_at: string | null;
          status: Database["public"]["Enums"]["conversation_status"];
          updated_at: string;
          web_session_hash: string | null;
        };
        Insert: {
          ai_paused?: boolean;
          assigned_to?: string | null;
          channel: Database["public"]["Enums"]["conversation_channel"];
          consent_at?: string | null;
          created_at?: string;
          customer_name?: string | null;
          customer_wa_id?: string | null;
          first_inbound_at?: string | null;
          first_response_at?: string | null;
          handoff_reason?: string | null;
          id?: string;
          language?: string | null;
          last_inbound_at?: string | null;
          last_message_at?: string | null;
          last_message_direction?: Database["public"]["Enums"]["message_direction"] | null;
          opted_out_at?: string | null;
          organization_id: string;
          privacy_notice_sent_at?: string | null;
          status?: Database["public"]["Enums"]["conversation_status"];
          updated_at?: string;
          web_session_hash?: string | null;
        };
        Update: {
          ai_paused?: boolean;
          assigned_to?: string | null;
          channel?: Database["public"]["Enums"]["conversation_channel"];
          consent_at?: string | null;
          created_at?: string;
          customer_name?: string | null;
          customer_wa_id?: string | null;
          first_inbound_at?: string | null;
          first_response_at?: string | null;
          handoff_reason?: string | null;
          id?: string;
          language?: string | null;
          last_inbound_at?: string | null;
          last_message_at?: string | null;
          last_message_direction?: Database["public"]["Enums"]["message_direction"] | null;
          opted_out_at?: string | null;
          organization_id?: string;
          privacy_notice_sent_at?: string | null;
          status?: Database["public"]["Enums"]["conversation_status"];
          updated_at?: string;
          web_session_hash?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      demo_requests: {
        Row: {
          city: string | null;
          clinic_name: string;
          clinic_type: string | null;
          consent_at: string;
          contact_name: string;
          created_at: string;
          email: string | null;
          id: string;
          ip_hash: string | null;
          locale: string;
          message: string | null;
          phone: string;
          status: string;
        };
        Insert: {
          city?: string | null;
          clinic_name: string;
          clinic_type?: string | null;
          consent_at: string;
          contact_name: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          ip_hash?: string | null;
          locale?: string;
          message?: string | null;
          phone: string;
          status?: string;
        };
        Update: {
          city?: string | null;
          clinic_name?: string;
          clinic_type?: string | null;
          consent_at?: string;
          contact_name?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          ip_hash?: string | null;
          locale?: string;
          message?: string | null;
          phone?: string;
          status?: string;
        };
        Relationships: [];
      };
      integration_credentials: {
        Row: {
          access_token_ciphertext: string;
          app_secret_ciphertext: string | null;
          integration_id: string;
          key_version: number;
          organization_id: string;
          updated_at: string;
          verify_token_hash: string | null;
        };
        Insert: {
          access_token_ciphertext: string;
          app_secret_ciphertext?: string | null;
          integration_id: string;
          key_version?: number;
          organization_id: string;
          updated_at?: string;
          verify_token_hash?: string | null;
        };
        Update: {
          access_token_ciphertext?: string;
          app_secret_ciphertext?: string | null;
          integration_id?: string;
          key_version?: number;
          organization_id?: string;
          updated_at?: string;
          verify_token_hash?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "integration_credentials_integration_id_fkey";
            columns: ["integration_id"];
            isOneToOne: true;
            referencedRelation: "integration_settings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_credentials_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_settings: {
        Row: {
          confirmation_template_language: string;
          confirmation_template_name: string | null;
          created_at: string;
          credentials_verified_at: string | null;
          display_phone_number: string | null;
          id: string;
          last_error: string | null;
          last_error_at: string | null;
          last_inbound_at: string | null;
          organization_id: string;
          phone_number_id: string | null;
          provider: string;
          status: Database["public"]["Enums"]["integration_status"];
          updated_at: string;
          verified_name: string | null;
          waba_id: string | null;
          webhook_key: string;
          webhook_verified_at: string | null;
        };
        Insert: {
          confirmation_template_language?: string;
          confirmation_template_name?: string | null;
          created_at?: string;
          credentials_verified_at?: string | null;
          display_phone_number?: string | null;
          id?: string;
          last_error?: string | null;
          last_error_at?: string | null;
          last_inbound_at?: string | null;
          organization_id: string;
          phone_number_id?: string | null;
          provider?: string;
          status?: Database["public"]["Enums"]["integration_status"];
          updated_at?: string;
          verified_name?: string | null;
          waba_id?: string | null;
          webhook_key?: string;
          webhook_verified_at?: string | null;
        };
        Update: {
          confirmation_template_language?: string;
          confirmation_template_name?: string | null;
          created_at?: string;
          credentials_verified_at?: string | null;
          display_phone_number?: string | null;
          id?: string;
          last_error?: string | null;
          last_error_at?: string | null;
          last_inbound_at?: string | null;
          organization_id?: string;
          phone_number_id?: string | null;
          provider?: string;
          status?: Database["public"]["Enums"]["integration_status"];
          updated_at?: string;
          verified_name?: string | null;
          waba_id?: string | null;
          webhook_key?: string;
          webhook_verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "integration_settings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          ai_model: string | null;
          body: string;
          conversation_id: string;
          created_at: string;
          direction: Database["public"]["Enums"]["message_direction"];
          error_code: string | null;
          error_detail: string | null;
          id: string;
          input_tokens: number | null;
          organization_id: string;
          output_tokens: number | null;
          sender: Database["public"]["Enums"]["message_sender"];
          staff_user_id: string | null;
          status: Database["public"]["Enums"]["message_status"];
          updated_at: string;
          wa_message_id: string | null;
        };
        Insert: {
          ai_model?: string | null;
          body: string;
          conversation_id: string;
          created_at?: string;
          direction: Database["public"]["Enums"]["message_direction"];
          error_code?: string | null;
          error_detail?: string | null;
          id?: string;
          input_tokens?: number | null;
          organization_id: string;
          output_tokens?: number | null;
          sender: Database["public"]["Enums"]["message_sender"];
          staff_user_id?: string | null;
          status: Database["public"]["Enums"]["message_status"];
          updated_at?: string;
          wa_message_id?: string | null;
        };
        Update: {
          ai_model?: string | null;
          body?: string;
          conversation_id?: string;
          created_at?: string;
          direction?: Database["public"]["Enums"]["message_direction"];
          error_code?: string | null;
          error_detail?: string | null;
          id?: string;
          input_tokens?: number | null;
          organization_id?: string;
          output_tokens?: number | null;
          sender?: Database["public"]["Enums"]["message_sender"];
          staff_user_id?: string | null;
          status?: Database["public"]["Enums"]["message_status"];
          updated_at?: string;
          wa_message_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_organization_id_fkey";
            columns: ["conversation_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          id: string;
          invited_by: string | null;
          organization_id: string;
          role: Database["public"]["Enums"]["member_role"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          organization_id: string;
          role?: Database["public"]["Enums"]["member_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          organization_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          city: string | null;
          created_at: string;
          created_by: string | null;
          default_language: string;
          id: string;
          name: string;
          phone: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          city?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_language?: string;
          id?: string;
          name: string;
          phone?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          city?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_language?: string;
          id?: string;
          name?: string;
          phone?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      plan_limits: {
        Row: {
          ai_replies_per_month: number;
          monthly_price_sar: number;
          name_ar: string;
          name_en: string;
          plan: Database["public"]["Enums"]["subscription_plan"];
          seats: number;
          sort_order: number;
        };
        Insert: {
          ai_replies_per_month: number;
          monthly_price_sar: number;
          name_ar: string;
          name_en: string;
          plan: Database["public"]["Enums"]["subscription_plan"];
          seats: number;
          sort_order?: number;
        };
        Update: {
          ai_replies_per_month?: number;
          monthly_price_sar?: number;
          name_ar?: string;
          name_en?: string;
          plan?: Database["public"]["Enums"]["subscription_plan"];
          seats?: number;
          sort_order?: number;
        };
        Relationships: [];
      };
      subscription_records: {
        Row: {
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          id: string;
          notes: string | null;
          organization_id: string;
          plan: Database["public"]["Enums"]["subscription_plan"];
          provider: string | null;
          provider_customer_ref: string | null;
          provider_subscription_ref: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          notes?: string | null;
          organization_id: string;
          plan: Database["public"]["Enums"]["subscription_plan"];
          provider?: string | null;
          provider_customer_ref?: string | null;
          provider_subscription_ref?: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          plan?: Database["public"]["Enums"]["subscription_plan"];
          provider?: string | null;
          provider_customer_ref?: string | null;
          provider_subscription_ref?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_records_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_records_plan_fkey";
            columns: ["plan"];
            isOneToOne: false;
            referencedRelation: "plan_limits";
            referencedColumns: ["plan"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_whatsapp_status: {
        Args: {
          p_error_code?: string;
          p_error_detail?: string;
          p_status: Database["public"]["Enums"]["message_status"];
          p_wa_message_id: string;
        };
        Returns: boolean;
      };
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      create_organization: {
        Args: {
          p_city?: string;
          p_language?: string;
          p_name: string;
          p_phone?: string;
          p_slug: string;
        };
        Returns: string;
      };
      dashboard_metrics: {
        Args: { p_days?: number; p_org: string };
        Returns: Json;
      };
      find_user_id_by_email: { Args: { p_email: string }; Returns: string };
      ingest_whatsapp_inbound: {
        Args: {
          p_body: string;
          p_customer_name: string;
          p_org: string;
          p_received_at?: string;
          p_wa_id: string;
          p_wa_message_id: string;
        };
        Returns: {
          ai_paused: boolean;
          conversation_id: string;
          conversation_status: Database["public"]["Enums"]["conversation_status"];
          is_duplicate: boolean;
          language: string;
          message_id: string;
          opted_out: boolean;
          privacy_notice_sent: boolean;
        }[];
      };
      list_org_members: {
        Args: { p_org: string };
        Returns: {
          created_at: string;
          email: string;
          full_name: string;
          member_id: string;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
        }[];
      };
      org_entitlements: { Args: { p_org: string }; Returns: Json };
      record_ai_usage: {
        Args: {
          p_input_tokens: number;
          p_is_test?: boolean;
          p_org: string;
          p_output_tokens: number;
        };
        Returns: undefined;
      };
      update_member_role: {
        Args: {
          p_member_id: string;
          p_role: Database["public"]["Enums"]["member_role"];
        };
        Returns: undefined;
      };
      write_audit: {
        Args: {
          p_action: string;
          p_actor: string;
          p_actor_type: string;
          p_details?: Json;
          p_entity_id?: string;
          p_entity_type?: string;
          p_org: string;
        };
        Returns: undefined;
      };
      // MANUAL: defined in supabase/migrations/20261012090200_functions.sql and
      // supabase/manual/apply_in_sql_editor.sql; absent from the generated
      // output until that file has been run on the project.
      remove_member: {
        Args: { p_member_id: string };
        Returns: undefined;
      };
      delete_organization: {
        Args: { p_org: string; p_confirm_slug: string };
        Returns: undefined;
      };
    };
    Enums: {
      appointment_status: "new" | "contacted" | "confirmed" | "cancelled" | "completed";
      conversation_channel: "web" | "whatsapp";
      conversation_status: "open" | "awaiting_human" | "closed";
      integration_status: "disconnected" | "credentials_verified" | "connected" | "error";
      member_role: "owner" | "admin" | "receptionist";
      message_direction: "inbound" | "outbound";
      message_sender: "customer" | "assistant" | "staff" | "system";
      message_status: "received" | "pending" | "sent" | "delivered" | "read" | "failed";
      subscription_plan: "starter" | "growth" | "pro";
      subscription_status: "trialing" | "active" | "past_due" | "cancelled" | "expired";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

/** Row type of a public table: `Tables<"organizations">`. */
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
/** Insert type of a public table. */
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
/** Update type of a public table. */
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
/** A public enum: `Enums<"member_role">`. */
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];

export const Constants = {
  public: {
    Enums: {
      appointment_status: ["new", "contacted", "confirmed", "cancelled", "completed"],
      conversation_channel: ["web", "whatsapp"],
      conversation_status: ["open", "awaiting_human", "closed"],
      integration_status: ["disconnected", "credentials_verified", "connected", "error"],
      member_role: ["owner", "admin", "receptionist"],
      message_direction: ["inbound", "outbound"],
      message_sender: ["customer", "assistant", "staff", "system"],
      message_status: ["received", "pending", "sent", "delivered", "read", "failed"],
      subscription_plan: ["starter", "growth", "pro"],
      subscription_status: ["trialing", "active", "past_due", "cancelled", "expired"],
    },
  },
} as const;
