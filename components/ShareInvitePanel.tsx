"use client";

import { useEffect, useMemo, useState } from "react";
import { generatePreviewFromHtml, PREVIEW_MAX_LENGTH } from "@/lib/html-utils";
import { RELATIONSHIP_OPTIONS } from "@/lib/terminology";

type ShareInvitePanelProps = {
  eventId: string;
  title: string;
  content: string;
  contributorName: string | null;
  contributorRelation: string | null;
  year: number;
  yearEnd: number | null;
  timingCertainty: "exact" | "approximate" | "vague" | null;
  eventType: "memory" | "milestone" | "origin" | null;
  viewerIsOwner?: boolean;
};

const RELATIONSHIP_GROUPS = {
  family: [
    "parent",
    "child",
    "sibling",
    "cousin",
    "aunt_uncle",
    "niece_nephew",
    "grandparent",
    "grandchild",
    "in_law",
    "spouse",
  ],
  social: ["friend", "neighbor", "coworker", "classmate"],
  other: ["acquaintance", "other", "unknown"],
} as const;

function formatYearLabel(
  year: number,
  yearEnd: number | null,
  timingCertainty: ShareInvitePanelProps["timingCertainty"]
) {
  const isApproximate = timingCertainty && timingCertainty !== "exact";
  const hasRange = typeof yearEnd === "number" && yearEnd !== year;
  if (hasRange) {
    return `${isApproximate ? "~" : ""}${year}-${yearEnd}`;
  }
  return isApproximate ? `~${year}` : String(year);
}

