import { describe, expect, it } from 'vitest';
import type { PageContext } from '@kern/contracts';
import { detectIntent } from '../src/intent';

const page = (overrides: Partial<PageContext> = {}): PageContext => ({
  url: 'http://localhost:3000/booking',
  route: '/booking',
  page_type: 'booking',
  visible_text: { title: 'Book', headings: ['Book your adventure'] },
  elements: [],
  errors: [],
  entities: [],
  state_hash: 'h',
  timestamp: new Date().toISOString(),
  ...overrides,
});

describe('detectIntent — deterministic, explainable classification', () => {
  it('classifies navigation requests', () => {
    expect(detectIntent('Which button should I press to continue?', page()).label).toBe('navigation');
    expect(detectIntent('show me the pricing page', page()).label).toBe('navigation');
  });

  it('classifies task attempts (boosted on booking pages)', () => {
    const r = detectIntent('book the paragliding for two', page());
    expect(r.label).toBe('task_attempt');
    expect(r.confidence).toBeGreaterThan(0.7);
  });

  it('classifies objections', () => {
    expect(detectIntent('Why are weekends more expensive?', page()).label).toBe('objection');
    expect(detectIntent('Do I really need insurance?', page()).label).toBe('objection');
  });

  it('classifies help requests, with high urgency when the page shows errors', () => {
    const calm = detectIntent('I need help with the date picker', page());
    expect(calm.label).toBe('help_request');
    expect(calm.urgency).toBe('medium');

    const stuck = detectIntent("I'm stuck and can't get past this", page({ errors: ['Please select an insurance option to continue.'] }));
    expect(stuck.label).toBe('help_request');
    expect(stuck.urgency).toBe('high');
  });

  it('classifies comparisons', () => {
    expect(detectIntent("What's the difference between the two insurance options?", page()).label).toBe('comparison');
  });

  it('classifies plain questions', () => {
    expect(detectIntent('What is the cancellation policy?', page()).label).toBe('question');
  });

  it('falls back to other with low confidence', () => {
    const r = detectIntent('Hello there!', page());
    expect(r.label).toBe('other');
    expect(r.confidence).toBeLessThan(0.5);
  });
});
