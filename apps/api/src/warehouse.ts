import { randomUUID } from 'node:crypto';
import type { EventEnvelope, KernEvent } from '@kern/contracts';

/**
 * Event warehouse v0 — tenant-isolated, queryable (doc 3 §5: "Analytics
 * warehouse: store events, sessions, outcomes, dimensions — tenant
 * isolation + retention controls"). In-memory; a persistent store is a
 * productization-phase swap behind the same interfaces.
 */
export type StoredEvent = EventEnvelope & { tenant_id: string };

const buffers = new Map<string, StoredEvent[]>();
const MAX_EVENTS_PER_TENANT = 50_000;

export function storeEvent(event: StoredEvent): void {
  const list = buffers.get(event.tenant_id) ?? [];
  list.push(event);
  if (list.length > MAX_EVENTS_PER_TENANT) list.splice(0, list.length - MAX_EVENTS_PER_TENANT);
  buffers.set(event.tenant_id, list);
}

/** Server-side event emission helper — tenant resolved from the site record. */
export function emitEvent(input: {
  tenantId: string;
  siteId: string;
  sessionId: string;
  event: KernEvent;
}): void {
  storeEvent({
    event_id: randomUUID(),
    type: input.event.type,
    session_id: input.sessionId,
    site_id: input.siteId,
    tenant_id: input.tenantId,
    occurred_at: new Date().toISOString(),
    data: input.event.data as Record<string, unknown>,
  });
}

export function eventCount(tenantId?: string): number {
  if (tenantId) return buffers.get(tenantId)?.length ?? 0;
  return [...buffers.values()].reduce((n, list) => n + list.length, 0);
}

export function tenantEvents(tenantId: string): StoredEvent[] {
  return buffers.get(tenantId) ?? [];
}

export interface SessionSummary {
  session_id: string;
  first_at: string;
  last_at: string;
  event_count: number;
  question_count: number;
  had_business_outcome: boolean;
  last_page_type?: string;
  max_booking_step?: number;
}

export function listSessions(tenantId: string, siteId?: string): SessionSummary[] {
  const bySession = new Map<string, StoredEvent[]>();
  for (const e of tenantEvents(tenantId)) {
    if (siteId && e.site_id !== siteId) continue;
    const list = bySession.get(e.session_id) ?? [];
    list.push(e);
    bySession.set(e.session_id, list);
  }
  return [...bySession.entries()]
    .map(([session_id, events]) => {
      const sorted = events.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
      let questionCount = 0;
      let hadBusinessOutcome = false;
      let lastPageType: string | undefined;
      let maxBookingStep: number | undefined;
      for (const e of sorted) {
        if (e.type === 'question_asked') questionCount++;
        if (['purchase', 'booking', 'signup', 'lead_created'].includes(e.type)) hadBusinessOutcome = true;
        if (e.type === 'page_view' && typeof e.data.page_type === 'string') lastPageType = e.data.page_type;
        if (e.type === 'journey_step' && typeof e.data.step === 'number') {
          maxBookingStep = Math.max(maxBookingStep ?? 0, e.data.step);
        }
      }
      return {
        session_id,
        first_at: sorted[0]!.occurred_at,
        last_at: sorted[sorted.length - 1]!.occurred_at,
        event_count: events.length,
        question_count: questionCount,
        had_business_outcome: hadBusinessOutcome,
        last_page_type: lastPageType,
        max_booking_step: maxBookingStep,
      };
    })
    .sort((a, b) => b.last_at.localeCompare(a.last_at));
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  text: string;
  at: string;
  simulated?: boolean;
}

export function conversationForSession(tenantId: string, sessionId: string): ConversationMessage[] {
  return tenantEvents(tenantId)
    .filter((e) => e.session_id === sessionId && (e.type === 'question_asked' || e.type === 'answer_shown'))
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    .map((e) => ({
      role: e.type === 'question_asked' ? ('user' as const) : ('assistant' as const),
      text: e.type === 'question_asked' ? String(e.data.message ?? '') : String(e.data.text ?? ''),
      at: e.occurred_at,
      simulated: e.data.simulated === true,
    }));
}

/** Sessions with at least one question, newest first — for the conversations view. */
export function conversations(tenantId: string, siteId?: string, limit = 10): { session: SessionSummary; messages: ConversationMessage[] }[] {
  return listSessions(tenantId, siteId)
    .filter((s) => s.question_count > 0)
    .slice(0, limit)
    .map((session) => ({ session, messages: conversationForSession(tenantId, session.session_id) }));
}

export interface MetricCounts {
  sessions: number;
  questions: number;
  actions_succeeded: number;
  bookings: number;
  simulated_sessions: number;
}

export function metrics(tenantId: string, siteId?: string): MetricCounts {
  const sessions = listSessions(tenantId, siteId);
  const events = tenantEvents(tenantId).filter((e) => !siteId || e.site_id === siteId);
  return {
    sessions: sessions.length,
    questions: events.filter((e) => e.type === 'question_asked').length,
    actions_succeeded: events.filter((e) => e.type === 'action_succeeded').length,
    bookings: events.filter((e) => e.type === 'booking').length,
    simulated_sessions: sessions.filter((s) => s.session_id.startsWith('sim-')).length,
  };
}

/** Journey step funnels from journey_step events (per journey, per step entered count). */
export function journeyFunnels(tenantId: string, siteId?: string) {
  const funnels = new Map<string, Map<number, number>>();
  for (const e of tenantEvents(tenantId)) {
    if (siteId && e.site_id !== siteId) continue;
    if (e.type !== 'journey_step' || typeof e.data.step !== 'number') continue;
    const journeyId = String(e.data.journey_id ?? 'unknown');
    const steps = funnels.get(journeyId) ?? new Map<number, number>();
    steps.set(e.data.step, (steps.get(e.data.step) ?? 0) + 1);
    funnels.set(journeyId, steps);
  }
  return [...funnels.entries()].map(([journey_id, steps]) => ({
    journey_id,
    steps: [...steps.entries()].sort((a, b) => a[0] - b[0]).map(([step, count]) => ({ step, count })),
  }));
}

export function resetWarehouse(tenantId?: string): void {
  if (tenantId) buffers.delete(tenantId);
  else buffers.clear();
}
