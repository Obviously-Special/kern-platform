/**
 * Minimal, safe markdown formatter for assistant replies.
 *
 * Security rule: escape ALL HTML first, then apply transforms that only
 * produce our own tags. Model output can never inject markup.
 *
 * Supports the light subset the assistant is instructed to use:
 * **bold**, *italic*, `code`, [text](url), line breaks.
 */
export function formatMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*\n]*)\*/g, '$1<em>$2</em>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n/g, '<br>');
}
