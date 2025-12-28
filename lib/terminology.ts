export const SITE_TITLE = "Happy Wanderer";
export const SITE_DESCRIPTION =
  "Her song, still being composed";
export const GATE_DESCRIPTION =
  "A private room for family and friends, by invitation only.";

export const SCORE_TITLE = "Happy Wanderer";
export const SCORE_TITLE_FULL = SITE_TITLE;

export const NOTE_LABEL = "note";
export const NOTE_LABEL_PLURAL = "notes";

export const ENTRY_TYPE_LABELS = {
  memory: "Memory",
  milestone: "Milestone",
  origin: "Synchronicity",
} as const;

export const ENTRY_TYPE_DESCRIPTIONS = {
  memory: "A memory shared by someone who knew her",
  milestone: "A dated milestone (birth, passing, historical pin)",
  origin: "A synchronicity that frames her story",
} as const;

export const LEGEND_LABELS = {
  origin: "Synchronicities",
  milestone: "Milestones",
  memory: "Memories",
} as const;

// Labels for modal sections
export const MODAL_LABELS = {
  originContent: "The synchronicity",
  whyIncluded: "Why it's meaningful",
} as const;

// Labels for the content field in the form
export const ENTRY_TYPE_CONTENT_LABELS = {
  memory: "The memory",
  milestone: "The milestone",
  origin: "The synchronicity",
} as const;

export const formatNoteCount = (count: number) =>
  `${count} ${count === 1 ? NOTE_LABEL : NOTE_LABEL_PLURAL} in the score`;

// =============================================================================
// Memory Provenance - how the contributor knows this story
// =============================================================================

export const MEMORY_PROVENANCE = {
  firsthand: "I was there",
  secondhand: "Someone told me",
  from_references: "From a record",
  mixed: "Mixed / not sure",
} as const;

export const MEMORY_PROVENANCE_DESCRIPTIONS = {
  firsthand: "You witnessed this memory yourself",
  secondhand: "Someone else shared this story with you",
  from_references: "Photo, letter, journal, email, article, etc.",
  mixed: "Part memory, part story you've heard",
} as const;

export const MEMORY_PROVENANCE_SHORT = {
  firsthand: "I was there",
  secondhand: "I was told",
  from_references: "I have a record",
  mixed: "Mixed",
} as const;

// =============================================================================
// Person Roles - who else was part of this memory
// =============================================================================

export const PERSON_ROLE_LABELS = {
  was_there: "Was there",
  told_me: "Told me this",
  might_remember: "Might remember",
} as const;

export const PERSON_ROLE_DESCRIPTIONS = {
  was_there: "They were physically present",
  told_me: "They shared this story with you",
  might_remember: "They might have more to add",
} as const;

// Reference roles - for the chain mail system (legacy, maps to new roles)
export const REFERENCE_ROLE_LABELS = {
  heard_from: "Passed down from",
  witness: "Also there",
  source: "", // External links don't need labels
  related: "",
} as const;

// Memory thread relationships
export const THREAD_RELATIONSHIP_LABELS = {
  perspective: "The chain continues",
  addition: "Added to the story",
  correction: "Revised",
  related: "Related",
} as const;

// =============================================================================
// Life Stages & Timing
// =============================================================================

export const LIFE_STAGES = {
  childhood: "Childhood",
  teens: "Teens",
  college: "College / early career",
  young_family: "Young family years",
  beyond: "And beyond",
} as const;

export const LIFE_STAGE_DESCRIPTIONS = {
  childhood: "Growing up (roughly ages 0–12)",
  teens: "Teen years (roughly 13–19)",
  college: "College and early career (roughly 20s)",
  young_family: "Young family years (roughly 30s–40s)",
  beyond: "Echoes forward — her father, her children, her legacy",
} as const;

// Valerie's birth year - used to compute year ranges from age/stage
export const SUBJECT_BIRTH_YEAR = 1953;

// Map life stages to approximate year ranges
export const LIFE_STAGE_YEAR_RANGES: Record<keyof typeof LIFE_STAGES, [number, number] | null> = {
  childhood: [1953, 1965],    // ages 0-12
  teens: [1966, 1972],        // ages 13-19
  college: [1973, 1982],      // roughly 20s
  young_family: [1983, 2003], // roughly 30s-40s
  beyond: null,               // transcends her timeline
};

export const TIMING_CERTAINTY = {
  exact: "Exact",
  approximate: "Approximate",
  vague: "Vague",
} as const;

export const TIMING_CERTAINTY_DESCRIPTIONS = {
  exact: "I know the specific date or year",
  approximate: "I have a rough idea (age range, decade)",
  vague: "I'm not sure when this was",
} as const;

// =============================================================================
// Family Constellation
// =============================================================================

export const CONSTELLATION_TITLE = "Family Constellation";

export const CONSTELLATION_INTRO = `
Every life is woven into others. Valerie's story doesn't begin with her birth
or end with her passing — it flows through the people who shaped her and
those she shaped in return.

The Score can hold her father's stories, her children's notes, and echoes
that continue forward. Each thread connects to hers, forming a constellation
of lives that touched.
`;

export const CONSTELLATION_CTA = "Explore the constellation";

export const CONSTELLATION_MEMBERS = {
  father: {
    label: "Her father",
    description: "Stories that flowed to her",
  },
  children: {
    label: "Her children",
    description: "Stories that flow from her",
  },
  extended: {
    label: "Extended family",
    description: "Siblings, cousins, aunts, uncles",
  },
} as const;

// =============================================================================
// Relationship Labels (for person references)
// =============================================================================

export const RELATIONSHIP_OPTIONS = {
  // Family
  parent: "Parent",
  child: "Child",
  sibling: "Sibling",
  cousin: "Cousin",
  aunt_uncle: "Aunt/Uncle",
  niece_nephew: "Niece/Nephew",
  grandparent: "Grandparent",
  grandchild: "Grandchild",
  in_law: "In-law",
  spouse: "Spouse/Partner",
  // Social
  friend: "Friend",
  neighbor: "Neighbor",
  coworker: "Coworker",
  classmate: "Classmate",
  // Other
  acquaintance: "Acquaintance",
  other: "Other",
  unknown: "I don't know",
} as const;

// For display when anonymizing (e.g., "a cousin" instead of "Sarah")
export const RELATIONSHIP_DISPLAY = {
  parent: "a parent",
  child: "a child",
  sibling: "a sibling",
  cousin: "a cousin",
  aunt_uncle: "an aunt or uncle",
  niece_nephew: "a niece or nephew",
  grandparent: "a grandparent",
  grandchild: "a grandchild",
  in_law: "an in-law",
  spouse: "a spouse",
  friend: "a friend",
  neighbor: "a neighbor",
  coworker: "a coworker",
  classmate: "a classmate",
  acquaintance: "an acquaintance",
  other: "someone",
  unknown: "someone",
} as const;