export default function ShareInvitePanel({
  eventId,
  title,
  content,
  contributorName,
  contributorRelation,
  year,
  yearEnd,
  timingCertainty,
  eventType,
  viewerIsOwner = false,
}: ShareInvitePanelProps) {
  const isMemory = eventType === "memory";
  const canInvite = isMemory && viewerIsOwner; // Only owners can invite others
  const [baseUrl, setBaseUrl] = useState("");
  const [shareMode, setShareMode] = useState<"link" | "invite">("link");

  const [isExpanded, setIsExpanded] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [relationshipToSubject, setRelationshipToSubject] = useState("");
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const [linkCopied, setLinkCopied] = useState(false);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (!isMemory) {
      setShareMode("link");
    }
  }, [isMemory]);

  const previewText = useMemo(() => {
    if (!content) return "";
    return generatePreviewFromHtml(content, PREVIEW_MAX_LENGTH);
  }, [content]);

  const copyShareLink = async () => {
    if (!baseUrl) return;
    const link = `${baseUrl}/memory/${eventId}`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setShareError(null);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setShareError("Could not copy the link. Please try again.");
    }
  };

  const copyInviteLink = async () => {
    if (!baseUrl || !inviteId) return;
    const link = `${baseUrl}/respond/${inviteId}`;
    try {
      await navigator.clipboard.writeText(link);
      setInviteLinkCopied(true);
      setTimeout(() => setInviteLinkCopied(false), 2000);
    } catch {
      setInviteError("Could not copy the invite link. Please try again.");
    }
  };

  const handleSendInvite = async () => {
    const trimmedRecipient = recipientName.trim();
    if (!eventId || !trimmedRecipient) return;

    setInviteSending(true);
    setInviteError(null);
    setInviteId(null);
    setInviteLinkCopied(false);

    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          recipient_name: trimmedRecipient,
          recipient_contact: "link",
          method: "link",
          message: "",
          relationship_to_subject: relationshipToSubject,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Invite failed");
      }

      if (data?.invite_id) {
        setInviteId(data.invite_id);
      } else {
        throw new Error("Invite created without an ID");
      }

    } catch (error) {
      console.error(error);
      setInviteError("Could not create invite. Please try again.");
    } finally {
      setInviteSending(false);
    }
  };

  return (
    <div className="mt-8">
      {/* Collapsed state: inline share button */}
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/70 hover:bg-white/10 hover:border-white/20 transition-colors text-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Share
        </button>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#111111]/80 overflow-hidden">
          {/* Header with inline tabs */}
          <div className="px-5 py-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Share</p>
                {canInvite && (
                  <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
                    <button
                      onClick={() => setShareMode("link")}
                      className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                        shareMode === "link"
                          ? "bg-white/15 text-white"
                          : "text-white/50 hover:text-white/70"
                      }`}
                    >
                      Link
                    </button>
                    <button
                      onClick={() => setShareMode("invite")}
                      className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                        shareMode === "invite"
                          ? "bg-white/15 text-white"
                          : "text-white/50 hover:text-white/70"
                      }`}
                    >
                      Invite
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded text-white/30 hover:text-white/60 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

      {(shareMode === "link" || !isMemory) && (
        <div className="p-4">
          {/* Inline link with copy button */}
          <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1 pl-3 border border-white/10">
            <span className="flex-1 text-xs text-white/50 truncate font-mono">
              {baseUrl ? `${baseUrl}/memory/${eventId}` : "Loading..."}
            </span>
            <button
              onClick={copyShareLink}
              disabled={!baseUrl}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                linkCopied
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-[#e07a5f] text-white hover:bg-[#d06a4f]"
              }`}
            >
              {linkCopied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
          {shareError && (
            <p className="text-xs text-red-300 mt-2">{shareError}</p>
          )}
          <p className="text-xs text-white/40 mt-2">
            Anyone with this link can view the note.
          </p>
        </div>
      )}

      {canInvite && shareMode === "invite" && (
        <div className="p-6 space-y-4">
          {/* Context */}
          <p className="text-sm text-white/50">
            Invite someone who was there to add their perspective to <span className="text-white/70">{title}</span>
          </p>

          {/* Invite details */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-white/50 mb-2">
                Their name
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
                placeholder="Their name (e.g., Aunt Susan)"
                disabled={Boolean(inviteId)}
                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-white/50 mb-2">
                Relationship to Val
              </label>
              <select
                value={relationshipToSubject}
                onChange={(event) => setRelationshipToSubject(event.target.value)}
                disabled={Boolean(inviteId)}
                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent disabled:opacity-60"
              >
                <option value="">Relationship to Val</option>
                {relationshipToSubject && !(relationshipToSubject in RELATIONSHIP_OPTIONS) ? (
                  <optgroup label="Custom">
                    <option value={relationshipToSubject}>{relationshipToSubject}</option>
                  </optgroup>
                ) : null}
                <optgroup label="Family">
                  {RELATIONSHIP_GROUPS.family.map((key) => (
                    <option key={key} value={key}>
                      {RELATIONSHIP_OPTIONS[key]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Social">
                  {RELATIONSHIP_GROUPS.social.map((key) => (
                    <option key={key} value={key}>
                      {RELATIONSHIP_OPTIONS[key]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Other">
                  {RELATIONSHIP_GROUPS.other.map((key) => (
                    <option key={key} value={key}>
                      {RELATIONSHIP_OPTIONS[key]}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="text-xs text-white/30 mt-2">
                Optional. Helps us show "a cousin" if they choose relationship-only.
              </p>
            </div>
          </div>

          {/* Create invite / result */}
          {!inviteId ? (
            <button
              onClick={handleSendInvite}
              disabled={!recipientName.trim() || inviteSending}
              className="w-full py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 bg-[#e07a5f] text-white hover:bg-[#d06a4f] disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed"
            >
              {inviteSending
                ? "Creating..."
                : !recipientName.trim()
                ? "Add a name to create invite"
                : "Create invite link"}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1 pl-4 border border-white/10">
                <span className="flex-1 text-sm text-white/60 truncate font-mono">
                  {`${baseUrl}/respond/${inviteId}`}
                </span>
                <button
                  onClick={copyInviteLink}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 shrink-0 ${
                    inviteLinkCopied
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-[#e07a5f] text-white hover:bg-[#d06a4f]"
                  }`}
                >
                  {inviteLinkCopied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInviteId(null);
                  setInviteLinkCopied(false);
                  setRecipientName("");
                  setRelationshipToSubject("");
                  setInviteError(null);
                }}
                className="w-full py-2 rounded-xl text-sm font-medium bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
              >
                Invite someone else
              </button>
            </div>
          )}

          {inviteError && (
            <p className="text-xs text-red-300">{inviteError}</p>
          )}

          {inviteId && (
            <p className="text-xs text-white/30">
              Share this link so they can add their perspective.
            </p>
          )}
        </div>
      )}
        </div>
      )}
    </div>
  );
}
