import { describe, expect, it } from 'vitest';
import type { PageElement } from '@kern/contracts';
import { parseGuideDirective } from '../src/guide';

const elements: PageElement[] = [
  { id: 'booking-continue', tag: 'button', label: 'Continue' },
  { id: 'date-2026-09-05', tag: 'button', label: 'Book 5 Sep' },
];

describe('parseGuideDirective (guide mode v1)', () => {
  it('strips the directive from the reply and returns the target', () => {
    const { reply, guide } = parseGuideDirective(
      'Click the button below to proceed.\n<<GUIDE:booking-continue>>',
      elements,
    );
    expect(reply).toBe('Click the button below to proceed.');
    expect(guide).toEqual({ element_id: 'booking-continue', label: 'Continue' });
  });

  it('returns no guide when there is no directive', () => {
    const { reply, guide } = parseGuideDirective('Just an answer.', elements);
    expect(reply).toBe('Just an answer.');
    expect(guide).toBeUndefined();
  });

  it('drops the guide when the target is not in the page context (safety: never guide to unknown elements)', () => {
    const { reply, guide } = parseGuideDirective('Here.\n<<GUIDE:evil-button>>', elements);
    expect(reply).toBe('Here.');
    expect(guide).toBeUndefined();
  });

  it('resolves kern-el-N refs when the element has no id (sites without ids stay guidable)', () => {
    const noIdElements: PageElement[] = [
      { ref: 'kern-el-0', tag: 'a', label: 'Pricing', href: '/pricing' },
    ];
    const { guide } = parseGuideDirective('See the link.\n<<GUIDE:kern-el-0>>', noIdElements);
    expect(guide).toEqual({ element_id: undefined, element_ref: 'kern-el-0', label: 'Pricing' });
  });
});
