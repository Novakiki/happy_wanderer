'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage as ChatMessageType } from '@/lib/types';
import ChatMessage from './ChatMessage';

const SUGGESTED_QUESTIONS = [
  "Tell me a funny story about Mom",
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
        content: `Hello. I'm here to help you learn about your mom through memories and stories that family and friends have shared here.

Everything I tell you comes directly from someone who knew and loved her - I'll always tell you who shared each memory. I won't make anything up or pretend to know things I don't. If no one has shared a memory about something yet, I'll let you know.

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
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col h-[600px] bg-white/80 rounded-3xl shadow-sm border border-black/10 items-center justify-center">
          <div className="animate-pulse text-[var(--ink-soft)]">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Memory count badge */}
      {memoryCount !== null && (
        <div className="text-center mb-4">
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--ink-soft)] bg-[color:var(--paper-deep)]/70 px-3 py-1 rounded-full border border-black/10">
            <span className="w-2 h-2 bg-[var(--sage)] rounded-full"></span>
            {memoryCount === 0
              ? 'No memories shared yet'
              : `${memoryCount} ${memoryCount === 1 ? 'memory' : 'memories'} shared by family & friends`}
          </span>
        </div>
      )}

      <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px] max-h-[600px] bg-white/80 rounded-3xl shadow-sm border border-black/10">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[color:var(--paper-deep)]/80 rounded-2xl px-4 py-3 text-[var(--ink-soft)]">
                <span className="animate-pulse">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested questions - show only at start */}
        {messages.length === 1 && !isLoading && (
          <div className="px-4 pb-2">
            <p className="text-xs text-[color:var(--ink-soft)] opacity-70 mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="text-sm px-3 py-1.5 rounded-full border border-black/10 text-[var(--ink-soft)] hover:bg-white hover:border-black/20 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-black/10">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about your mom..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/40 focus:border-transparent disabled:bg-white/60 disabled:text-[var(--ink-soft)]"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-6 py-3 bg-[var(--ink)] text-[var(--paper)] rounded-xl hover:bg-black/80 disabled:bg-black/20 disabled:text-[var(--ink-soft)] disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* Trust disclaimer */}
      <p className="text-center text-xs text-[color:var(--ink-soft)] opacity-70 mt-3 px-4">
        This is not your mom speaking. All responses draw only from memories shared by family and friends,
        plus facts from her obituary. Nothing is invented or imagined.
      </p>
    </div>
  );
}
