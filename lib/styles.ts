/**
 * Shared background styles for consistent visual atmosphere across pages.
 */

/**
 * Full immersive background with radial glows and gradient.
 * Used on: why, memory detail, score pages.
 */
export const immersiveBackground = {
  backgroundImage: `
    radial-gradient(900px 520px at 12% -8%, rgba(224, 122, 95, 0.12), transparent 60%),
    radial-gradient(700px 520px at 88% 6%, rgba(124, 138, 120, 0.12), transparent 55%),
    linear-gradient(180deg, rgba(11, 11, 11, 1), rgba(5, 5, 5, 1))
  `,
  backgroundAttachment: 'fixed' as const,
};

/**
 * Score page variant with additional top/bottom fade for timeline visualization.
 */
export const scoreBackground = {
  backgroundImage: `
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.06) 0%,
      rgba(255, 255, 255, 0) 38%,
      rgba(255, 255, 255, 0) 62%,
      rgba(255, 255, 255, 0.06) 100%
    ),
    radial-gradient(900px 520px at 12% -8%, rgba(224, 122, 95, 0.12), transparent 60%),
    radial-gradient(700px 520px at 88% 6%, rgba(124, 138, 120, 0.12), transparent 55%),
    linear-gradient(180deg, rgba(11, 11, 11, 1), rgba(5, 5, 5, 1))
  `,
  backgroundAttachment: 'fixed' as const,
};

/**
 * Subtle background for form/content pages (share, chat, edit).
 * Lighter touch - just a top fade and soft radial glows.
 */
export const subtleBackground = {
  backgroundImage: `
    linear-gradient(180deg,
      rgba(255, 255, 255, 0.04) 0%,
      rgba(255, 255, 255, 0) 40%
    ),
    radial-gradient(ellipse 120% 80% at 20% -10%, rgba(224, 122, 95, 0.08), transparent),
    radial-gradient(ellipse 100% 70% at 80% -5%, rgba(124, 138, 120, 0.06), transparent)
  `,
};

/**
 * Shared form element styles for consistency across all forms.
 * Use these as base classes, extend as needed.
 */
export const formStyles = {
  // Page layout
  pageContainer: 'min-h-screen text-white bg-[#0b0b0b]',
  contentWrapper: 'max-w-2xl mx-auto px-6 py-16',

  // Header elements
  subLabel: 'text-xs uppercase tracking-[0.3em] text-white/40',
  pageTitle: 'text-3xl sm:text-4xl font-serif text-white mt-4',
  pageDescription: 'text-lg text-white/60 leading-relaxed mt-3',

  // Form sections
  section: 'rounded-2xl border border-white/10 bg-white/5 p-5',
  sectionLabel: 'text-xs uppercase tracking-[0.3em] text-white/40 mb-4',

  // Labels
  label: 'block text-sm font-medium text-white mb-2',
  labelMuted: 'block text-sm text-white/60 mb-2',
  required: 'text-red-400',

  // Inputs
  input: 'w-full px-4 py-3 rounded-xl border border-white/10 bg-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent',
  inputSmall: 'w-full px-3 py-2 rounded-xl border border-white/10 bg-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent text-sm',
  textarea: 'w-full px-4 py-3 rounded-xl border border-white/10 bg-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent resize-none',
  select: 'w-full px-4 py-3 pr-10 rounded-xl border border-white/10 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2724%27%20height%3D%2724%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27rgba(255,255,255,0.5)%27%20stroke-width%3D%272%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%3E%3Cpolyline%20points%3D%276%209%2012%2015%2018%209%27%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")] bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat',
  checkbox: 'w-4 h-4 rounded border-white/20 bg-white/10 text-[#e07a5f] focus:ring-[#e07a5f]/40',

  // Buttons
  buttonPrimary: 'px-6 py-3 bg-[#e07a5f] text-white rounded-xl hover:bg-[#d06a4f] transition-colors',
  buttonPrimaryFull: 'w-full px-6 py-3 bg-[#e07a5f] text-white rounded-xl hover:bg-[#d06a4f] disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed transition-colors',
  buttonSecondary: 'px-4 py-2 rounded-xl bg-white/10 text-white/70 text-sm hover:bg-white/20 transition-colors',
  buttonGhost: 'text-sm text-[#e07a5f] hover:text-white transition-colors',
  disclosureArrow: 'inline-block text-[0.65em] mr-[0.5em] opacity-85 align-[0.1em]',

  // Feedback
  error: 'text-sm text-red-400',
  success: 'text-sm text-green-400',
  hint: 'text-xs text-white/40 mt-1',

  // Tags/chips
  tag: 'inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#e07a5f]/20 text-[#e07a5f] text-sm',
  tagRemove: 'ml-1 hover:text-white transition-colors',
} as const;
