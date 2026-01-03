'use client';

import { useState } from 'react';
import { ENTRY_TYPE_LABELS } from '@/lib/terminology';
import { formStyles } from '@/lib/styles';

type PendingNote = {
  id: string;
  title: string | null;
  year: number;
  year_end: number | null;
  type: string | null;
  status: string | null;
  preview: string | null;
  full_entry: string | null;
  why_included: string | null;
  source_name: string | null;
  source_url: string | null;
  created_at: string | null;
  privacy_level: string | null;
  contributor_id: string | null;
  contributor: { id: string; name: string | null; relation: string | null } | null;
};

type Contributor = {
  id: string;
  name: string;
  relation: string;
  email: string | null;
  trusted: boolean | null;
};

type Props = {
  pendingNotes: PendingNote[];
  contributors: Contributor[];
};

const PENDING_ACTIONS = [
  { label: 'Publish', status: 'published' },
  { label: 'Set private', status: 'private' },
] as const;

function formatYearRange(note: PendingNote) {
  if (note.year_end && note.year_end !== note.year) {
    return `${note.year}–${note.year_end}`;
  }
  return `${note.year}`;
}

function formatTypeLabel(type: string | null) {
  if (!type) return 'Note';
  return ENTRY_TYPE_LABELS[type as keyof typeof ENTRY_TYPE_LABELS] ?? 'Note';
}

function formatContributor(note: PendingNote) {
  const name = note.contributor?.name || 'Unknown contributor';
  const relation = note.contributor?.relation;
  return relation ? `${name} · ${relation}` : name;
}

function formatSource(note: PendingNote) {
  const parts = [];
  if (note.source_name) parts.push(note.source_name);
  if (note.source_url) parts.push(note.source_url);
  return parts.join(' · ');
}

function getPreview(note: PendingNote) {
  const base = note.preview || note.full_entry || '';
  if (!base) return '';
  if (base.length <= 260) return base;
  return `${base.slice(0, 260).trim()}...`;
}

export default function AdminDashboard({ pendingNotes, contributors }: Props) {
  const [notes, setNotes] = useState<PendingNote[]>(pendingNotes);
  const [contributorsState, setContributorsState] = useState<Contributor[]>(contributors);
  const [noteBusy, setNoteBusy] = useState<Record<string, boolean>>({});
  const [noteErrors, setNoteErrors] = useState<Record<string, string>>({});
  const [trustBusy, setTrustBusy] = useState<Record<string, boolean>>({});
  const [trustErrors, setTrustErrors] = useState<Record<string, string>>({});

  const updateNoteStatus = async (noteId: string, status: 'published' | 'private') => {
    setNoteBusy((prev) => ({ ...prev, [noteId]: true }));
    setNoteErrors((prev) => ({ ...prev, [noteId]: '' }));

    try {
      const res = await fetch('/api/admin/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: noteId, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNoteErrors((prev) => ({
          ...prev,
          [noteId]: data?.error || 'Could not update this note.',
        }));
        return;
      }
      setNotes((prev) => prev.filter((note) => note.id !== noteId));
    } catch (err) {
      console.error(err);
      setNoteErrors((prev) => ({
        ...prev,
        [noteId]: 'Could not update this note.',
      }));
    } finally {
      setNoteBusy((prev) => ({ ...prev, [noteId]: false }));
    }
  };

  const updateContributorTrust = async (contributorId: string, trusted: boolean) => {
    setTrustBusy((prev) => ({ ...prev, [contributorId]: true }));
    setTrustErrors((prev) => ({ ...prev, [contributorId]: '' }));

    try {
      const res = await fetch('/api/admin/contributors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributor_id: contributorId, trusted }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTrustErrors((prev) => ({
          ...prev,
          [contributorId]: data?.error || 'Could not update trust.',
        }));
        return;
      }
      setContributorsState((prev) =>
        prev.map((contributor) =>
          contributor.id === contributorId ? { ...contributor, trusted } : contributor
        )
      );
    } catch (err) {
      console.error(err);
      setTrustErrors((prev) => ({
        ...prev,
        [contributorId]: 'Could not update trust.',
      }));
    } finally {
      setTrustBusy((prev) => ({ ...prev, [contributorId]: false }));
    }
  };

  return (
    <div className="space-y-10">
      <section className={formStyles.section}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Pending notes</h2>
          <span className="text-xs text-white/50">{notes.length} pending</span>
        </div>
        {notes.length === 0 ? (
          <p className="text-sm text-white/60">No pending notes right now.</p>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => {
              const preview = getPreview(note);
              const typeLabel = formatTypeLabel(note.type);
              const contributorLabel = formatContributor(note);
              const sourceLine = formatSource(note);
              const isBusy = Boolean(noteBusy[note.id]);

              return (
                <div
                  key={note.id}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 space-y-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-white">{note.title || 'Untitled note'}</p>
                      <p className="text-xs text-white/50">
                        {typeLabel} · {formatYearRange(note)} · {contributorLabel}
                      </p>
                      {note.privacy_level && (
                        <span className="text-xs text-white/50">
                          Privacy: {note.privacy_level}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {PENDING_ACTIONS.map((action) => (
                        <button
                          key={action.status}
                          type="button"
                          className={formStyles.buttonSecondary}
                          disabled={isBusy}
                          onClick={() => updateNoteStatus(note.id, action.status)}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {preview && (
                    <p className="text-sm text-white/70 whitespace-pre-line">{preview}</p>
                  )}

                  {note.full_entry && note.full_entry !== preview && (
                    <details className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <summary className="text-xs uppercase tracking-[0.2em] text-white/50 cursor-pointer">
                        Full entry
                      </summary>
                      <p className="mt-3 text-sm text-white/70 whitespace-pre-line">
                        {note.full_entry}
                      </p>
                    </details>
                  )}

                  {note.why_included && (
                    <p className="text-sm text-white/60 italic">
                      Why this note: {note.why_included}
                    </p>
                  )}

                  {sourceLine && (
                    <p className="text-xs text-white/50">Source: {sourceLine}</p>
                  )}

                  {noteErrors[note.id] && (
                    <p className={formStyles.error}>{noteErrors[note.id]}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className={formStyles.section}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Contributors</h2>
          <span className="text-xs text-white/50">Trusted contributors auto-publish</span>
        </div>
        {contributorsState.length === 0 ? (
          <p className="text-sm text-white/60">No contributors yet.</p>
        ) : (
          <div className="space-y-3">
            {contributorsState.map((contributor) => {
              const trusted = Boolean(contributor.trusted);
              const isBusy = Boolean(trustBusy[contributor.id]);
              const label = trusted ? 'Revoke trust' : 'Mark trusted';

              return (
                <div
                  key={contributor.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-white">{contributor.name}</p>
                    <p className="text-xs text-white/50">
                      {contributor.relation}
                      {contributor.email ? ` · ${contributor.email}` : ''}
                    </p>
                    {trustErrors[contributor.id] && (
                      <p className={formStyles.error}>{trustErrors[contributor.id]}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        trusted
                          ? 'text-xs text-[#e07a5f] border border-[#e07a5f]/40 rounded-full px-3 py-1'
                          : 'text-xs text-white/50 border border-white/20 rounded-full px-3 py-1'
                      }
                    >
                      {trusted ? 'Trusted' : 'Untrusted'}
                    </span>
                    <button
                      type="button"
                      className={formStyles.buttonSecondary}
                      disabled={isBusy}
                      onClick={() => updateContributorTrust(contributor.id, !trusted)}
                    >
                      {label}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
