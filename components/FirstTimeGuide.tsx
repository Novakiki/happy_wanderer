'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type GuideLink = {
  label: string;
  href: string;
  newTab?: boolean;
};

type Props = {
  storageKey: string;
  title: string;
  subtitle: string;
  steps: string[];
  links?: GuideLink[];
  defaultOpen?: boolean;
  legacyDismissKeys?: string[];
  showLinksWhenCollapsed?: boolean;
  className?: string;
};

export default function FirstTimeGuide({
  storageKey,
  title,
  subtitle,
  steps,
  links = [],
  defaultOpen = true,
  legacyDismissKeys = [],
  showLinksWhenCollapsed = false,
  className = '',
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [dismissed, setDismissed] = useState(false);

  const dismissKey = useMemo(() => `${storageKey}:dismissed`, [storageKey]);
  const openKey = useMemo(() => `${storageKey}:open`, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (legacyDismissKeys.length > 0) {
      const hasLegacyDismissal = legacyDismissKeys.some(
        (key) => localStorage.getItem(key) === '1'
      );
      if (hasLegacyDismissal && localStorage.getItem(dismissKey) !== '1') {
        localStorage.setItem(dismissKey, '1');
      }
      legacyDismissKeys.forEach((key) => localStorage.removeItem(key));
    }

    const isDismissed = localStorage.getItem(dismissKey) === '1';
    if (isDismissed) {
      setDismissed(true);
      setOpen(false);
      return;
    }

    const storedOpen = localStorage.getItem(openKey);
    if (storedOpen === '0') setOpen(false);
    if (storedOpen === '1') setOpen(true);
  }, [dismissKey, openKey, legacyDismissKeys]);

  const handleDismiss = () => {
    setDismissed(true);
    setOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(dismissKey, '1');
      localStorage.removeItem(openKey);
    }
  };

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(openKey, next ? '1' : '0');
      }
      return next;
    });
  };

  const hasLinks = links.length > 0;

  const linksRow = hasLinks ? (
    <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-white/50">
      {links.map((link, index) => (
        <span key={`${link.label}-${link.href}`} className="flex items-center gap-3">
          <Link
            href={link.href}
            target={link.newTab ? '_blank' : undefined}
            rel={link.newTab ? 'noopener noreferrer' : undefined}
            className="hover:text-white transition-colors"
          >
            {link.label}
          </Link>
          {index < links.length - 1 ? (
            <span className="text-white/30">|</span>
          ) : null}
        </span>
      ))}
    </div>
  ) : null;

  if (dismissed) {
    return showLinksWhenCollapsed ? (
      <div className={`mt-4 ${className}`}>{linksRow}</div>
    ) : null;
  }

  return (
    <>
      <div className={`mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 ${className}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white/80">{title}</p>
            <p className="text-xs text-white/50">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggle}
              className="text-xs uppercase tracking-[0.18em] text-white/70 hover:text-white transition-colors"
            >
              {open ? 'Collapse' : 'View'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs uppercase tracking-[0.18em] text-white/50 hover:text-white/70 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
        {open ? (
          <div className="mt-3 space-y-3 text-sm text-white/70">
            <ol className="list-decimal list-inside space-y-1 text-sm text-white/70">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {hasLinks && linksRow}
            <p className="text-xs text-white/50">Dismiss hides this guide for you.</p>
          </div>
        ) : null}
      </div>
      {showLinksWhenCollapsed && !open && hasLinks ? (
        <div className={`mt-4 ${className}`}>{linksRow}</div>
      ) : null}
    </>
  );
}
