import { describe, expect, it } from 'vitest';
import {
  ActionSchema,
  ChatRequestSchema,
  EventEnvelopeSchema,
  KernEventSchema,
  PageContextSchema,
} from '../src/index';

describe('event taxonomy', () => {
  it('accepts a valid page_view event', () => {
    const result = KernEventSchema.safeParse({
      type: 'page_view',
      data: { url: 'https://demo.kern.local/booking', page_type: 'booking', title: 'Book' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown event types', () => {
    const result = KernEventSchema.safeParse({ type: 'magic_happened', data: {} });
    expect(result.success).toBe(false);
  });

  it('rejects an action event with an invalid permission level', () => {
    const result = KernEventSchema.safeParse({
      type: 'action_proposed',
      data: { action_id: 'a1', tool: 'book', permission_level: 'everything' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts a business booking event with value', () => {
    const result = KernEventSchema.safeParse({
      type: 'booking',
      data: { value: 240, currency: 'CHF', reference: 'BK-1001' },
    });
    expect(result.success).toBe(true);
  });
});

describe('event envelope', () => {
  it('requires tenant isolation fields', () => {
    const result = EventEnvelopeSchema.safeParse({
      event_id: 'evt_1',
      type: 'page_view',
      session_id: 's_1',
      site_id: 'site_1',
      tenant_id: 't_1',
      occurred_at: '2026-09-02T20:00:00Z',
      data: { url: '/x' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing tenant_id — no cross-tenant events, ever', () => {
    const result = EventEnvelopeSchema.safeParse({
      event_id: 'evt_1',
      type: 'page_view',
      session_id: 's_1',
      site_id: 'site_1',
      occurred_at: '2026-09-02T20:00:00Z',
      data: {},
    });
    expect(result.success).toBe(false);
  });
});

describe('page context', () => {
  it('accepts a compact SDK page model', () => {
    const result = PageContextSchema.safeParse({
      url: 'https://demo.kern.local/booking/step-2',
      route: '/booking/step-2',
      page_type: 'booking',
      visible_text: {
        title: 'Choose your service',
        headings: ['Booking', 'Choose your service'],
      },
      elements: [
        { id: 'date-picker', role: 'button', tag: 'button', label: 'Pick a date' },
      ],
      errors: [],
      entities: ['service-massage-60'],
      state_hash: 'abc123',
      timestamp: '2026-09-02T20:00:00Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('chat contract', () => {
  it('accepts a page-aware chat request', () => {
    const result = ChatRequestSchema.safeParse({
      session_id: 's_1',
      site_id: 'site_1',
      page_context: {
        url: 'https://demo.kern.local/pricing',
        page_type: 'pricing',
        visible_text: { title: 'Pricing', headings: ['Pricing', 'Plans'] },
        elements: [],
        errors: [],
        entities: [],
        state_hash: 'h1',
        timestamp: '2026-09-02T20:00:00Z',
      },
      message: 'Do the plans include priority support?',
    });
    expect(result.success).toBe(true);
  });
});

describe('action schema', () => {
  it('records the policy decision, not just the model proposal', () => {
    const result = ActionSchema.safeParse({
      action_id: 'a_1',
      session_id: 's_1',
      tool: 'book_appointment',
      arguments: { date: '2026-09-05', time: '14:30' },
      permission_level: 'transactional',
      policy_decision: 'confirmation_required',
      result: 'pending',
      timestamp: '2026-09-02T20:00:00Z',
    });
    expect(result.success).toBe(true);
  });
});
