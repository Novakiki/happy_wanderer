'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage as ChatMessageType } from '@/lib/types';
import { formatNoteCount, NOTE_LABEL_PLURAL } from '@/lib/terminology';
import { formStyles } from '@/lib/styles';
import ChatMessage from './ChatMessage';

const SUGGESTED_QUESTIONS = [
  "Tell me a funny story about Val",
  "What did people love about her?",
  "What was she like as a young woman?",
  "How did she show love to others?",
];

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [memoryCount, setMemoryCount] = useState<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch memory count on mount
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/memories/count');
        const data = await res.json();
        setMemoryCount(data.count);
      } catch {
        setMemoryCount(0);
      }

      const initialMessage: ChatMessageType = {
        role: 'assistant',
        content: `Hello. I'm here to help you learn about Val through notes and stories that family and friends have shared here.

Everything I tell you comes directly from someone who knew and loved her — I'll always tell you who shared each note. I won't make anything up or pretend to know things I don't.

What would you like to know about her?`,
      };
      setMessages([initialMessage]);
      setIsInitialized(true);
    }
    init();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: ChatMessageType = { role: 'user', content: content.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages.slice(1), userMessage],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: ChatMessageType = {
        role: 'assistant',
        content: data.message,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'I apologize, but something went wrong. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <div className="flex flex-col h-[500px] bg-white/[0.03] rounded-2xl border border-white/10 items-center justify-center">
        <div className="animate-pulse text-white/40">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Memory count badge */}
      {memoryCount !== null && (
        <div className="mb-4">
          <span className="inline-flex items-center gap-2 text-sm text-white/50 bg-white/[0.05] px-3 py-1.5 rounded-full border border-white/10">
            <span className="w-1.5 h-1.5 bg-[#7c8a78] rounded-full"></span>
            {memoryCount === 0
              ? `No ${NOTE_LABEL_PLURAL} shared yet`
              : formatNoteCount(memoryCount)}
          </span>
        </div>
      )}

      <div className="flex flex-col h-[calc(100vh-340px)] min-h-[400px] max-h-[600px] bg-white/[0.03] rounded-2xl border border-white/10">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/[0.06] rounded-2xl px-4 py-3 text-white/50">
                <span className="animate-pulse">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested questions - show only at start */}
        {messages.length === 1 && !isLoading && (
          <div className="px-4 pb-3">
            <p className="text-xs text-white/40 mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="text-sm px-3 py-1.5 rounded-full border border-white/10 text-white/50 hover:bg-white/[0.06] hover:text-white/70 hover:border-white/20 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-white/10">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about Val..."
              disabled={isLoading}
              className={`flex-1 ${formStyles.input} disabled:opacity-50`}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={`${formStyles.buttonPrimary} disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed`}
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* Trust disclaimer */}
      <p className="text-xs text-white/30 mt-4 leading-relaxed">
        This is not Val speaking. All responses draw only from notes shared by family and friends.
        Nothing is invented or imagined.
      </p>
    </div>
  );
}
