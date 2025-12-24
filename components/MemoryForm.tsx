'use client';

import { useRef, useState } from 'react';

export default function MemoryForm() {
  const [formData, setFormData] = useState({
    entry_type: 'memory',
    year: '',
    title: '',
    content: '',
    submitter_name: '',
    submitter_relationship: '',
    submitter_email: '',
    source_name: '',
    source_url: '',
    why_included: '',
    attachment_type: 'none',
    attachment_url: '',
    attachment_caption: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      <div className="max-w-2xl mx-auto p-6 sm:p-8 text-center text-white">
        <h2 className="text-2xl sm:text-3xl font-serif text-white mb-4">Thank you</h2>
        <p className="text-white/70 mb-6">
          Your note has been added and will help her children
          know their mother through the eyes of those who loved her.
        </p>
        <button
          onClick={() => {
            setIsSubmitted(false);
            setFormData({
              entry_type: 'memory',
              year: '',
              title: '',
              content: '',
              submitter_name: '',
              submitter_relationship: '',
              submitter_email: '',
              source_name: '',
              source_url: '',
              why_included: '',
              attachment_type: 'none',
              attachment_url: '',
              attachment_caption: '',
            });
          }}
          className="px-6 py-3 bg-[#e07a5f] text-white rounded-xl hover:bg-[#d06a4f] transition-colors"
        >
          Share Another Note
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl mx-auto p-6 sm:p-8 text-white"
    >
      <div className="space-y-6">
        {/* Entry basics */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="entry_type" className="block text-sm font-medium text-white mb-2">
                Entry type
              </label>
              <select
                id="entry_type"
                value={formData.entry_type}
                onChange={(e) => setFormData({ ...formData, entry_type: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent"
              >
                <option value="memory">Memory</option>
                <option value="milestone">Milestone</option>
                <option value="origin">Synchronicity-based storytelling</option>
              </select>
            </div>
            <div>
              <label htmlFor="year" className="block text-sm font-medium text-white mb-2">
                Year <span className="text-red-300">*</span>
              </label>
              <input
                type="number"
                id="year"
                min="0"
                inputMode="numeric"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                placeholder="e.g., 1996"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-white mb-2">
              Title <span className="text-red-300">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Thanksgiving laughter"
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent"
              required
            />
          </div>
        </div>

        {/* Note content */}
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-white mb-2">
            Your note about Val <span className="text-red-300">*</span>
          </label>
          <textarea
            ref={textareaRef}
            id="content"
            required
            rows={6}
            value={formData.content}
            onChange={e => setFormData({ ...formData, content: e.target.value })}
            placeholder="Share a story, a moment, or a note that captures who Val was..."
            className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent focus:bg-white/10 resize-none"
          />
          <div className="flex justify-end mt-1">
            <span className={`text-xs ${formData.content.length > 2000 ? 'text-red-300' : 'text-white/40'}`}>
              {formData.content.length} characters
            </span>
          </div>
        </div>

        {formData.entry_type === 'origin' && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">
              Synchronicity details
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="source_name" className="block text-sm font-medium text-white mb-2">
                  Source name (optional)
                </label>
                <input
                  type="text"
                  id="source_name"
                  value={formData.source_name}
                  onChange={(e) => setFormData({ ...formData, source_name: e.target.value })}
                  placeholder="e.g., Wikipedia"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="source_url" className="block text-sm font-medium text-white mb-2">
                  Source link (optional)
                </label>
                <input
                  type="url"
                  id="source_url"
                  value={formData.source_url}
                  onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label htmlFor="why_included" className="block text-sm font-medium text-white mb-2">
                Why this note belongs (optional)
              </label>
              <textarea
                id="why_included"
                rows={3}
                value={formData.why_included}
                onChange={(e) => setFormData({ ...formData, why_included: e.target.value })}
                placeholder="Explain the connection or resonance in a sentence or two."
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent focus:bg-white/10 resize-none"
              />
            </div>
          </div>
        )}

        {/* Attachment */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-white/40">
            Attachment (optional)
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="attachment_type" className="block text-sm font-medium text-white mb-2">
                Type
              </label>
              <select
                id="attachment_type"
                value={formData.attachment_type}
                onChange={(e) => setFormData({ ...formData, attachment_type: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent"
              >
                <option value="none">None</option>
                <option value="image">Image</option>
                <option value="audio">Audio</option>
                <option value="link">Link</option>
              </select>
            </div>
            <div>
              <label htmlFor="attachment_url" className="block text-sm font-medium text-white mb-2">
                URL
              </label>
              <input
                type="url"
                id="attachment_url"
                value={formData.attachment_url}
                onChange={(e) => setFormData({ ...formData, attachment_url: e.target.value })}
                placeholder="https://..."
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent"
                disabled={formData.attachment_type === 'none'}
              />
            </div>
          </div>
          <div>
            <label htmlFor="attachment_caption" className="block text-sm font-medium text-white mb-2">
              Caption (optional)
            </label>
            <input
              type="text"
              id="attachment_caption"
              value={formData.attachment_caption}
              onChange={(e) => setFormData({ ...formData, attachment_caption: e.target.value })}
              placeholder="A short description for the attachment"
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent"
              disabled={formData.attachment_type === 'none'}
            />
          </div>
          <p className="text-xs text-white/40">
            Paste a link to an image, audio file, or external page.
          </p>
        </div>

        {/* Attribution - name and relationship */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
              Your name
            </label>
            <input
              type="text"
              id="name"
              value={formData.submitter_name}
              onChange={e => setFormData({ ...formData, submitter_name: e.target.value })}
              placeholder="e.g., Sarah"
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent focus:bg-white/15"
            />
          </div>
          <div>
            <label htmlFor="relationship" className="block text-sm font-medium text-white mb-2">
              Your relationship to Val
            </label>
            <input
              type="text"
              id="relationship"
              value={formData.submitter_relationship}
              onChange={e => setFormData({ ...formData, submitter_relationship: e.target.value })}
              placeholder="e.g., cousin, friend, coworker, neighbor"
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent focus:bg-white/15"
            />
          </div>
        </div>

        {/* Email - collapsed/minimal */}
        <div>
          <label htmlFor="email" className="block text-sm text-white/60 mb-1">
            Email <span className="text-white/50">(optional, if you want follow-up)</span>
          </label>
          <input
            type="email"
            id="email"
            value={formData.submitter_email}
            onChange={e => setFormData({ ...formData, submitter_email: e.target.value })}
            placeholder="you@example.com"
            className="w-full px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent text-sm"
          />
        </div>

        {error && (
          <p className="text-red-300 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !formData.content.trim()}
          className="w-full px-6 py-3 bg-[#e07a5f] text-white rounded-xl hover:bg-[#d06a4f] disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Submitting...' : 'Share This Memory'}
        </button>
      </div>
    </form>
  );
}
