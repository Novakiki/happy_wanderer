/**
 * Name Detection Utility
 * ======================
 * Uses compromise.js to detect person names in text content.
 * Used to identify names that may need visibility masking.
 */
import nlp from 'compromise';

export type DetectedName = {
  text: string;
  start: number;
  end: number;
  // If matched to a known person in the database
  personId?: string;
  visibility?: string;
};

/**
 * Strip HTML tags from content, preserving text positions.
 * Returns plain text and a mapping function to convert positions.
 */
function stripHtml(html: string): { text: string; toOriginal: (pos: number) => number } {
  const text: string[] = [];
  const positionMap: number[] = []; // maps plain text index -> original html index

  let inTag = false;
  let plainIndex = 0;

  for (let i = 0; i < html.length; i++) {
    const char = html[i];

    if (char === '<') {
      inTag = true;
    } else if (char === '>') {
      inTag = false;
    } else if (!inTag) {
      text.push(char);
      positionMap[plainIndex] = i;
      plainIndex++;
    }
  }

  return {
    text: text.join(''),
    toOriginal: (pos: number) => positionMap[pos] ?? pos,
  };
}

/**
 * Detect person names in text content using NLP.
 */
export function detectNames(content: string): DetectedName[] {
  const { text, toOriginal } = stripHtml(content);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = (nlp as any)(text);
  const names: string[] = doc.people().out('array');

  const results: DetectedName[] = [];
  const seen = new Set<string>();

  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    // Find position in plain text, then map to original HTML position
    const plainIdx = text.indexOf(name);
    if (plainIdx !== -1) {
      results.push({
        text: name,
        start: toOriginal(plainIdx),
        end: toOriginal(plainIdx + name.length - 1) + 1,
      });
    }
  }

  return results;
}

/**
 * Detect names and match against known people from the database.
 * Returns detected names with personId if matched.
 */
export function detectAndMatchNames(
  content: string,
  knownPeople: Array<{ id: string; name: string; visibility?: string }>
): DetectedName[] {
  const detected = detectNames(content);

  // Build lookup for known people (lowercase for matching)
  const peopleLookup = new Map<string, { id: string; visibility?: string }>();
  for (const person of knownPeople) {
    const nameLower = person.name.toLowerCase();
    peopleLookup.set(nameLower, { id: person.id, visibility: person.visibility });

    // Also add first name for partial matching
    const firstName = nameLower.split(/\s+/)[0];
    if (firstName && !peopleLookup.has(firstName)) {
      peopleLookup.set(firstName, { id: person.id, visibility: person.visibility });
    }
  }

  // Match detected names to known people
  return detected.map((name) => {
    const nameLower = name.text.toLowerCase();

    // Try exact match first
    let match = peopleLookup.get(nameLower);

    // Try partial matches (first name, last name)
    if (!match) {
      const parts = nameLower.split(/\s+/);
      for (const part of parts) {
        match = peopleLookup.get(part);
        if (match) break;
      }
    }

    if (match) {
      return { ...name, personId: match.id, visibility: match.visibility };
    }

    return name;
  });
}

/**
 * Mask names in HTML content based on visibility settings.
 * Replaces detected names with masked versions.
 */
export function maskNamesInContent(
  content: string,
  namesToMask: Array<{ text: string; replacement: string }>
): string {
  let result = content;

  // Sort by length descending to replace longer matches first
  // (e.g., "Uncle Bob Smith" before "Bob")
  const sorted = [...namesToMask].sort((a, b) => b.text.length - a.text.length);

  for (const { text, replacement } of sorted) {
    // Case-insensitive replacement, preserving HTML structure
    const regex = new RegExp(escapeRegex(text), 'gi');
    result = result.replace(regex, replacement);
  }

  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Mask names in content based on redacted references.
 * Uses NLP to detect names, matches them to references, and applies visibility masking.
 */
export function maskContentWithReferences(
  content: string,
  references: Array<{
    render_label: string;
    visibility: string;
    relationship_to_subject?: string | null;
    author_payload?: {
      author_label: string;
    };
  }>
): string {
  // Build a list of names to mask from references that aren't fully approved
  const namesToMask: Array<{ text: string; replacement: string }> = [];

  for (const ref of references) {
    // Skip if visibility is approved (show real name) or no author payload
    if (ref.visibility === 'approved' || !ref.author_payload) continue;

    const originalName = ref.author_payload.author_label;
    const replacement = ref.render_label;

    // Only mask if the replacement is different from original
    if (originalName && replacement && originalName !== replacement) {
      namesToMask.push({ text: originalName, replacement });
    }
  }

  if (namesToMask.length === 0) {
    return content;
  }

  return maskNamesInContent(content, namesToMask);
}

/**
 * Get masked display text based on visibility level.
 */
export function getMaskedName(
  name: string,
  visibility: string,
  relationship?: string | null
): string {
  if (visibility === 'approved') return name;

  if (visibility === 'blurred') {
    // Show initials: "Bob Smith" -> "B.S."
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}.${parts[parts.length - 1][0]}.`;
    }
    return name[0] ? `${name[0]}.` : '[person]';
  }

  if (visibility === 'anonymized' && relationship) {
    // Show relationship: "a friend", "Val's uncle"
    return relationship;
  }

  return '[person]';
}
