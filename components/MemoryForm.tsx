'use client';

import { useEffect, useRef, useState } from 'react';

const TAGS = [
  'funny',
  'heartfelt',
  'childhood',
  'advice',
  'faith',
  'family',
  'work',
  'holiday',
];

const ALL_PROMPTS = [
  // Sensory & specific
  "Val's laugh sounded like...",
  "When Val walked into a room...",
  "The way Val said 'thank you'...",
  "Val at the piano...",
  "Val's hands were always...",

  // Her passions from obituary
  "A dessert Val made that I'll never forget...",
  "Val on a hike or road trip...",
  "Val at a basketball game...",
  "Something Val crafted or sewed...",
  "Val and her Pepsi...",

  // Relationships
  "The way Val looked at Derek...",
  "Val with her kids...",
  "Val talking about her dad...",
  "Val as a cousin/friend/neighbor...",

  // Character moments
  "A time Val surprised me...",
  "Something unexpectedly funny Val did...",
  "Val never missed a chance to...",
  "The most 'Val' thing ever was when...",
  "A small thing Val did that meant everything...",

  // Her impact
  "Val taught me how to...",
  "What made Val's nursing care different...",
  "Val's advice when things got hard...",
  "Val at church or serving others...",
  "How Val made holidays special...",

  // Deep reflection
  "I wish Val knew that...",
  "Something about Val I didn't appreciate until later...",
  "Val showed me what it means to...",
  "The last time I saw Val...",
  "Val's kids should know their mom...",

  // Quirky & unique
  "Val's favorite thing to talk about...",
  "Something quirky about Val that I loved...",
  "Val in the car...",
  "Val's go-to phrase was...",
  "A tradition Val started...",
];

// Get 6 random prompts
function getRandomPrompts() {
  const shuffled = [...ALL_PROMPTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 6);
}

export default function MemoryForm() {
  const [formData, setFormData] = useState({
    content: '',
    submitter_name: '',
    submitter_relationship: '',
    submitter_email: '',
    tags: [] as string[],
  });

  const toggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [prompts, setPrompts] = useState<string[]>(ALL_PROMPTS.slice(0, 6));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Randomize prompts on client only to avoid hydration mismatch
  useEffect(() => {
    setPrompts(getRandomPrompts());
  }, []);

  const shufflePrompts = () => {
    setPrompts(getRandomPrompts());
  };

  const handlePromptClick = (prompt: string) => {
    setFormData({ ...formData, content: prompt + ' ' });
    // Focus and move cursor to end
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(
          textareaRef.current.value.length,
          textareaRef.current.value.length
        );
      }
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to submit memory');
      }

      setIsSubmitted(true);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto bg-white/80 rounded-3xl shadow-sm border border-black/10 p-6 sm:p-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-serif text-[var(--ink)] mb-4">Thank you</h2>
        <p className="text-[var(--ink-soft)] mb-6">
          Your memory has been added and will help her children
          know their mother through the eyes of those who loved her.
        </p>
        <button
          onClick={() => {
            setIsSubmitted(false);
            setFormData({
              content: '',
              submitter_name: '',
              submitter_relationship: '',
              submitter_email: '',
              tags: [],
            });
          }}
          className="px-6 py-3 bg-[var(--ink)] text-[var(--paper)] rounded-xl hover:bg-black/80 transition-colors"
        >
          Share Another Memory
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl mx-auto bg-white/80 rounded-3xl shadow-sm border border-black/10 p-6 sm:p-8"
    >
      <div className="space-y-6">
        {/* Prompts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-[var(--ink-soft)]">
              Not sure where to start? Click a prompt:
            </p>
            <button
              type="button"
              onClick={shufflePrompts}
              className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] flex items-center gap-1 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              More prompts
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handlePromptClick(prompt)}
                className="text-sm px-3 py-1.5 rounded-full border border-black/10 text-[var(--ink-soft)] hover:bg-white hover:border-black/20 transition-colors text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Memory content */}
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-[var(--ink)] mb-2">
            Your memory of Val <span className="text-red-500">*</span>
          </label>
          <textarea
            ref={textareaRef}
            id="content"
            required
            rows={6}
            value={formData.content}
            onChange={e => setFormData({ ...formData, content: e.target.value })}
            placeholder="Share a story, a moment, something she said, or anything that captures who Val was..."
            className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/40 focus:border-transparent resize-none"
          />
          <div className="flex justify-end mt-1">
            <span className={`text-xs ${formData.content.length > 2000 ? 'text-red-500' : 'text-[color:var(--ink-soft)] opacity-70'}`}>
              {formData.content.length} characters
            </span>
          </div>
        </div>

        {/* Attribution - name and relationship */}
        <div className="bg-[color:var(--paper-deep)]/60 rounded-xl p-4 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-[var(--ink)] mb-2">
              Your name
            </label>
            <input
              type="text"
              id="name"
              value={formData.submitter_name}
              onChange={e => setFormData({ ...formData, submitter_name: e.target.value })}
              placeholder="e.g., Amy Grant"
              className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/40 focus:border-transparent bg-white"
            />
          </div>
          <div>
            <label htmlFor="relationship" className="block text-sm font-medium text-[var(--ink)] mb-2">
              Your relationship to Val
            </label>
            <input
              type="text"
              id="relationship"
              value={formData.submitter_relationship}
              onChange={e => setFormData({ ...formData, submitter_relationship: e.target.value })}
              placeholder="e.g., cousin, friend, coworker, neighbor"
              className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/40 focus:border-transparent bg-white"
            />
          </div>
          <p className="text-sm text-[var(--ink-soft)] italic">
            Memories with names carry more weight - her children will know who to ask for more stories.
          </p>
        </div>

        {/* Optional tags */}
        <div>
          <label className="block text-sm font-medium text-[var(--ink)] mb-2">
            Tags <span className="font-normal text-[color:var(--ink-soft)] opacity-70">(optional, helps with search)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  formData.tags.includes(tag)
                    ? 'bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]'
                    : 'border-black/10 text-[var(--ink-soft)] hover:bg-white'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Email - collapsed/minimal */}
        <div>
          <label htmlFor="email" className="block text-sm text-[var(--ink-soft)] mb-1">
            Email <span className="text-[color:var(--ink-soft)] opacity-70">(optional, if you want follow-up)</span>
          </label>
          <input
            type="email"
            id="email"
            value={formData.submitter_email}
            onChange={e => setFormData({ ...formData, submitter_email: e.target.value })}
            placeholder="you@example.com"
            className="w-full px-4 py-2 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/40 focus:border-transparent text-sm"
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !formData.content.trim()}
          className="w-full px-6 py-3 bg-[var(--ink)] text-[var(--paper)] rounded-xl hover:bg-black/80 disabled:bg-black/20 disabled:text-[var(--ink-soft)] disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Submitting...' : 'Share This Memory'}
        </button>
      </div>
    </form>
  );
}
