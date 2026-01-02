'use client';

import { useRef } from 'react';
import { formStyles } from '@/lib/styles';
import { getLintSuggestion } from '@/lib/lint-copy';
import type { LintWarning } from '@/lib/note-lint';
import RichTextEditor from '@/components/RichTextEditor';
import { generatePreviewFromHtml, PREVIEW_MAX_LENGTH } from '@/lib/html-utils';
import { DisclosureSection } from './DisclosureSection';
import {
  getContentLabel,
  CONTENT_SECTION,
  WHY_IT_MATTERS,
  WRITING_GUIDANCE,
  TITLE_FIELD,
} from './note-form-config';

type Props = {
  // Core values
  title: string;
  content: string;
  whyIncluded: string;
  entryType: string;

  // Callbacks
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onWhyIncludedChange: (whyIncluded: string) => void;

  // Lint warnings
  lintWarnings?: LintWarning[];

  // Guidance expansion state (controlled)
  showGuidanceWhy?: boolean;
  onToggleGuidanceWhy?: () => void;

  // "Why it matters" disclosure state (controlled)
  showWhyMeaningful: boolean;
  onToggleWhyMeaningful: (open: boolean) => void;

  // Options
  showTitle?: boolean;
  showPreview?: boolean;
  titleRequired?: boolean;
  contentRequired?: boolean;
};

/**
 * Shared content section for note forms.
 * Handles title, content, lint warnings, and "why it matters".
 * Used by both MemoryForm (add) and EditNotesClient (edit).
 */
export default function NoteContentSection({
  title,
  content,
  whyIncluded,
  entryType,
  onTitleChange,
  onContentChange,
  onWhyIncludedChange,
  lintWarnings = [],
  showGuidanceWhy = false,
  onToggleGuidanceWhy,
  showWhyMeaningful,
  onToggleWhyMeaningful,
  showTitle = true,
  showPreview = false,
  titleRequired = true,
  contentRequired = true,
}: Props) {
  const whyMeaningfulRef = useRef<HTMLDivElement | null>(null);

  const contentLabel = getContentLabel(entryType);

  const lintTone = (severity?: LintWarning['severity']) => ({
    message: severity === 'soft' ? formStyles.guidanceWarningMessageSoft : formStyles.guidanceWarningMessage,
    suggestion: severity === 'soft' ? formStyles.guidanceSuggestionSoft : formStyles.guidanceSuggestion,
  });

  const openWhyMeaningful = () => {
    onToggleWhyMeaningful(true);
    setTimeout(() => {
      whyMeaningfulRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      {showTitle && (
        <div>
          <label className={formStyles.label}>
            {TITLE_FIELD.label}
            {titleRequired && <span className={formStyles.required}> *</span>}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={TITLE_FIELD.placeholder}
            className={formStyles.input}
            required={titleRequired}
          />
        </div>
      )}

      {/* Content */}
      <div>
        <label className={formStyles.label}>
          {contentLabel}
          {contentRequired && <span className={formStyles.required}> *</span>}
        </label>
        <p className={`${formStyles.hint} mb-2`}>{CONTENT_SECTION.hint}</p>
        <RichTextEditor
          value={content}
          onChange={onContentChange}
          placeholder={CONTENT_SECTION.placeholder}
          minHeight="120px"
        />

        {/* Lint warnings / Writing guidance */}
        {lintWarnings.length > 0 && (
          <div className={formStyles.guidanceContainer}>
            <div className={formStyles.guidanceHeader}>
              <span className={formStyles.guidanceDot} />
              <span className={formStyles.guidanceLabel}>{WRITING_GUIDANCE.label}</span>
              {onToggleGuidanceWhy && (
                <button
                  type="button"
                  onClick={onToggleGuidanceWhy}
                  className={formStyles.guidanceToggle}
                >
                  {showGuidanceWhy ? WRITING_GUIDANCE.toggleHide : WRITING_GUIDANCE.toggleShow}
                </button>
              )}
            </div>
            {showGuidanceWhy && (
              <p className={formStyles.guidanceExplainer}>
                {WRITING_GUIDANCE.explainer}
              </p>
            )}
            <div className="space-y-3">
              {lintWarnings.map((warning, idx) => {
                const tone = lintTone(warning.severity);
                const suggestion = getLintSuggestion(warning.code, warning.suggestion, warning.message);
                return (
                  <div key={`${warning.code}-${idx}`} className="space-y-0.5">
                    <p className={tone.message}>
                      {warning.match && (
                        <span className={formStyles.guidanceMatch}>
                          &ldquo;{warning.match}&rdquo;
                        </span>
                      )}
                      {warning.match ? ' - ' : ''}{warning.message}
                    </p>
                    {suggestion && (
                      <p className={tone.suggestion}>{suggestion}</p>
                    )}
                    {warning.code === 'MEANING_ASSERTION' && (
                      <button
                        type="button"
                        onClick={openWhyMeaningful}
                        className={formStyles.guidanceAction}
                      >
                        {WRITING_GUIDANCE.meaningAssertionAction}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Preview (read-only) - for edit mode */}
      {showPreview && (
        <div>
          <div className="flex items-center justify-between">
            <label className={formStyles.label}>Preview (timeline hover)</label>
            <span className={formStyles.hint}>auto-trimmed to {PREVIEW_MAX_LENGTH} chars</span>
          </div>
          <textarea
            readOnly
            value={generatePreviewFromHtml(content || '', PREVIEW_MAX_LENGTH)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white/70 text-sm cursor-not-allowed"
          />
        </div>
      )}

      {/* Why it matters to you */}
      <div ref={whyMeaningfulRef}>
        <DisclosureSection
          label={WHY_IT_MATTERS.label}
          addLabel={WHY_IT_MATTERS.addLabel}
          isOpen={showWhyMeaningful}
          onToggle={onToggleWhyMeaningful}
          hasContent={Boolean(whyIncluded)}
          onClear={() => onWhyIncludedChange('')}
          variant="inset"
        >
          <p className="text-xs text-white/40 mb-2 italic">
            {WHY_IT_MATTERS.hint}
          </p>
          <RichTextEditor
            value={whyIncluded}
            onChange={onWhyIncludedChange}
            placeholder={WHY_IT_MATTERS.placeholder}
            minHeight="80px"
          />
        </DisclosureSection>
      </div>
    </div>
  );
}
