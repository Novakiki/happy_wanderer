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
  phone: string | null;
  trusted: boolean | null;
  disabled_at: string | null;
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
  const [editingContributor, setEditingContributor] = useState<Record<string, boolean>>({});
  const [contributorDrafts, setContributorDrafts] = useState<
    Record<string, { name: string; relation: string; email: string; phone: string }>
  >({});

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

  const updateContributor = async (
    contributorId: string,
    updates: Partial<{
      trusted: boolean;
      disabled: boolean;
      name: string;
      relation: string;
      email: string | null;
      phone: string | null;
    }>
  ) => {
    setTrustBusy((prev) => ({ ...prev, [contributorId]: true }));
    setTrustErrors((prev) => ({ ...prev, [contributorId]: '' }));

    try {
      const res = await fetch('/api/admin/contributors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributor_id: contributorId, ...updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTrustErrors((prev) => ({
          ...prev,
          [contributorId]: data?.error || 'Could not update trust.',
        }));
        return false;
      }
      setContributorsState((prev) => {
        const next = prev.map((contributor) => {
          if (contributor.id !== contributorId) return contributor;
          const disabledAt =
            typeof updates.disabled === 'boolean'
              ? updates.disabled
                ? new Date().toISOString()
                : null
              : contributor.disabled_at;
          return {
            ...contributor,
            ...(typeof updates.trusted === 'boolean' ? { trusted: updates.trusted } : null),
            ...(typeof updates.name === 'string' ? { name: updates.name } : null),
            ...(typeof updates.relation === 'string' ? { relation: updates.relation } : null),
            ...('email' in updates ? { email: updates.email ?? null } : null),
            ...('phone' in updates ? { phone: updates.phone ?? null } : null),
            disabled_at: disabledAt,
          };
        });

        // Keep disabled contributors at the bottom.
        return next.sort((a, b) => {
          const aDisabled = Boolean(a.disabled_at);
          const bDisabled = Boolean(b.disabled_at);
          if (aDisabled !== bDisabled) return aDisabled ? 1 : -1;
          return a.name.localeCompare(b.name);
        });
      });
      return true;
    } catch (err) {
      console.error(err);
      setTrustErrors((prev) => ({
        ...prev,
        [contributorId]: 'Could not update trust.',
      }));
      return false;
    } finally {
      setTrustBusy((prev) => ({ ...prev, [contributorId]: false }));
    }
  };

  const updateContributorTrust = async (contributorId: string, trusted: boolean) => {
    return updateContributor(contributorId, { trusted });
  };

  const toggleContributorDisabled = async (contributorId: string, disabled: boolean) => {
    return updateContributor(contributorId, { disabled });
  };

  const startEditingContributor = (contributor: Contributor) => {
    setEditingContributor((prev) => ({ ...prev, [contributor.id]: true }));
    setContributorDrafts((prev) => ({
      ...prev,
      [contributor.id]: {
        name: contributor.name ?? '',
        relation: contributor.relation ?? '',
        email: contributor.email ?? '',
        phone: contributor.phone ?? '',
      },
    }));
  };

  const cancelEditingContributor = (contributorId: string) => {
    setEditingContributor((prev) => ({ ...prev, [contributorId]: false }));
    setContributorDrafts((prev) => {
      const next = { ...prev };
      delete next[contributorId];
      return next;
    });
  };

  const saveContributorEdits = async (contributorId: string) => {
    const draft = contributorDrafts[contributorId];
    if (!draft) return;

    const name = draft.name.trim();
    const relation = draft.relation.trim();
    if (!name || !relation) {
      setTrustErrors((prev) => ({
        ...prev,
        [contributorId]: 'Name and relationship are required.',
      }));
      return;
    }

    const email = draft.email.trim();
    const phone = draft.phone.trim();

    const ok = await updateContributor(contributorId, {
      name,
      relation,
      email: email ? email : null,
      phone: phone ? phone : null,
    });

    if (ok) {
      cancelEditingContributor(contributorId);
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
          <span className="text-xs text-white/50">Auto-publish skips review</span>
        </div>
        {contributorsState.length === 0 ? (
          <p className="text-sm text-white/60">No contributors yet.</p>
        ) : (
          <div className="space-y-3">
            {contributorsState.map((contributor) => {
              const trusted = Boolean(contributor.trusted);
              const disabled = Boolean(contributor.disabled_at);
              const isBusy = Boolean(trustBusy[contributor.id]);
              const isEditing = Boolean(editingContributor[contributor.id]);
              const draft = contributorDrafts[contributor.id];

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
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {disabled ? (
                        <span className="text-xs text-white/50 border border-white/20 rounded-full px-3 py-1">
                          Access paused
                        </span>
                      ) : (
                        <span className="text-xs text-white/70 border border-white/20 rounded-full px-3 py-1">
                          Active
                        </span>
                      )}
                      {trusted && !disabled && (
                        <span className="text-xs text-[#e07a5f] border border-[#e07a5f]/40 rounded-full px-3 py-1">
                          Auto-publish
                        </span>
                      )}
                    </div>

                    {isEditing && draft && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className="space-y-1">
                          <span className={formStyles.label}>Name</span>
                          <input
                            className={formStyles.input}
                            value={draft.name}
                            onChange={(e) =>
                              setContributorDrafts((prev) => ({
                                ...prev,
                                [contributor.id]: { ...prev[contributor.id], name: e.target.value },
                              }))
                            }
                          />
                        </label>
                        <label className="space-y-1">
                          <span className={formStyles.label}>Relationship</span>
                          <input
                            className={formStyles.input}
                            value={draft.relation}
                            onChange={(e) =>
                              setContributorDrafts((prev) => ({
                                ...prev,
                                [contributor.id]: { ...prev[contributor.id], relation: e.target.value },
                              }))
                            }
                          />
                        </label>
                        <label className="space-y-1">
                          <span className={formStyles.label}>Email (optional)</span>
                          <input
                            className={formStyles.input}
                            value={draft.email}
                            onChange={(e) =>
                              setContributorDrafts((prev) => ({
                                ...prev,
                                [contributor.id]: { ...prev[contributor.id], email: e.target.value },
                              }))
                            }
                          />
                        </label>
                        <label className="space-y-1">
                          <span className={formStyles.label}>Phone (optional)</span>
                          <input
                            className={formStyles.input}
                            value={draft.phone}
                            onChange={(e) =>
                              setContributorDrafts((prev) => ({
                                ...prev,
                                [contributor.id]: { ...prev[contributor.id], phone: e.target.value },
                              }))
                            }
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className={formStyles.buttonSecondary}
                          disabled={isBusy}
                          onClick={() => saveContributorEdits(contributor.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className={formStyles.buttonSecondary}
                          disabled={isBusy}
                          onClick={() => cancelEditingContributor(contributor.id)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={formStyles.buttonSecondary}
                          disabled={isBusy}
                          onClick={() => startEditingContributor(contributor)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={formStyles.buttonSecondary}
                          disabled={isBusy}
                          onClick={() => toggleContributorDisabled(contributor.id, !disabled)}
                        >
                          {disabled ? 'Restore access' : 'Pause access'}
                        </button>
                        <button
                          type="button"
                          className={formStyles.buttonSecondary}
                          disabled={isBusy || disabled}
                          onClick={() => updateContributorTrust(contributor.id, !trusted)}
                          title={disabled ? 'Auto-publish is disabled while access is paused.' : undefined}
                        >
                          {trusted ? 'Disable auto-publish' : 'Enable auto-publish'}
                        </button>
                      </>
                    )}
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
