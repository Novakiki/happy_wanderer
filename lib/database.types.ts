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
  public: {
    Tables: {
      claim_tokens: {
        Row: {
          created_at: string | null
          event_id: string | null
          expires_at: string
          id: string
          invite_id: string | null
          person_id: string | null
          recipient_name: string
          recipient_phone: string
          sms_sent_at: string | null
          sms_sid: string | null
          sms_status: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          expires_at?: string
          id?: string
          invite_id?: string | null
          person_id?: string | null
          recipient_name: string
          recipient_phone: string
          sms_sent_at?: string | null
          sms_sid?: string | null
          sms_status?: string | null
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          expires_at?: string
          id?: string
          invite_id?: string | null
          person_id?: string | null
          recipient_name?: string
          recipient_phone?: string
          sms_sent_at?: string | null
          sms_sid?: string | null
          sms_status?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_tokens_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "current_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_tokens_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_tokens_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_tokens_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
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
          disabled_at: string | null
          email: string | null
          id: string
          last_active: string | null
          name: string
          phone: string | null
          relation: string
          trusted: boolean | null
        }
        Insert: {
          created_at?: string | null
          disabled_at?: string | null
          email?: string | null
          id?: string
          last_active?: string | null
          name: string
          phone?: string | null
          relation: string
          trusted?: boolean | null
        }
        Update: {
          created_at?: string | null
          disabled_at?: string | null
          email?: string | null
          id?: string
          last_active?: string | null
          name?: string
          phone?: string | null
          relation?: string
          trusted?: boolean | null
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
            referencedRelation: "current_notes"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "current_notes"
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
          depth: number | null
          event_id: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          message: string | null
          method: string
          opened_at: string | null
          parent_invite_id: string | null
          recipient_contact: string
          recipient_name: string
          sender_id: string | null
          sent_at: string | null
          status: string | null
          uses_count: number | null
        }
        Insert: {
          contributed_at?: string | null
          created_at?: string | null
          depth?: number | null
          event_id?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          message?: string | null
          method: string
          opened_at?: string | null
          parent_invite_id?: string | null
          recipient_contact: string
          recipient_name: string
          sender_id?: string | null
          sent_at?: string | null
          status?: string | null
          uses_count?: number | null
        }
        Update: {
          contributed_at?: string | null
          created_at?: string | null
          depth?: number | null
          event_id?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          message?: string | null
          method?: string
          opened_at?: string | null
          parent_invite_id?: string | null
          recipient_contact?: string
          recipient_name?: string
          sender_id?: string | null
          sent_at?: string | null
          status?: string | null
          uses_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "current_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_parent_invite_id_fkey"
            columns: ["parent_invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
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
            referencedRelation: "current_notes"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "current_notes"
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
      motif_links: {
        Row: {
          asserted_by: string
          created_at: string | null
          created_by: string | null
          id: string
          legibility_effect: string | null
          link_confidence: number
          link_type: string
          motif_id: string
          note_id: string
          rationale: string | null
          status: string
        }
        Insert: {
          asserted_by?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          legibility_effect?: string | null
          link_confidence?: number
          link_type?: string
          motif_id: string
          note_id: string
          rationale?: string | null
          status?: string
        }
        Update: {
          asserted_by?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          legibility_effect?: string | null
          link_confidence?: number
          link_type?: string
          motif_id?: string
          note_id?: string
          rationale?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "motif_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motif_links_motif_id_fkey"
            columns: ["motif_id"]
            isOneToOne: false
            referencedRelation: "motifs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motif_links_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "current_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motif_links_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
        ]
      }
      motifs: {
        Row: {
          created_at: string | null
          created_by: string | null
          definition: string | null
          id: string
          label: string
          merged_into_motif_id: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          definition?: string | null
          id?: string
          label: string
          merged_into_motif_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          definition?: string | null
          id?: string
          label?: string
          merged_into_motif_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "motifs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motifs_merged_into_motif_id_fkey"
            columns: ["merged_into_motif_id"]
            isOneToOne: false
            referencedRelation: "motifs"
            referencedColumns: ["id"]
          },
        ]
      }
      note_mentions: {
        Row: {
          created_at: string | null
          created_by: string | null
          display_label: string | null
          event_id: string
          id: string
          mention_text: string
          normalized_text: string
          promoted_person_id: string | null
          promoted_reference_id: string | null
          source: string
          status: string
          visibility: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          display_label?: string | null
          event_id: string
          id?: string
          mention_text: string
          normalized_text: string
          promoted_person_id?: string | null
          promoted_reference_id?: string | null
          source?: string
          status?: string
          visibility?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          display_label?: string | null
          event_id?: string
          id?: string
          mention_text?: string
          normalized_text?: string
          promoted_person_id?: string | null
          promoted_reference_id?: string | null
          source?: string
          status?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_mentions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_mentions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "current_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_mentions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_mentions_promoted_person_id_fkey"
            columns: ["promoted_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_mentions_promoted_reference_id_fkey"
            columns: ["promoted_reference_id"]
            isOneToOne: false
            referencedRelation: "event_references"
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
            referencedRelation: "current_notes"
            referencedColumns: ["id"]
          },
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
      signal_suggestions: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          matched_motif_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          text: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          matched_motif_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          text: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          matched_motif_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_suggestions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "current_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_suggestions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_suggestions_matched_motif_id_fkey"
            columns: ["matched_motif_id"]
            isOneToOne: false
            referencedRelation: "motifs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_event_versions: {
        Row: {
          age_end: number | null
          age_start: number | null
          created_at: string | null
          created_by: string | null
          date: string | null
          event_id: string
          full_entry: string | null
          id: string
          life_stage: string | null
          location: string | null
          people_involved: string[] | null
          preview: string | null
          privacy_level: string | null
          recurrence: string | null
          source_name: string | null
          source_url: string | null
          status: string | null
          timing_certainty: string | null
          timing_input_type: string | null
          timing_note: string | null
          timing_raw_text: string | null
          title: string | null
          type: string | null
          version: number
          why_included: string | null
          witness_type: string | null
          year: number | null
          year_end: number | null
        }
        Insert: {
          age_end?: number | null
          age_start?: number | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          event_id: string
          full_entry?: string | null
          id?: string
          life_stage?: string | null
          location?: string | null
          people_involved?: string[] | null
          preview?: string | null
          privacy_level?: string | null
          recurrence?: string | null
          source_name?: string | null
          source_url?: string | null
          status?: string | null
          timing_certainty?: string | null
          timing_input_type?: string | null
          timing_note?: string | null
          timing_raw_text?: string | null
          title?: string | null
          type?: string | null
          version: number
          why_included?: string | null
          witness_type?: string | null
          year?: number | null
          year_end?: number | null
        }
        Update: {
          age_end?: number | null
          age_start?: number | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          event_id?: string
          full_entry?: string | null
          id?: string
          life_stage?: string | null
          location?: string | null
          people_involved?: string[] | null
          preview?: string | null
          privacy_level?: string | null
          recurrence?: string | null
          source_name?: string | null
          source_url?: string | null
          status?: string | null
          timing_certainty?: string | null
          timing_input_type?: string | null
          timing_note?: string | null
          timing_raw_text?: string | null
          title?: string | null
          type?: string | null
          version?: number
          why_included?: string | null
          witness_type?: string | null
          year?: number | null
          year_end?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_event_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_event_versions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "current_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_event_versions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
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
          entry_mode: string | null
          fragment_kind: string | null
          full_entry: string | null
          id: string
          latitude: number | null
          life_stage: string | null
          location: string | null
          longitude: number | null
          needs_signal_assignment: boolean | null
          people_involved: string[] | null
          preview: string | null
          privacy_level: string | null
          prompted_by_event_id: string | null
          recurrence: string | null
          root_event_id: string | null
          source_name: string | null
          source_url: string | null
          status: string | null
          subject_focus: string | null
          subject_id: string | null
          timing_certainty: string | null
          timing_input_type: string | null
          timing_note: string | null
          timing_raw_text: string | null
          title: string
          trigger_event_id: string | null
          type: string
          why_included: string | null
          witness_type: string | null
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
          entry_mode?: string | null
          fragment_kind?: string | null
          full_entry?: string | null
          id?: string
          latitude?: number | null
          life_stage?: string | null
          location?: string | null
          longitude?: number | null
          needs_signal_assignment?: boolean | null
          people_involved?: string[] | null
          preview?: string | null
          privacy_level?: string | null
          prompted_by_event_id?: string | null
          recurrence?: string | null
          root_event_id?: string | null
          source_name?: string | null
          source_url?: string | null
          status?: string | null
          subject_focus?: string | null
          subject_id?: string | null
          timing_certainty?: string | null
          timing_input_type?: string | null
          timing_note?: string | null
          timing_raw_text?: string | null
          title: string
          trigger_event_id?: string | null
          type: string
          why_included?: string | null
          witness_type?: string | null
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
          entry_mode?: string | null
          fragment_kind?: string | null
          full_entry?: string | null
          id?: string
          latitude?: number | null
          life_stage?: string | null
          location?: string | null
          longitude?: number | null
          needs_signal_assignment?: boolean | null
          people_involved?: string[] | null
          preview?: string | null
          privacy_level?: string | null
          prompted_by_event_id?: string | null
          recurrence?: string | null
          root_event_id?: string | null
          source_name?: string | null
          source_url?: string | null
          status?: string | null
          subject_focus?: string | null
          subject_id?: string | null
          timing_certainty?: string | null
          timing_input_type?: string | null
          timing_note?: string | null
          timing_raw_text?: string | null
          title?: string
          trigger_event_id?: string | null
          type?: string
          why_included?: string | null
          witness_type?: string | null
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
            referencedRelation: "current_notes"
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
            referencedRelation: "current_notes"
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
          {
            foreignKeyName: "timeline_events_trigger_event_id_fkey"
            columns: ["trigger_event_id"]
            isOneToOne: false
            referencedRelation: "current_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_trigger_event_id_fkey"
            columns: ["trigger_event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
        ]
      }
      trust_requests: {
        Row: {
          contributor_id: string
          created_at: string
          id: string
          message: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          contributor_id: string
          created_at?: string
          id?: string
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          contributor_id?: string
          created_at?: string
          id?: string
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trust_requests_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trust_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      view_specs: {
        Row: {
          created_at: string | null
          enabled: boolean
          id: string
          name: string
          projection_version: string
          version: number
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean
          id?: string
          name: string
          projection_version?: string
          version?: number
        }
        Update: {
          created_at?: string | null
          enabled?: boolean
          id?: string
          name?: string
          projection_version?: string
          version?: number
        }
        Relationships: []
      }
      visibility_preferences: {
        Row: {
          contributor_id: string | null
          created_at: string | null
          id: string
          person_id: string
          updated_at: string | null
          visibility: string
        }
        Insert: {
          contributor_id?: string | null
          created_at?: string | null
          id?: string
          person_id: string
          updated_at?: string | null
          visibility: string
        }
        Update: {
          contributor_id?: string | null
          created_at?: string | null
          id?: string
          person_id?: string
          updated_at?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "visibility_preferences_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visibility_preferences_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
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
            referencedRelation: "current_notes"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "current_notes"
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
      current_notes: {
        Row: {
          age_end: number | null
          age_start: number | null
          chain_depth: number | null
          contributor_id: string | null
          created_at: string | null
          date: string | null
          full_entry: string | null
          id: string | null
          latitude: number | null
          life_stage: string | null
          location: string | null
          longitude: number | null
          people_involved: string[] | null
          preview: string | null
          privacy_level: string | null
          prompted_by_event_id: string | null
          recurrence: string | null
          root_event_id: string | null
          source_name: string | null
          source_url: string | null
          status: string | null
          subject_id: string | null
          timing_certainty: string | null
          timing_input_type: string | null
          timing_note: string | null
          timing_raw_text: string | null
          title: string | null
          trigger_event_id: string | null
          type: string | null
          version: number | null
          version_created_at: string | null
          version_created_by: string | null
          why_included: string | null
          witness_type: string | null
          year: number | null
          year_end: number | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_event_versions_created_by_fkey"
            columns: ["version_created_by"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "current_notes"
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
            referencedRelation: "current_notes"
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
          {
            foreignKeyName: "timeline_events_trigger_event_id_fkey"
            columns: ["trigger_event_id"]
            isOneToOne: false
            referencedRelation: "current_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_trigger_event_id_fkey"
            columns: ["trigger_event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      best_motif_match: {
        Args: { q: string; threshold?: number }
        Returns: {
          definition: string
          id: string
          label: string
          score: number
        }[]
      }
      get_emerging_signals: {
        Args: { motif_limit?: number; per_motif?: number; since_days?: number }
        Returns: {
          definition: string
          expresses_count: number
          label: string
          last_linked_at: string
          motif_id: string
          recent_fragments: Json
        }[]
      }
      lint_note: { Args: { note_body: string }; Returns: Json }
      search_motifs: {
        Args: {
          confirm_threshold?: number
          lim?: number
          min_show_score?: number
          q: string
        }
        Returns: {
          definition: string
          id: string
          label: string
          score: number
          should_confirm: boolean
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
