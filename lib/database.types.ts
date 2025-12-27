// =============================================================================
// Database Types (generated from schema)
// =============================================================================

export type Database = {
  public: {
    Tables: {
      contributors: {
        Row: {
          id: string;
          name: string;
          relation: string;
          email: string | null;
          phone: string | null;
          created_at: string;
          last_active: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          relation: string;
          email?: string | null;
          phone?: string | null;
          created_at?: string;
          last_active?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          relation?: string;
          email?: string | null;
          phone?: string | null;
          created_at?: string;
          last_active?: string | null;
        };
      };
      people: {
        Row: {
          id: string;
          canonical_name: string;
          visibility: 'pending' | 'approved' | 'anonymized' | 'blurred' | 'removed';
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          canonical_name: string;
          visibility?: 'pending' | 'approved' | 'anonymized' | 'blurred' | 'removed';
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          canonical_name?: string;
          visibility?: 'pending' | 'approved' | 'anonymized' | 'blurred' | 'removed';
          created_by?: string | null;
          created_at?: string;
        };
      };
      person_aliases: {
        Row: {
          id: string;
          person_id: string;
          alias: string;
          kind: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          person_id: string;
          alias: string;
          kind?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          person_id?: string;
          alias?: string;
          kind?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
      person_claims: {
        Row: {
          id: string;
          person_id: string;
          contributor_id: string;
          status: 'pending' | 'approved' | 'declined';
          created_at: string;
          approved_at: string | null;
          approved_by: string | null;
        };
        Insert: {
          id?: string;
          person_id: string;
          contributor_id: string;
          status?: 'pending' | 'approved' | 'declined';
          created_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
        };
        Update: {
          id?: string;
          person_id?: string;
          contributor_id?: string;
          status?: 'pending' | 'approved' | 'declined';
          created_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
        };
      };
      timeline_events: {
        Row: {
          id: string;
          year: number;
          date: string | null;
          type: 'origin' | 'milestone' | 'memory';
          title: string;
          preview: string | null;
          full_entry: string | null;
          why_included: string | null;
          source_url: string | null;
          source_name: string | null;
          contributor_id: string | null;
          location: string | null;
          people_involved: string[] | null;
          created_at: string;
          status: 'published' | 'pending' | 'private';
          privacy_level: 'public' | 'family' | 'kids-only';
          prompted_by_event_id: string | null;
          // Timing flexibility fields
          timing_certainty: 'exact' | 'approximate' | 'vague';
          timing_input_type: 'date' | 'year' | 'year_range' | 'age_range' | 'life_stage';
          year_end: number | null;
          age_start: number | null;
          age_end: number | null;
          life_stage: 'childhood' | 'teens' | 'college' | 'young_family' | 'beyond' | null;
          timing_note: string | null;
          subject_id: string | null;
          // Story chain fields
          root_event_id: string | null;
          chain_depth: number;
        };
        Insert: {
          id?: string;
          year: number;
          date?: string | null;
          type: 'origin' | 'milestone' | 'memory';
          title: string;
          preview?: string | null;
          full_entry?: string | null;
          why_included?: string | null;
          source_url?: string | null;
          source_name?: string | null;
          contributor_id?: string | null;
          location?: string | null;
          people_involved?: string[] | null;
          created_at?: string;
          status?: 'published' | 'pending' | 'private';
          privacy_level?: 'public' | 'family' | 'kids-only';
          prompted_by_event_id?: string | null;
          // Timing flexibility fields
          timing_certainty?: 'exact' | 'approximate' | 'vague';
          timing_input_type?: 'date' | 'year' | 'year_range' | 'age_range' | 'life_stage';
          year_end?: number | null;
          age_start?: number | null;
          age_end?: number | null;
          life_stage?: 'childhood' | 'teens' | 'college' | 'young_family' | 'beyond' | null;
          timing_note?: string | null;
          subject_id?: string | null;
          // Story chain fields
          root_event_id?: string | null;
          chain_depth?: number;
        };
        Update: {
          id?: string;
          year?: number;
          date?: string | null;
          type?: 'origin' | 'milestone' | 'memory';
          title?: string;
          preview?: string | null;
          full_entry?: string | null;
          why_included?: string | null;
          source_url?: string | null;
          source_name?: string | null;
          contributor_id?: string | null;
          location?: string | null;
          people_involved?: string[] | null;
          created_at?: string;
          status?: 'published' | 'pending' | 'private';
          privacy_level?: 'public' | 'family' | 'kids-only';
          prompted_by_event_id?: string | null;
          // Timing flexibility fields
          timing_certainty?: 'exact' | 'approximate' | 'vague';
          timing_input_type?: 'date' | 'year' | 'year_range' | 'age_range' | 'life_stage';
          year_end?: number | null;
          age_start?: number | null;
          age_end?: number | null;
          life_stage?: 'childhood' | 'teens' | 'college' | 'young_family' | 'beyond' | null;
          timing_note?: string | null;
          subject_id?: string | null;
          // Story chain fields
          root_event_id?: string | null;
          chain_depth?: number;
        };
      };
      constellation_members: {
        Row: {
          id: string;
          name: string;
          relation_to_subject: string;
          birth_year: number | null;
          passing_year: number | null;
          contributor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          relation_to_subject: string;
          birth_year?: number | null;
          passing_year?: number | null;
          contributor_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          relation_to_subject?: string;
          birth_year?: number | null;
          passing_year?: number | null;
          contributor_id?: string | null;
          created_at?: string;
        };
      };
      media: {
        Row: {
          id: string;
          type: 'photo' | 'video' | 'audio' | 'document';
          url: string;
          caption: string | null;
          year: number | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: 'photo' | 'video' | 'audio' | 'document';
          url: string;
          caption?: string | null;
          year?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: 'photo' | 'video' | 'audio' | 'document';
          url?: string;
          caption?: string | null;
          year?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
      };
      event_media: {
        Row: {
          event_id: string;
          media_id: string;
        };
        Insert: {
          event_id: string;
          media_id: string;
        };
        Update: {
          event_id?: string;
          media_id?: string;
        };
      };
      witnesses: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          contact_method: 'email' | 'sms' | 'link' | null;
          contact_info: string | null;
          status: 'not-invited' | 'invited' | 'viewed' | 'contributed';
          invited_at: string | null;
          contributed_event_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          contact_method?: 'email' | 'sms' | 'link' | null;
          contact_info?: string | null;
          status?: 'not-invited' | 'invited' | 'viewed' | 'contributed';
          invited_at?: string | null;
          contributed_event_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          name?: string;
          contact_method?: 'email' | 'sms' | 'link' | null;
          contact_info?: string | null;
          status?: 'not-invited' | 'invited' | 'viewed' | 'contributed';
          invited_at?: string | null;
          contributed_event_id?: string | null;
          created_at?: string;
        };
      };
      invites: {
        Row: {
          id: string;
          event_id: string;
          recipient_name: string;
          recipient_contact: string;
          method: 'email' | 'sms' | 'link';
          message: string | null;
          sender_id: string | null;
          status: 'pending' | 'sent' | 'opened' | 'clicked' | 'contributed';
          sent_at: string | null;
          opened_at: string | null;
          contributed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          recipient_name: string;
          recipient_contact: string;
          method: 'email' | 'sms' | 'link';
          message?: string | null;
          sender_id?: string | null;
          status?: 'pending' | 'sent' | 'opened' | 'clicked' | 'contributed';
          sent_at?: string | null;
          opened_at?: string | null;
          contributed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          recipient_name?: string;
          recipient_contact?: string;
          method?: 'email' | 'sms' | 'link';
          message?: string | null;
          sender_id?: string | null;
          status?: 'pending' | 'sent' | 'opened' | 'clicked' | 'contributed';
          sent_at?: string | null;
          opened_at?: string | null;
          contributed_at?: string | null;
          created_at?: string;
        };
      };
      edit_tokens: {
        Row: {
          id: string;
          token: string;
          contributor_id: string | null;
          expires_at: string | null;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          token: string;
          contributor_id?: string | null;
          expires_at?: string | null;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          token?: string;
          contributor_id?: string | null;
          expires_at?: string | null;
          used_at?: string | null;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: 'new-memory' | 'witness-request' | 'contribution-added' | 'memory-approved';
          title: string;
          body: string | null;
          related_event_id: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'new-memory' | 'witness-request' | 'contribution-added' | 'memory-approved';
          title: string;
          body?: string | null;
          related_event_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'new-memory' | 'witness-request' | 'contribution-added' | 'memory-approved';
          title?: string;
          body?: string | null;
          related_event_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
      };
      memory_threads: {
        Row: {
          id: string;
          original_event_id: string;
          response_event_id: string;
          relationship: 'perspective' | 'addition' | 'correction' | 'related' | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          original_event_id: string;
          response_event_id: string;
          relationship?: 'perspective' | 'addition' | 'correction' | 'related' | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          original_event_id?: string;
          response_event_id?: string;
          relationship?: 'perspective' | 'addition' | 'correction' | 'related' | null;
          created_at?: string;
        };
      };
      event_references: {
        Row: {
          id: string;
          event_id: string;
          type: 'person' | 'link';
          person_id: string | null;
          contributor_id: string | null;
          url: string | null;
          display_name: string | null;
          role: 'heard_from' | 'witness' | 'source' | 'related' | null;
          note: string | null;
          relationship_to_subject: string | null;
          visibility: 'pending' | 'approved' | 'anonymized' | 'blurred' | 'removed' | null;
          created_at: string;
          added_by: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          type: 'person' | 'link';
          person_id?: string | null;
          contributor_id?: string | null;
          url?: string | null;
          display_name?: string | null;
          role?: 'heard_from' | 'witness' | 'source' | 'related' | null;
          note?: string | null;
          relationship_to_subject?: string | null;
          visibility?: 'pending' | 'approved' | 'anonymized' | 'blurred' | 'removed' | null;
          created_at?: string;
          added_by?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          type?: 'person' | 'link';
          person_id?: string | null;
          contributor_id?: string | null;
          url?: string | null;
          display_name?: string | null;
          role?: 'heard_from' | 'witness' | 'source' | 'related' | null;
          note?: string | null;
          relationship_to_subject?: string | null;
          visibility?: 'pending' | 'approved' | 'anonymized' | 'blurred' | 'removed' | null;
          created_at?: string;
          added_by?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          name: string;
          relation: string;
          email: string;
          contributor_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          relation: string;
          email: string;
          contributor_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          relation?: string;
          email?: string;
          contributor_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      invite_codes: {
        Row: {
          id: string;
          code: string;
          description: string | null;
          uses_remaining: number | null;
          created_by: string | null;
          created_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          description?: string | null;
          uses_remaining?: number | null;
          created_by?: string | null;
          created_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          description?: string | null;
          uses_remaining?: number | null;
          created_by?: string | null;
          created_at?: string;
          expires_at?: string | null;
        };
      };
    };
  };
};

// =============================================================================
// Convenience Types
// =============================================================================

export type Contributor = Database['public']['Tables']['contributors']['Row'];
export type Person = Database['public']['Tables']['people']['Row'];
export type PersonAlias = Database['public']['Tables']['person_aliases']['Row'];
export type PersonClaim = Database['public']['Tables']['person_claims']['Row'];
export type TimelineEvent = Database['public']['Tables']['timeline_events']['Row'];
export type Media = Database['public']['Tables']['media']['Row'];
export type Witness = Database['public']['Tables']['witnesses']['Row'];
export type Invite = Database['public']['Tables']['invites']['Row'];
export type EditToken = Database['public']['Tables']['edit_tokens']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type MemoryThread = Database['public']['Tables']['memory_threads']['Row'];
export type EventReference = Database['public']['Tables']['event_references']['Row'];

// Reference with joined contributor data (for UI display)
export type EventReferenceWithContributor = EventReference & {
  contributor: Pick<Contributor, 'name' | 'relation'> | null;
  person_display_name?: string | null;
};

// Event with joined data
export type TimelineEventWithRelations = TimelineEvent & {
  contributor: Pick<Contributor, 'name' | 'relation'> | null;
  references?: EventReferenceWithContributor[];
};
