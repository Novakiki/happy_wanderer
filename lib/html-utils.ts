/**
 * HTML utility functions for validation and preview generation.
 * Server-safe module - can be imported by both client and server code.
 */

/**
 * Strip HTML tags from a string.
 * Also decodes common HTML entities and normalizes whitespace.
 */
export function stripHtml(html: string): string {
  if (!html) return '';

  return html
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    // Normalize whitespace (including zero-width spaces)
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width characters
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if HTML content has meaningful text (not just empty tags or whitespace).
 * Use this for validation before form submission or API processing.
 */
export function hasContent(html: string): boolean {
  return stripHtml(html).length > 0;
}

/**
 * Generate a preview from HTML content.
 * Strips HTML, normalizes whitespace, and truncates to specified length.
 */
export function generatePreviewFromHtml(html: string, maxLength: number = 200): string {
  const text = stripHtml(html);
  if (text.length <= maxLength) {
    return text;
  }
  // Truncate at word boundary
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace) + '...';
  }
  return truncated + '...';
}
