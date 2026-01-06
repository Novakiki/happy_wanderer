import Anthropic from '@anthropic-ai/sdk';
import { Memory } from './types';
import type { InterpreterPayload } from './interpreter/types';
import { buildInterpreterSystemMessage } from './interpreter/interpreterSystemPrompt';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const SYSTEM_PROMPT = `You are a warm, caring assistant helping Valerie Park Anderson's children learn about their mother through notes shared by people who loved her.

CRITICAL HONESTY RULES (NON-NEGOTIABLE):
1. You are NOT Val. You do not speak as her or pretend to be her.
2. You can ONLY share information that appears in the notes provided below or in the basic facts from her obituary.
3. If someone asks about something not covered in the notes, say clearly: "I don't have any notes shared about that yet. You could ask [the person who shared a related note] or encourage more family members to share their notes."
4. ALWAYS cite your source: "According to [Name]..." or "[Name] shared that..."
5. NEVER invent details, fill in gaps, embellish, or speculate about what Val might have thought/felt/said.
6. If a note is from "Someone who loved her" (anonymous), say so.
7. It's better to say "I don't know" than to make something up.

ABOUT VALERIE (from her obituary - these facts are verified):
- Born October 13, 1975, in Murray, Utah to G. Rodney Park and Carolyn Jean Burr
- Raised in Bluffdale, Utah in a home filled with music, good humor, and love
- Graduated top of her class from Weber State University in nursing
- Married Derek Anderson on August 24, 1996, in the Manti Utah Temple
- Raised her family in Perry, Utah for nearly 27 years
- Devoted member of The Church of Jesus Christ of Latter-day Saints
- Served faithfully in Primary presidency and as Cub Scout leader
- Worked as a registered nurse at Brigham City Hospital
- Treasured her role as a mother above all else
- Known for her tenacity, hard work, discipline, warmth, kindness, and ability to make everyone feel loved
- Loved: family vacations, holidays, watching her kids play basketball, hiking, skiing, making desserts, playing piano, driving, reading, crafting/sewing, and Pepsi
- Passed away September 27, 2025
- Preceded in death by her father, G. Rodney Park

YOUR ROLE:
- Share notes warmly and conversationally
- ALWAYS attribute every piece of information to its source
- Be gentle, honest, and loving
- Help her children feel connected to who their mother was through REAL stories from REAL people

MEMORY WEIGHTING:
- Memories with a named source (e.g., "Sarah, cousin") carry more weight and credibility
- Anonymous notes ("Someone who loved her") are still valid but note they are unattributed
- When multiple notes touch on the same topic, prefer the attributed ones

When you receive notes, they will be in this format:
[Note from {name} ({relationship}): {content}]

You may ONLY draw from these notes and the obituary facts above. Nothing else.`;

export async function chat(
  messages: { role: 'user' | 'assistant'; content: string }[],
  memories: Memory[]
): Promise<string> {
  // Format memories for context, with attributed ones first (higher weight)
  const sortedMemories = [...memories].sort((a, b) => {
    // Attributed memories come first
    const aHasName = a.submitter_name ? 1 : 0;
    const bHasName = b.submitter_name ? 1 : 0;
    return bHasName - aHasName;
  });

  const memoriesContext = sortedMemories.length > 0
    ? sortedMemories.map(m => {
        const name = m.submitter_name || 'Someone who loved her';
        const relationship = m.submitter_relationship || 'family/friend';
        return `[Note from ${name} (${relationship}): ${m.content}]`;
      }).join('\n\n')
    : '[No notes have been shared yet. Encourage them to ask family members to share notes at the website.]';

  const systemPromptWithMemories = `${SYSTEM_PROMPT}

NOTES SHARED BY FAMILY AND FRIENDS:
${memoriesContext}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPromptWithMemories,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  const textContent = response.content.find(block => block.type === 'text');
  return textContent ? textContent.text : 'I apologize, but I was unable to respond. Please try again.';
}

/**
 * Enriched chat using the structured interpreter payload.
 *
 * This version sends the full enriched payload (with temporal structure,
 * provenance, recurrence, motifs, and threads) to enable genuine pattern-finding.
 *
 * Feature flag: USE_ENRICHED_INTERPRETER_PAYLOAD
 */
export async function chatWithEnrichedPayload(
  messages: { role: 'user' | 'assistant'; content: string }[],
  payload: InterpreterPayload
): Promise<string> {
  const payloadJson = JSON.stringify(payload, null, 2);
  const systemMessage = buildInterpreterSystemMessage(payloadJson);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500, // Slightly higher for richer responses
    system: systemMessage,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const textContent = response.content.find((block) => block.type === 'text');
  return textContent
    ? textContent.text
    : 'I apologize, but I was unable to respond. Please try again.';
}

/**
 * Use Claude to geocode a location string to lat/lng coordinates.
 * Returns null if the location cannot be geocoded.
 *
 * TODO: This is ready for the map feature. To enable:
 * 1. Run lib/migrations/006_add_coordinates.sql in Supabase
 * 2. npm install leaflet react-leaflet @types/leaflet
 * 3. Uncomment geocoding in app/api/memories/route.ts
 * 4. Create /map page with Leaflet + OpenStreetMap
 */
export async function geocodeLocation(
  location: string
): Promise<{ latitude: number; longitude: number } | null> {
  if (!location || location.trim().length === 0) {
    return null;
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      system: `You are a geocoding assistant. Given a location, return its approximate latitude and longitude coordinates as JSON.

Rules:
- Return ONLY valid JSON in the format: {"latitude": number, "longitude": number}
- Use approximate center coordinates for cities, regions, or landmarks
- If the location is ambiguous, use the most likely interpretation (e.g., "St. Paul" → St. Paul, Minnesota)
- If the location cannot be geocoded (too vague, fictional, etc.), return: {"error": "cannot geocode"}
- Do not include any explanation, just the JSON`,
      messages: [
        {
          role: 'user',
          content: `Geocode this location: "${location}"`,
        },
      ],
    });

    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent) return null;

    const parsed = JSON.parse(textContent.text);
    if (parsed.error) return null;

    if (typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
      return {
        latitude: parsed.latitude,
        longitude: parsed.longitude,
      };
    }

    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}
