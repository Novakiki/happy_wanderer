"use client";

import { useEffect, useMemo, useState } from "react";
import { generatePreviewFromHtml, PREVIEW_MAX_LENGTH } from "@/lib/html-utils";

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
};

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
}: ShareInvitePanelProps) {
  const isMemory = eventType === "memory";
  const [baseUrl, setBaseUrl] = useState("");
  const [shareMode, setShareMode] = useState<"link" | "invite">("link");

  const [witnesses, setWitnesses] = useState<string[]>([]);
  const [newWitness, setNewWitness] = useState("");
  const [inviteMethod, setInviteMethod] = useState<"email" | "sms" | "link">("link");
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

  const addWitness = () => {
    const trimmed = newWitness.trim();
    if (!trimmed || witnesses.includes(trimmed)) return;
    setWitnesses([...witnesses, trimmed]);
    setNewWitness("");
  };

  const removeWitness = (name: string) => {
    setWitnesses(witnesses.filter((witness) => witness !== name));
  };

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
    if (!eventId || witnesses.length === 0) return;

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
          recipient_name: witnesses[0] || "Friend of Valerie",
          recipient_contact: "link",
          method: inviteMethod,
          message: "",
          witnesses,
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

      setWitnesses([]);
      setNewWitness("");
    } catch (error) {
      console.error(error);
      setInviteError("Could not create invite. Please try again.");
    } finally {
      setInviteSending(false);
    }
  };

  return (
    <div className="mt-10 rounded-2xl border border-white/10 bg-[#111111]/80 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Share this note</p>
        <p className="text-sm text-white/50 mt-2">
          Share a view-only link or invite someone to add their perspective.
        </p>
      </div>

      {isMemory && (
        <div className="px-6 py-4 border-b border-white/10">
          <p className="text-sm text-white/60">How do you want to share this note?</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setShareMode("link")}
              className={`flex-1 py-2 rounded-xl text-sm transition-colors ${
                shareMode === "link"
                  ? "bg-white/20 text-white"
                  : "bg-white/10 text-white/50 hover:bg-white/15"
              }`}
            >
              View-only link
            </button>
            <button
              onClick={() => setShareMode("invite")}
              className={`flex-1 py-2 rounded-xl text-sm transition-colors ${
                shareMode === "invite"
                  ? "bg-white/20 text-white"
                  : "bg-white/10 text-white/50 hover:bg-white/15"
              }`}
            >
              Invite to contribute
            </button>
          </div>
        </div>
      )}

      {(shareMode === "link" || !isMemory) && (
        <>
          <div className="p-6 bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f]">
            <div className="bg-[#1f1f1f] rounded-xl p-4 border border-white/5">
              <p className="text-white/40 text-xs">{formatYearLabel(year, yearEnd, timingCertainty)}</p>
              <h3 className="text-white font-serif text-lg mt-1">{title}</h3>
              {previewText && (
                <p className="text-white/60 text-sm mt-2 leading-relaxed line-clamp-3">{previewText}</p>
              )}
              <p className="text-xs text-white/30 mt-3 pt-3 border-t border-white/5">
                Added by {contributorName || "Someone who loved her"}
                {contributorRelation && contributorRelation !== "synthesized" && (
                  <span> ({contributorRelation})</span>
                )}
              </p>
            </div>
          </div>

          <div className="px-6 py-4">
            <button
              onClick={copyShareLink}
              className={`w-full py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                linkCopied
                  ? "bg-green-600 text-white"
                  : "bg-[#e07a5f] text-white hover:bg-[#d06a4f]"
              }`}
            >
              {linkCopied ? "Link copied" : "Copy link to share"}
            </button>
            {shareError && (
              <p className="text-xs text-red-300 text-center mt-2">{shareError}</p>
            )}
            <p className="text-xs text-white/30 text-center mt-3">
              Anyone with access can view this note.
            </p>
          </div>
        </>
      )}

      {isMemory && shareMode === "invite" && (
        <>
          <div className="px-6 py-4 border-b border-white/10">
            <p className="text-sm text-white/60">
              Invite someone who was there to add their perspective to:
            </p>
            <p className="text-white font-medium mt-2">{title}</p>
            <p className="text-xs text-white/40 mt-1">
              {formatYearLabel(year, yearEnd, timingCertainty)}
            </p>
          </div>

          <div className="px-6 py-4 border-b border-white/10">
            <label className="text-sm text-white/60 block mb-3">
              Who was there?
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newWitness}
                onChange={(event) => setNewWitness(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && addWitness()}
                placeholder="Name (e.g., Aunt Susan)"
                className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent"
              />
              <button
                onClick={addWitness}
                className="px-4 py-2 rounded-xl bg-white/10 text-white/70 text-sm hover:bg-white/20 transition-colors"
              >
                Add
              </button>
            </div>
            {witnesses.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {witnesses.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#e07a5f]/20 text-[#e07a5f] text-sm"
                  >
                    {name}
                    <button
                      onClick={() => removeWitness(name)}
                      className="ml-1 hover:text-white transition-colors"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-b border-white/10">
            <label className="text-sm text-white/60 block mb-3">
              How do you want to reach them?
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setInviteMethod("link")}
                className={`flex-1 py-2 rounded-xl text-sm transition-colors ${
                  inviteMethod === "link"
                    ? "bg-white/20 text-white"
                    : "bg-white/10 text-white/50 hover:bg-white/15"
                }`}
              >
                Copy link
              </button>
              <div className="relative flex-1 group">
                <button
                  disabled
                  className="w-full py-2 rounded-xl text-sm bg-white/5 text-white/30 cursor-not-allowed"
                >
                  Email
                </button>
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-white/10 backdrop-blur-sm rounded text-xs text-white/60 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Coming soon
                </span>
              </div>
              <div className="relative flex-1 group">
                <button
                  disabled
                  className="w-full py-2 rounded-xl text-sm bg-white/5 text-white/30 cursor-not-allowed"
                >
                  SMS
                </button>
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-white/10 backdrop-blur-sm rounded text-xs text-white/60 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Coming soon
                </span>
              </div>
            </div>
          </div>

          <div className="px-6 py-4">
            <button
              onClick={handleSendInvite}
              disabled={witnesses.length === 0 || inviteSending}
              className="w-full py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 bg-[#e07a5f] text-white hover:bg-[#d06a4f] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {inviteSending ? "Creating invite..." : "Create invite link"}
            </button>
            {inviteError && (
              <p className="text-xs text-red-300 text-left mt-2">{inviteError}</p>
            )}
            <p className="text-xs text-white/30 text-center mt-3">
              {witnesses.length > 0
                ? `Will create an invite for ${witnesses.length} person${witnesses.length > 1 ? "s" : ""} to add their perspective`
                : "Add at least one person to invite"}
            </p>

            {inviteId && baseUrl && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/50">Invite link</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    readOnly
                    value={`${baseUrl}/respond/${inviteId}`}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white/80 text-xs"
                  />
                  <button
                    onClick={copyInviteLink}
                    className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                      inviteLinkCopied
                        ? "bg-green-600 text-white"
                        : "bg-white/10 text-white/70 hover:bg-white/20"
                    }`}
                  >
                    {inviteLinkCopied ? "Copied" : "Copy link"}
                  </button>
                </div>
                <p className="text-xs text-white/40 mt-2">
                  Share this link so they can add their note.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
