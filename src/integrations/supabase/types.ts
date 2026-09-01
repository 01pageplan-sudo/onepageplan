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
      app_config: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      email_sends: {
        Row: {
          attempts: number
          claimed_at: string | null
          created_at: string
          email: string
          error: string | null
          id: string
          idempotency_key: string | null
          opened_at: string | null
          provider_id: string | null
          registration_id: string | null
          scheduled_at: string
          sent_at: string | null
          session_date: string | null
          status: string
          template: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          email: string
          error?: string | null
          id?: string
          idempotency_key?: string | null
          opened_at?: string | null
          provider_id?: string | null
          registration_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          session_date?: string | null
          status?: string
          template: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          idempotency_key?: string | null
          opened_at?: string | null
          provider_id?: string | null
          registration_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          session_date?: string | null
          status?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_settings: {
        Row: {
          annual_checkout_link: string
          calendar_link: string
          id: number
          joining_link: string
          monthly_checkout_link: string
          nurture_enabled: boolean
          registration_link: string
          updated_at: string
          whatsapp_link: string
        }
        Insert: {
          annual_checkout_link?: string
          calendar_link?: string
          id?: number
          joining_link?: string
          monthly_checkout_link?: string
          nurture_enabled?: boolean
          registration_link?: string
          updated_at?: string
          whatsapp_link?: string
        }
        Update: {
          annual_checkout_link?: string
          calendar_link?: string
          id?: number
          joining_link?: string
          monthly_checkout_link?: string
          nurture_enabled?: boolean
          registration_link?: string
          updated_at?: string
          whatsapp_link?: string
        }
        Relationships: []
      }
      email_template_overrides: {
        Row: {
          body: string | null
          heading: string | null
          subject: string | null
          template_key: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          heading?: string | null
          subject?: string | null
          template_key: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          heading?: string | null
          subject?: string | null
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_tags: {
        Row: {
          created_at: string
          id: string
          registration_id: string
          tag: string
        }
        Insert: {
          created_at?: string
          id?: string
          registration_id: string
          tag: string
        }
        Update: {
          created_at?: string
          id?: string
          registration_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string
        }
        Relationships: []
      }
      prework_questions: {
        Row: {
          created_at: string
          email: string | null
          id: string
          question: string
          registration_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          question: string
          registration_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          question?: string
          registration_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prework_questions_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          consent_at: string | null
          created_at: string
          email: string
          email_error: string | null
          email_sent_at: string | null
          full_name: string
          id: string
          landing_path: string | null
          pain_point: string | null
          phone_e164: string
          profile_type: string | null
          raw_webhook: Json | null
          referrer: string | null
          session_date: string
          status: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          voice_consent: boolean
          voice_consent_at: string | null
          whatsapp_consent: boolean
          whatsapp_error: string | null
          whatsapp_sent_at: string | null
        }
        Insert: {
          consent_at?: string | null
          created_at?: string
          email: string
          email_error?: string | null
          email_sent_at?: string | null
          full_name: string
          id?: string
          landing_path?: string | null
          pain_point?: string | null
          phone_e164: string
          profile_type?: string | null
          raw_webhook?: Json | null
          referrer?: string | null
          session_date: string
          status?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          voice_consent?: boolean
          voice_consent_at?: string | null
          whatsapp_consent?: boolean
          whatsapp_error?: string | null
          whatsapp_sent_at?: string | null
        }
        Update: {
          consent_at?: string | null
          created_at?: string
          email?: string
          email_error?: string | null
          email_sent_at?: string | null
          full_name?: string
          id?: string
          landing_path?: string | null
          pain_point?: string | null
          phone_e164?: string
          profile_type?: string | null
          raw_webhook?: Json | null
          referrer?: string | null
          session_date?: string
          status?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          voice_consent?: boolean
          voice_consent_at?: string | null
          whatsapp_consent?: boolean
          whatsapp_error?: string | null
          whatsapp_sent_at?: string | null
        }
        Relationships: []
      }
      webinar_api_logs: {
        Row: {
          created_at: string
          email: string | null
          error: string | null
          full_name: string | null
          id: string
          kind: string
          outcome: string
          request_body: Json | null
          request_url: string | null
          response_body: string | null
          response_status: number | null
          webinar_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          error?: string | null
          full_name?: string | null
          id?: string
          kind?: string
          outcome: string
          request_body?: Json | null
          request_url?: string | null
          response_body?: string | null
          response_status?: number | null
          webinar_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          error?: string | null
          full_name?: string | null
          id?: string
          kind?: string
          outcome?: string
          request_body?: Json | null
          request_url?: string | null
          response_body?: string | null
          response_status?: number | null
          webinar_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_lead: {
        Args: { p_password: string; p_registration_id: string }
        Returns: undefined
      }
      admin_email_sends: {
        Args: {
          p_from?: string
          p_limit?: number
          p_password: string
          p_registration_id?: string
          p_to?: string
        }
        Returns: {
          email: string
          error: string
          id: string
          opened_at: string
          registration_id: string
          scheduled_at: string
          sent_at: string
          status: string
          template: string
        }[]
      }
      admin_email_stats: {
        Args: { p_from?: string; p_password: string; p_to?: string }
        Returns: Json
      }
      admin_get_email_settings: {
        Args: { p_password: string }
        Returns: {
          annual_checkout_link: string
          calendar_link: string
          id: number
          joining_link: string
          monthly_checkout_link: string
          nurture_enabled: boolean
          registration_link: string
          updated_at: string
          whatsapp_link: string
        }
        SetofOptions: {
          from: "*"
          to: "email_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_get_templates: { Args: { p_password: string }; Returns: Json }
      admin_leads: {
        Args: { p_from?: string; p_password: string; p_to?: string }
        Returns: {
          created_at: string
          email: string
          email_sent_at: string
          emails_failed: number
          emails_opened: number
          emails_sent: number
          full_name: string
          id: string
          landing_path: string
          pain_point: string
          phone_e164: string
          profile_type: string
          session_date: string
          status: string
          tag_dates: Json
          tags: string[]
          utm_source: string
          voice_consent: boolean
          whatsapp_consent: boolean
        }[]
      }
      admin_registrations: {
        Args: { p_password: string; p_session_date: string }
        Returns: {
          created_at: string
          email: string
          email_sent_at: string
          full_name: string
          pain_point: string
          phone_e164: string
          profile_type: string
          status: string
          voice_consent: boolean
          whatsapp_consent: boolean
        }[]
      }
      admin_reset_template: {
        Args: { p_key: string; p_password: string }
        Returns: undefined
      }
      admin_save_email_settings: {
        Args: { p: Json; p_password: string }
        Returns: undefined
      }
      admin_save_template: {
        Args: {
          p_body: string
          p_heading: string
          p_key: string
          p_password: string
          p_subject: string
        }
        Returns: undefined
      }
      admin_set_tag: {
        Args: {
          p_add: boolean
          p_password: string
          p_registration_id: string
          p_tag: string
        }
        Returns: undefined
      }
      admin_webinar_logs: {
        Args: { p_limit?: number; p_password: string }
        Returns: {
          created_at: string
          email: string
          error: string
          full_name: string
          id: string
          kind: string
          outcome: string
          request_body: Json
          request_url: string
          response_body: string
          response_status: number
          webinar_id: string
        }[]
      }
      assert_admin: { Args: { p_password: string }; Returns: undefined }
      claim_due_emails: {
        Args: { p_limit?: number; p_password: string }
        Returns: {
          email: string
          full_name: string
          id: string
          registration_id: string
          scheduled_at: string
          session_date: string
          template: string
        }[]
      }
      dispatch_due_emails: { Args: never; Returns: undefined }
      lookup_registration_for_room: {
        Args: { p_email: string; p_session_date: string }
        Returns: string
      }
      mark_email_send: {
        Args: {
          p_error?: string
          p_id: string
          p_password: string
          p_provider_id?: string
          p_status: string
        }
        Returns: undefined
      }
      mark_registration_delivery: {
        Args: {
          p_channel: string
          p_error?: string
          p_id: string
          p_sent: boolean
        }
        Returns: undefined
      }
      queue_emails: {
        Args: { p_password: string; p_rows: Json }
        Returns: number
      }
      record_email_provider_event: {
        Args: {
          p_email: string
          p_event: string
          p_password: string
          p_provider_id: string
        }
        Returns: boolean
      }
      record_webinar_event: {
        Args: {
          p_email: string
          p_payload: Json
          p_session_date: string
          p_status: string
        }
        Returns: boolean
      }
      register_attendee: { Args: { p: Json }; Returns: string }
      submit_prework_question: {
        Args: {
          p_email?: string
          p_question: string
          p_registration_id?: string
        }
        Returns: undefined
      }
      subscribe_newsletter: {
        Args: { p_email: string; p_source?: string }
        Returns: undefined
      }
      verify_cron_secret: { Args: { p_secret: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
