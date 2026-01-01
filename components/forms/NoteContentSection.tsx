'use client';

import { useState } from 'react';
import { formStyles } from '@/lib/styles';
import { ENTRY_TYPE_CONTENT_LABELS } from '@/lib/terminology';
import type { EntryType } from '@/lib/form-types';
import RichTextEditor from '@/components/RichTextEditor';
import { generatePreviewFromHtml, PREVIEW_MAX_LENGTH } from '@/lib/html-utils';

type Props = {
  title: string;
  content: string;
  whyIncluded?: string;
  entryType: EntryType;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onWhyIncludedChange?: (whyIncluded: string) => void;
  mode?: 'rich' | 'plain'; // rich = RichTextEditor, plain = textarea
  showPreview?: boolean;
  preview?: string;
  showWhyMeaningful?: boolean; // For add form - progressive disclosure
};

export default function NoteContentSection({
  title,
  content,
  whyIncluded = '',
  entryType,
  onTitleChange,
  onContentChange,
  onWhyIncludedChange,
  mode = 'rich',
  showPreview = false,
  preview,
  showWhyMeaningful = true,
}: Props) {
  // Progressive disclosure for "why it matters"
  const [showWhy, setShowWhy] = useState(!!whyIncluded);

  const contentLabel =
    ENTRY_TYPE_CONTENT_LABELS[entryType] || 'The memory';

  return (
    <div className="space-y-4">
      <div>
        <label className={formStyles.label}>
          Title <span className={formStyles.required}>*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g., Thanksgiving laughter"
          className={formStyles.input}
          required
        />
      </div>

      <div>
        <label className={formStyles.label}>
          {contentLabel} <span className={formStyles.required}>*</span>
        </label>
        <p className={formStyles.hint}>
          The memory is the moment itself. Use &ldquo;Why it matters to you&rdquo; for how it landed.
        </p>
        {mode === 'rich' ? (
          <RichTextEditor
            value={content}
            onChange={onContentChange}
            placeholder="Share a story, a moment, or a note..."
            minHeight="120px"
          />
        ) : (
          <>
            <textarea
              required
              rows={6}
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="Share a story, a moment, or a note..."
              className={formStyles.textarea}
            />
            <div className="flex justify-end mt-1">
              <span
                className={`text-xs ${
                  content.length > 2000 ? formStyles.required : 'text-white/50'
                }`}
              >
                {content.length} characters
              </span>
            </div>
          </>
        )}
      </div>

      {/* Preview (read-only) - for edit mode */}
      {showPreview && (
        <div>
          <div className="flex items-center justify-between">
            <label className={formStyles.label}>Preview (timeline hover)</label>
            <span className={formStyles.hint}>auto-trimmed to 160 chars</span>
          </div>
          <textarea
            readOnly
            value={(() => {
              return generatePreviewFromHtml(content || preview || '', PREVIEW_MAX_LENGTH);
            })()}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white/70 text-sm cursor-not-allowed"
          />
        </div>
      )}

      {/* Why it matters - with progressive disclosure for add mode */}
      {onWhyIncludedChange && showWhyMeaningful && (
        <>
          {!showWhy && !whyIncluded ? (
            <button
              type="button"
              onClick={() => setShowWhy(true)}
              className={formStyles.buttonGhost}
            >
              <span className={formStyles.disclosureArrow}>&#9654;</span>Add why
              it matters to you
            </button>
          ) : (
            <div>
              {mode === 'plain' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowWhy(false);
                    onWhyIncludedChange('');
                  }}
                  className={`${formStyles.buttonGhost} mb-2`}
                >
                  <span className={formStyles.disclosureArrow}>&#9660;</span>Why
                  it matters to you
                </button>
              )}
              {mode === 'rich' && (
                <label className={formStyles.label}>
                  Why it matters to you
                </label>
              )}
              {mode === 'plain' && (
                <p className={formStyles.hint}>
                  Optional: your personal impact. Appears as an italic note beneath your memory.
                </p>
              )}
              {mode === 'rich' ? (
                <RichTextEditor
                  value={whyIncluded}
                  onChange={onWhyIncludedChange}
                  placeholder="How it landed for you, and why you still carry it..."
                  minHeight="80px"
                />
              ) : (
                <textarea
                  rows={2}
                  value={whyIncluded}
                  onChange={(e) => onWhyIncludedChange(e.target.value)}
                  placeholder="How it landed for you, and why you still carry it..."
                  className={`${formStyles.textarea} mt-2`}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
