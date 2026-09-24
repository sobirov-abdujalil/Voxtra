/** Pure transcript sanitizer. Strips HTML tags, trims, caps length. */
export function sanitizeTranscript(input: string, maxLen = 2000): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .trim()
    .slice(0, maxLen);
}
