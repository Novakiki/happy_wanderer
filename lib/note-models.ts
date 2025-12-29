/**
 * Product-language aliases for database types.
 * Keeps "Note" vocabulary without renaming tables.
 */

import type { Database, EventReferenceWithContributor } from './database.types';

export type Note = Database['public']['Tables']['timeline_events']['Row'];
export type NoteInsert = Database['public']['Tables']['timeline_events']['Insert'];
export type NoteUpdate = Database['public']['Tables']['timeline_events']['Update'];

export type NoteReference = Database['public']['Tables']['event_references']['Row'];
export type NoteReferenceInsert = Database['public']['Tables']['event_references']['Insert'];
export type NoteReferenceUpdate = Database['public']['Tables']['event_references']['Update'];

export type NoteThread = Database['public']['Tables']['memory_threads']['Row'];
export type NoteThreadInsert = Database['public']['Tables']['memory_threads']['Insert'];
export type NoteThreadUpdate = Database['public']['Tables']['memory_threads']['Update'];

export type Contributor = Database['public']['Tables']['contributors']['Row'];
export type ContributorInsert = Database['public']['Tables']['contributors']['Insert'];
export type ContributorUpdate = Database['public']['Tables']['contributors']['Update'];

export type Person = Database['public']['Tables']['people']['Row'];
export type PersonInsert = Database['public']['Tables']['people']['Insert'];
export type PersonUpdate = Database['public']['Tables']['people']['Update'];

export type Invite = Database['public']['Tables']['invites']['Row'];
export type InviteInsert = Database['public']['Tables']['invites']['Insert'];
export type InviteUpdate = Database['public']['Tables']['invites']['Update'];

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type NoteWithReferences = Note & {
  references?: EventReferenceWithContributor[];
};
