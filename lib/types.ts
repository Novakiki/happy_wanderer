export interface Memory {
  id: string;
  content: string;
  submitter_name: string | null;
  submitter_relationship: string | null;
  submitter_email: string | null;
  tags: string[] | null;
  created_at: string;
  is_visible: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
