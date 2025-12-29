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
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      constellation_members: {
        Row: {
          birth_year: number | null
          contributor_id: string | null
          created_at: string | null
          id: string
          name: string
          passing_year: number | null
          relation_to_subject: string
        }
        Insert: {
          birth_year?: number | null
          contributor_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          passing_year?: number | null
          relation_to_subject: string
        }
        Update: {
          birth_year?: number | null
          contributor_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          passing_year?: number | null
          relation_to_subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "constellation_members_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      contributors: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          last_active: string | null
          name: string
          phone: string | null
          relation: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          last_active?: string | null
          name: string
          phone?: string | null
          relation: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          last_active?: string | null
          name?: string
          phone?: string | null
          relation?: string
        }
        Relationships: []
      }
      edit_tokens: {
        Row: {
          contributor_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          contributor_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          contributor_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edit_tokens_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      event_media: {
        Row: {
          event_id: string
          media_id: string
        }
        Insert: {
          event_id: string
          media_id: string
        }
        Update: {
          event_id?: string
          media_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_media_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      event_references: {
        Row: {
          added_by: string | null
          contributor_id: string | null
          created_at: string | null
          display_name: string | null
          event_id: string
          id: string
          note: string | null
          person_id: string | null
          relationship_to_subject: string | null
          role: string | null
          type: string
          url: string | null
          visibility: string | null
        }
        Insert: {
          added_by?: string | null
          contributor_id?: string | null
          created_at?: string | null
          display_name?: string | null
          event_id: string
          id?: string
          note?: string | null
          person_id?: string | null
          relationship_to_subject?: string | null
          role?: string | null
          type: string
          url?: string | null
          visibility?: string | null
        }
        Update: {
          added_by?: string | null
          contributor_id?: string | null
          created_at?: string | null
          display_name?: string | null
          event_id?: string
          id?: string
          note?: string | null
          person_id?: string | null
          relationship_to_subject?: string | null
          role?: string | null
          type?: string
          url?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_references_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_references_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_references_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_references_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          uses_remaining: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          uses_remaining?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          uses_remaining?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          contributed_at: string | null
          created_at: string | null
          event_id: string | null
          id: string
          message: string | null
          method: string
          opened_at: string | null
          recipient_contact: string
          recipient_name: string
          sender_id: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          contributed_at?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          message?: string | null
          method: string
          opened_at?: string | null
          recipient_contact: string
          recipient_name: string
          sender_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          contributed_at?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          message?: string | null
          method?: string
          opened_at?: string | null
          recipient_contact?: string
          recipient_name?: string
          sender_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          type: string
          uploaded_by: string | null
          url: string
          year: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          type: string
          uploaded_by?: string | null
          url: string
          year?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          type?: string
          uploaded_by?: string | null
          url?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_threads: {
        Row: {
          created_at: string | null
          id: string
          note: string | null
          original_event_id: string | null
          relationship: string | null
          response_event_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          note?: string | null
          original_event_id?: string | null
          relationship?: string | null
          response_event_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          note?: string | null
          original_event_id?: string | null
          relationship?: string | null
          response_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memory_threads_original_event_id_fkey"
            columns: ["original_event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_threads_response_event_id_fkey"
            columns: ["response_event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          read: boolean | null
          related_event_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          read?: boolean | null
          related_event_id?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          read?: boolean | null
          related_event_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_event_id_fkey"
            columns: ["related_event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          canonical_name: string
          created_at: string | null
          created_by: string | null
          id: string
          visibility: string | null
        }
        Insert: {
          canonical_name: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          visibility?: string | null
        }
        Update: {
          canonical_name?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      person_aliases: {
        Row: {
          alias: string
          created_at: string | null
          created_by: string | null
          id: string
          kind: string | null
          person_id: string
        }
        Insert: {
          alias: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          kind?: string | null
          person_id: string
        }
        Update: {
          alias?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          kind?: string | null
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_aliases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_aliases_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      person_claims: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          contributor_id: string
          created_at: string | null
          id: string
          person_id: string
          status: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          contributor_id: string
          created_at?: string | null
          id?: string
          person_id: string
          status?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          contributor_id?: string
          created_at?: string | null
          id?: string
          person_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_claims_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_claims_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: true
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_claims_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          contributor_id: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          relation: string
          updated_at: string | null
        }
        Insert: {
          contributor_id?: string | null
          created_at?: string | null
          email: string
          id: string
          name: string
          relation: string
          updated_at?: string | null
        }
        Update: {
          contributor_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          relation?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          age_end: number | null
          age_start: number | null
          chain_depth: number | null
          contributor_id: string | null
          created_at: string | null
          date: string | null
          full_entry: string | null
          id: string
          life_stage: string | null
          location: string | null
          people_involved: string[] | null
          preview: string | null
          privacy_level: string | null
          prompted_by_event_id: string | null
          root_event_id: string | null
          source_name: string | null
          source_url: string | null
          status: string | null
          subject_id: string | null
          timing_certainty: string | null
          timing_input_type: string | null
          timing_note: string | null
          title: string
          type: string
          why_included: string | null
          year: number
          year_end: number | null
        }
        Insert: {
          age_end?: number | null
          age_start?: number | null
          chain_depth?: number | null
          contributor_id?: string | null
          created_at?: string | null
          date?: string | null
          full_entry?: string | null
          id?: string
          life_stage?: string | null
          location?: string | null
          people_involved?: string[] | null
          preview?: string | null
          privacy_level?: string | null
          prompted_by_event_id?: string | null
          root_event_id?: string | null
          source_name?: string | null
          source_url?: string | null
          status?: string | null
          subject_id?: string | null
          timing_certainty?: string | null
          timing_input_type?: string | null
          timing_note?: string | null
          title: string
          type: string
          why_included?: string | null
          year: number
          year_end?: number | null
        }
        Update: {
          age_end?: number | null
          age_start?: number | null
          chain_depth?: number | null
          contributor_id?: string | null
          created_at?: string | null
          date?: string | null
          full_entry?: string | null
          id?: string
          life_stage?: string | null
          location?: string | null
          people_involved?: string[] | null
          preview?: string | null
          privacy_level?: string | null
          prompted_by_event_id?: string | null
          root_event_id?: string | null
          source_name?: string | null
          source_url?: string | null
          status?: string | null
          subject_id?: string | null
          timing_certainty?: string | null
          timing_input_type?: string | null
          timing_note?: string | null
          title?: string
          type?: string
          why_included?: string | null
          year?: number
          year_end?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_prompted_by_event_id_fkey"
            columns: ["prompted_by_event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_root_event_id_fkey"
            columns: ["root_event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      witnesses: {
        Row: {
          contact_info: string | null
          contact_method: string | null
          contributed_event_id: string | null
          created_at: string | null
          event_id: string | null
          id: string
          invited_at: string | null
          name: string
          status: string | null
        }
        Insert: {
          contact_info?: string | null
          contact_method?: string | null
          contributed_event_id?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          invited_at?: string | null
          name: string
          status?: string | null
        }
        Update: {
          contact_info?: string | null
          contact_method?: string | null
          contributed_event_id?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          invited_at?: string | null
          name?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "witnesses_contributed_event_id_fkey"
            columns: ["contributed_event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "witnesses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

// Custom composite types for joined queries
export type EventReferenceWithContributor = Database['public']['Tables']['event_references']['Row'] & {
  contributor?: {
    name: string;
    relation: string | null;
  } | null;
};
