export interface Memory {
  id: string;
  content: string;
  submitter_name: string | null;
  submitter_relationship: string | null;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
