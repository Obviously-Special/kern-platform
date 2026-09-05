import { randomUUID } from 'node:crypto';
import type { KernEvent } from '@kern/contracts';
import { emitEvent, storeEvent } from './warehouse';

/**
 * AI User Simulator (doc 3 §2, P2 module — pulled forward to Phase 3):
 * synthetic users walk realistic journeys so the friction engine has
 * traffic to analyze before real visitors exist, and journeys are
 * continuously regression-tested. Every event is marked
 * data.simulated = true — simulated evidence is labelled, never mixed
 * with real traffic.
 */

interface SimStep {
  event: KernEvent;
  /** ms after the previous step (default 1500). */
  delay?: number;
}

interface SimScenario {
  id: string;
  /** Sessions to generate per run. */
  runs: number;
  script: SimStep[];
}

const bookingStep = (step: number): SimStep => ({
  event: {
    type: 'journey_step',
    data: { journey_id: 'booking', step, total_steps: 6, status: 'entered' },
  },
});

const SCENARIOS: SimScenario[] = [
  {
    id: 'stuck-at-insurance',
    runs: 3,
    script: [
      { event: { type: 'page_view', data: { url: 'http://localhost:3000/booking', page_type: 'booking' } } },
      bookingStep(1),
      bookingStep(2),
      bookingStep(3),
      bookingStep(4),
      { event: { type: 'question_asked', data: { message: "I can't get past the insurance step, what should I do?" } } },
      { event: { type: 'answer_shown', data: { message_id: randomUUID(), mode: 'guide', latency_ms: 900 } } },
      // no booking — the session dies at step 4
    ],
  },
  {
    id: 'booking-success',
    runs: 2,
    script: [
      { event: { type: 'page_view', data: { url: 'http://localhost:3000/booking', page_type: 'booking' } } },
      bookingStep(1),
      bookingStep(2),
      bookingStep(3),
      bookingStep(4),
      bookingStep(5),
      bookingStep(6),
      { event: { type: 'booking', data: { reference: `BK-${randomUUID().slice(0, 4)}`, via_assistant: true } } },
    ],
  },
  {
    id: 'help-before-exit',
    runs: 2,
    script: [
      { event: { type: 'page_view', data: { url: 'http://localhost:3000/pricing', page_type: 'pricing' } } },
      { event: { type: 'question_asked', data: { message: 'What is the cancellation policy?' } } },
      { event: { type: 'answer_shown', data: { message_id: randomUUID(), mode: 'answer', latency_ms: 800 } } },
      // leaves without booking
    ],
  },
  {
    id: 'repeat-question',
    runs: 3,
    script: [
      { event: { type: 'page_view', data: { url: 'http://localhost:3000/', page_type: 'home' } } },
      { event: { type: 'question_asked', data: { message: 'When do bookings close?' } } },
      { event: { type: 'answer_shown', data: { message_id: randomUUID(), mode: 'answer', latency_ms: 700 } } },
      { event: { type: 'question_asked', data: { message: 'When do bookings close?' } } },
      { event: { type: 'answer_shown', data: { message_id: randomUUID(), mode: 'answer', latency_ms: 700 } } },
      { event: { type: 'repeat_question', data: { signature: 'when do bookings close?', page_type: 'home' } } },
    ],
  },
  {
    id: 'date-confusion',
    runs: 2,
    script: [
      { event: { type: 'page_view', data: { url: 'http://localhost:3000/booking', page_type: 'booking' } } },
      bookingStep(1),
      bookingStep(2),
      { event: { type: 'error_seen', data: { message: 'This experience requires at least 2 participants.' } } },
      { event: { type: 'question_asked', data: { message: "Why can't I pick Saturday?" } } },
      { event: { type: 'answer_shown', data: { message_id: randomUUID(), mode: 'answer', latency_ms: 950 } } },
    ],
  },
];

export interface SimulationResult {
  sessions: number;
  events: number;
  scenarios: { id: string; sessions: number }[];
}

function markSimulated(event: KernEvent): KernEvent {
  // `simulated` is a warehouse-level marker, not part of the typed event
  // payload — the cast through unknown is intentional and validated at
  // storage time.
  return { ...event, data: { ...event.data, simulated: true } } as unknown as KernEvent;
}

export function runSimulation(tenantId: string, siteId: string): SimulationResult {
  let sessions = 0;
  let events = 0;
  const summary: SimulationResult['scenarios'] = [];

  for (const scenario of SCENARIOS) {
    for (let run = 0; run < scenario.runs; run++) {
      const sessionId = `sim-${scenario.id}-${run + 1}`;
      const occurredAt = Date.now() - 30 * 60 * 1000; // session started ~30 min ago
      for (let i = 0; i < scenario.script.length; i++) {
        const { event, delay = 1500 } = scenario.script[i]!;
        storeEvent({
          event_id: randomUUID(),
          type: event.type,
          session_id: sessionId,
          site_id: siteId,
          tenant_id: tenantId,
          occurred_at: new Date(occurredAt + i * delay).toISOString(),
          data: markSimulated(event).data as Record<string, unknown>,
        });
        events++;
      }
      sessions++;
    }
    summary.push({ id: scenario.id, sessions: scenario.runs });
  }
  return { sessions, events, scenarios: summary };
}

/** Convenience for the SDK-side event emitter (unused paths guard future scenarios). */
export const simEmit = emitEvent;
