import { describe, expect, it } from 'vitest';
import { formatMarkdown } from '../src/format';

describe('formatMarkdown — safe rendering of assistant replies', () => {
  it('renders **bold** instead of leaking asterisks (the reported bug)', () => {
    expect(formatMarkdown('Click **Book now** to proceed.')).toBe(
      'Click <strong>Book now</strong> to proceed.',
    );
  });

  it('renders *italic* and `code`', () => {
    expect(formatMarkdown('Use *gently* and run `npm run dev`.')).toBe(
      'Use <em>gently</em> and run <code>npm run dev</code>.',
    );
  });

  it('renders markdown links as real links', () => {
    expect(formatMarkdown('See [our FAQ](https://example.com/help).')).toBe(
      'See <a href="https://example.com/help" target="_blank" rel="noopener noreferrer">our FAQ</a>.',
    );
  });

  it('converts newlines to line breaks', () => {
    expect(formatMarkdown('Line one\nLine two')).toBe('Line one<br>Line two');
  });

  it('escapes raw HTML — model output can never inject markup (XSS)', () => {
    expect(formatMarkdown('<script>alert(1)</script> **hi**')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt; <strong>hi</strong>',
    );
  });

  it('leaves plain text untouched', () => {
    expect(formatMarkdown('Simple answer.')).toBe('Simple answer.');
  });
});
