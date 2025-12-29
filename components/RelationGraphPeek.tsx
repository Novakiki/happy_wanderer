'use client';

import { useMemo } from 'react';

type StoryNode = {
  id: string;
  title: string;
  type?: 'memory' | 'milestone' | 'origin';
  snippet?: string;
};

type PersonNode = {
  id: string;
  name?: string; // only if they gave permission
  relationship?: string; // cousin, aunt, friend
  role: 'wrote' | 'responded' | 'invited' | 'mentioned';
  isViewer?: boolean;
};

type Props = {
  className?: string;
  story?: StoryNode;
  people?: PersonNode[];
  previewStory?: StoryNode;
  previewPeople?: PersonNode[];
};

/**
 * Constellation graph showing people connected to a story.
 * Story sits slightly off-center as an artifact, people orbit around it.
 */
export function RelationGraphPeek({
  className = '',
  story,
  people,
  previewStory,
  previewPeople,
}: Props) {
  const effectiveStory = story || previewStory;
  const effectivePeople = useMemo(
    () => (people && people.length ? people : previewPeople || []),
    [people, previewPeople]
  );

  const hasGraph = !!effectiveStory && effectivePeople.length > 0;

  // Constellation layout: memory at top as source, people scattered below organically
  const peopleLayout = useMemo(() => {
    if (!hasGraph) return [];
    const count = effectivePeople.length;

    // Organic positions - scattered like stars, not on a grid
    // Each position is [x, y] as percentage of viewBox
    const constellationPositions = [
      [28, 72],  // lower left
      [72, 68],  // lower right
      [20, 55],  // mid left
      [80, 58],  // mid right
      [45, 78],  // bottom center-left
      [58, 62],  // center right
    ];

    return effectivePeople.map((person, idx) => {
      const pos = constellationPositions[idx % constellationPositions.length];
      return { ...person, x: pos[0], y: pos[1] };
    });
  }, [effectivePeople, hasGraph]);

  // Story position - at top center, the origin/source
  const storyX = 50;
  const storyY = 18;

  // Height for constellation layout
  const svgHeight = 240;

  return (
    <div className={className}>
      <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.06]">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-white/40">Constellation</p>
            <h3 className="text-lg text-white font-semibold mt-1">Who this touched</h3>
            <p className="text-sm text-white/60 mt-1">
              People connected to this {effectiveStory?.type === 'origin' ? 'synchronicity' : effectiveStory?.type || 'note'}.
            </p>
          </div>
          <a
            href="/score"
            className="text-xs text-[#e07a5f] font-medium hover:text-[#f28b73] transition-colors whitespace-nowrap"
          >
            Open full Score →
          </a>
        </div>

        {!hasGraph ? (
          <p className="text-sm text-white/60">Connections will appear here.</p>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <svg
              viewBox="0 0 100 100"
              role="img"
              aria-label="People connected to this memory"
              className="w-full"
              style={{ height: svgHeight }}
            >
              <defs>
                {/* Gradient for story artifact */}
                <linearGradient id="storyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(255,248,240,0.95)" />
                  <stop offset="100%" stopColor="rgba(245,230,210,0.9)" />
                </linearGradient>
                {/* Subtle noise texture filter */}
                <filter id="paperTexture">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" />
                  <feDiffuseLighting in="noise" lightingColor="white" surfaceScale="1" result="light">
                    <feDistantLight azimuth="45" elevation="60" />
                  </feDiffuseLighting>
                  <feBlend in="SourceGraphic" in2="light" mode="multiply" />
                </filter>
                {/* Glow for viewer node */}
                <filter id="viewerGlow">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Connection lines - gentle curves from story to people */}
              {peopleLayout.map((person) => {
                // Control point for gentle curve
                const midX = (storyX + person.x) / 2;
                const midY = (storyY + person.y) / 2;
                // Slight curve offset
                const curveOffset = (person.x - storyX) * 0.1;

                const strokeOpacity = person.isViewer ? 0.3 : 0.18;
                const strokeWidth = 0.5;

                return (
                  <path
                    key={`edge-${person.id}`}
                    d={`M ${storyX} ${storyY + 11} Q ${midX + curveOffset} ${midY} ${person.x} ${person.y - 5}`}
                    fill="none"
                    stroke={`rgba(255,255,255,${strokeOpacity})`}
                    strokeWidth={strokeWidth}
                  />
                );
              })}

              {/* Story node - rectangular artifact at top */}
              <g transform={`translate(${storyX}, ${storyY})`}>
                {/* Shadow */}
                <rect
                  x="-22"
                  y="-11"
                  width="44"
                  height="22"
                  rx="2.5"
                  fill="rgba(0,0,0,0.25)"
                  transform="translate(0.8, 0.8)"
                />
                {/* Main card */}
                <rect
                  x="-22"
                  y="-11"
                  width="44"
                  height="22"
                  rx="2.5"
                  fill="url(#storyGradient)"
                />
                {/* Type label */}
                {effectiveStory?.type && (
                  <text
                    x="0"
                    y="-4"
                    textAnchor="middle"
                    fontSize="2.2"
                    fontWeight="400"
                    fill="rgba(120,100,80,0.6)"
                    style={{ textTransform: 'uppercase', letterSpacing: '0.15em' }}
                  >
                    {effectiveStory.type === 'origin' ? 'synchronicity' : effectiveStory.type}
                  </text>
                )}
                {/* Title text */}
                <text
                  x="0"
                  y={effectiveStory?.type ? 3 : 0}
                  textAnchor="middle"
                  fontSize="3.5"
                  fontWeight="500"
                  fill="rgba(60,50,40,0.9)"
                >
                  {effectiveStory?.title && effectiveStory.title.length > 24
                    ? effectiveStory.title.slice(0, 22) + '…'
                    : effectiveStory?.title}
                </text>
                {/* Subtle decorative line */}
                <line
                  x1="-14"
                  y1="8"
                  x2="14"
                  y2="8"
                  stroke="rgba(180,160,140,0.35)"
                  strokeWidth="0.4"
                />
              </g>

              {/* People nodes - circular presences */}
              {peopleLayout.map((person) => {
                const isViewer = person.isViewer;
                const radius = isViewer ? 5 : 4;

                return (
                  <g
                    key={person.id}
                    transform={`translate(${person.x}, ${person.y})`}
                    filter={isViewer ? 'url(#viewerGlow)' : undefined}
                  >
                    {/* Outer ring for viewer */}
                    {isViewer && (
                      <circle
                        r={radius + 2}
                        fill="none"
                        stroke="rgba(224,122,95,0.4)"
                        strokeWidth="0.5"
                        strokeDasharray="2,2"
                      >
                        <animate
                          attributeName="stroke-dashoffset"
                          from="0"
                          to="8"
                          dur="3s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                    {/* Main circle */}
                    <circle
                      r={radius}
                      fill={isViewer ? 'rgba(224,122,95,0.15)' : 'rgba(255,255,255,0.08)'}
                      stroke={isViewer ? 'rgba(224,122,95,0.7)' : 'rgba(255,255,255,0.3)'}
                      strokeWidth={isViewer ? 1 : 0.5}
                    />
                    {/* Circle content: name/initials if permitted, otherwise relationship */}
                    <text
                      y="1.5"
                      textAnchor="middle"
                      fontSize="3.5"
                      fontWeight="500"
                      fill={isViewer ? 'rgba(224,122,95,0.95)' : 'rgba(255,255,255,0.85)'}
                    >
                      {person.name
                        ? (person.name.length <= 3
                            ? person.name
                            : person.name.split(' ').map(n => n[0]).join('').slice(0, 2))
                        : (person.relationship || '?')}
                    </text>
                    {/* Name below - only if permitted and doesn't fit inside */}
                    {person.name && !isViewer && person.name.length > 3 && (
                      <text
                        y={radius + 5}
                        textAnchor="middle"
                        fontSize="3"
                        fill="rgba(255,255,255,0.75)"
                      >
                        {person.name}
                      </text>
                    )}
                    {/* Relationship below - only if name is shown (otherwise it's in circle) */}
                    {person.name && person.relationship && (
                      <text
                        y={isViewer || person.name.length <= 3 ? radius + 5 : radius + 9}
                        textAnchor="middle"
                        fontSize="2.5"
                        fill="rgba(255,255,255,0.45)"
                        fontStyle="italic"
                      >
                        {person.relationship}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
