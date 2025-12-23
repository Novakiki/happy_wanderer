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
      themes: {
        Row: {
          id: string;
          label: string;
          description: string | null;
          ai_generated: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          label: string;
          description?: string | null;
          ai_generated?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          label?: string;
          description?: string | null;
          ai_generated?: boolean;
          created_at?: string;
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
        };
      };
      event_themes: {
        Row: {
          event_id: string;
          theme_id: string;
        };
        Insert: {
          event_id: string;
          theme_id: string;
        };
        Update: {
          event_id?: string;
          theme_id?: string;
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
    };
  };
};

// =============================================================================
// Convenience Types
// =============================================================================

export type Contributor = Database['public']['Tables']['contributors']['Row'];
export type Theme = Database['public']['Tables']['themes']['Row'];
export type TimelineEvent = Database['public']['Tables']['timeline_events']['Row'];
export type Media = Database['public']['Tables']['media']['Row'];
export type Witness = Database['public']['Tables']['witnesses']['Row'];
export type Invite = Database['public']['Tables']['invites']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type MemoryThread = Database['public']['Tables']['memory_threads']['Row'];

// Event with joined data
export type TimelineEventWithRelations = TimelineEvent & {
  contributor: Pick<Contributor, 'name' | 'relation'> | null;
  themes: { theme: Pick<Theme, 'id' | 'label'> }[];
};
