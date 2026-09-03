import { z } from 'zod';

/**
 * The platform event taxonomy (doc 3 §11.1).
 *
 * Every future dashboard, friction insight and revenue estimate is built
 * from this single language — this is the moat. Events are emitted by the
 * SDK and the backend, stored tenant-isolated, and never renamed casually.
 * Adding an event = extend the union; changing one = schema migration.
 *
 * Event families: Navigation · Intent · Assistance · Action · Friction · Business
 */

// ---- Navigation ------------------------------------------------------------

export const PageViewEventDataSchema = z.object({
  url: z.string().min(1).max(2000),
  route: z.string().max(500).optional(),
  page_type: z.string().min(1),
  title: z.string().max(500).optional(),
});
export type PageViewEventData = z.infer<typeof PageViewEventDataSchema>;

export const RouteChangeEventDataSchema = z.object({
  from: z.string().max(500),
  to: z.string().max(500),
});
export type RouteChangeEventData = z.infer<typeof RouteChangeEventDataSchema>;

export const SearchUsedEventDataSchema = z.object({
  query: z.string().max(500),
});
export type SearchUsedEventData = z.infer<typeof SearchUsedEventDataSchema>;

// ---- Intent -----------------------------------------------------------------

export const QuestionAskedEventDataSchema = z.object({
  message: z.string().min(1).max(4000),
});
export type QuestionAskedEventData = z.infer<typeof QuestionAskedEventDataSchema>;

export const IntentDetectedEventDataSchema = z.object({
  intent_id: z.string().min(1),
  label: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
export type IntentDetectedEventData = z.infer<typeof IntentDetectedEventDataSchema>;

export const IntentChangedEventDataSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});
export type IntentChangedEventData = z.infer<typeof IntentChangedEventDataSchema>;

// ---- Assistance --------------------------------------------------------------

export const AnswerShownEventDataSchema = z.object({
  message_id: z.string().min(1),
  mode: z.enum(['answer', 'guide', 'ask', 'handoff']),
  latency_ms: z.number().int().min(0),
});
export type AnswerShownEventData = z.infer<typeof AnswerShownEventDataSchema>;

export const GuideEventDataSchema = z.object({
  target_element_id: z.string().optional(),
  target_label: z.string().max(300).optional(),
});
export type GuideEventData = z.infer<typeof GuideEventDataSchema>;

export const HandoffEventDataSchema = z.object({
  reason: z.enum(['low_confidence', 'sensitive_request', 'repeated_failure', 'high_value_lead', 'policy_conflict']),
  summary: z.string().max(2000).optional(),
});
export type HandoffEventData = z.infer<typeof HandoffEventDataSchema>;

// ---- Action -------------------------------------------------------------------

export const ActionProposedEventDataSchema = z.object({
  action_id: z.string().min(1),
  tool: z.string().min(1),
  permission_level: z.enum(['read', 'guide', 'reversible', 'transactional', 'sensitive']),
});
export type ActionProposedEventData = z.infer<typeof ActionProposedEventDataSchema>;

export const ActionConfirmedEventDataSchema = z.object({ action_id: z.string().min(1) });
export type ActionConfirmedEventData = z.infer<typeof ActionConfirmedEventDataSchema>;

export const ActionStartedEventDataSchema = z.object({ action_id: z.string().min(1) });
export type ActionStartedEventData = z.infer<typeof ActionStartedEventDataSchema>;

export const ActionSucceededEventDataSchema = z.object({
  action_id: z.string().min(1),
  result: z.record(z.string(), z.unknown()).optional(),
});
export type ActionSucceededEventData = z.infer<typeof ActionSucceededEventDataSchema>;

export const ActionFailedEventDataSchema = z.object({
  action_id: z.string().min(1),
  error: z.string().max(1000),
});
export type ActionFailedEventData = z.infer<typeof ActionFailedEventDataSchema>;

export const JourneyStepEventDataSchema = z.object({
  journey_id: z.string().min(1),
  step: z.number().int().min(1),
  total_steps: z.number().int().min(1).optional(),
  label: z.string().max(100).optional(),
  status: z.enum(['entered', 'completed', 'abandoned']),
  latency_ms: z.number().int().min(0).optional(),
});
export type JourneyStepEventData = z.infer<typeof JourneyStepEventDataSchema>;

// ---- Friction -----------------------------------------------------------------

export const RepeatQuestionEventDataSchema = z.object({
  signature: z.string().min(1), // e.g. 'billing.change_payment_method'
});
export type RepeatQuestionEventData = z.infer<typeof RepeatQuestionEventDataSchema>;

export const DeadEndEventDataSchema = z.object({
  page_type: z.string().optional(),
});
export type DeadEndEventData = z.infer<typeof DeadEndEventDataSchema>;

export const ErrorSeenEventDataSchema = z.object({
  message: z.string().max(500).optional(),
});
export type ErrorSeenEventData = z.infer<typeof ErrorSeenEventDataSchema>;

export const AbandonAfterHelpEventDataSchema = z.object({
  page_type: z.string().optional(),
});
export type AbandonAfterHelpEventData = z.infer<typeof AbandonAfterHelpEventDataSchema>;

export const RecoveryEventDataSchema = z.object({
  journey_id: z.string().optional(),
});
export type RecoveryEventData = z.infer<typeof RecoveryEventDataSchema>;

// ---- Business ------------------------------------------------------------------

export const BusinessEventDataSchema = z.object({
  value: z.number().optional(),
  currency: z.string().length(3).optional(),
  reference: z.string().max(200).optional(),
});
export type BusinessEventData = z.infer<typeof BusinessEventDataSchema>;

// ---- The event union -----------------------------------------------------------

export const KernEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('page_view'), data: PageViewEventDataSchema }),
  z.object({ type: z.literal('route_change'), data: RouteChangeEventDataSchema }),
  z.object({ type: z.literal('search_used'), data: SearchUsedEventDataSchema }),

  z.object({ type: z.literal('question_asked'), data: QuestionAskedEventDataSchema }),
  z.object({ type: z.literal('intent_detected'), data: IntentDetectedEventDataSchema }),
  z.object({ type: z.literal('intent_changed'), data: IntentChangedEventDataSchema }),

  z.object({ type: z.literal('answer_shown'), data: AnswerShownEventDataSchema }),
  z.object({ type: z.literal('guide_started'), data: GuideEventDataSchema }),
  z.object({ type: z.literal('guide_completed'), data: GuideEventDataSchema }),
  z.object({ type: z.literal('handoff'), data: HandoffEventDataSchema }),

  z.object({ type: z.literal('journey_step'), data: JourneyStepEventDataSchema }),

  z.object({ type: z.literal('action_proposed'), data: ActionProposedEventDataSchema }),
  z.object({ type: z.literal('action_confirmed'), data: ActionConfirmedEventDataSchema }),
  z.object({ type: z.literal('action_started'), data: ActionStartedEventDataSchema }),
  z.object({ type: z.literal('action_succeeded'), data: ActionSucceededEventDataSchema }),
  z.object({ type: z.literal('action_failed'), data: ActionFailedEventDataSchema }),

  z.object({ type: z.literal('action_cancelled'), data: z.object({ action_id: z.string().min(1) }) }),

  z.object({ type: z.literal('repeat_question'), data: RepeatQuestionEventDataSchema }),
  z.object({ type: z.literal('dead_end'), data: DeadEndEventDataSchema }),
  z.object({ type: z.literal('error_seen'), data: ErrorSeenEventDataSchema }),
  z.object({ type: z.literal('abandon_after_help'), data: AbandonAfterHelpEventDataSchema }),
  z.object({ type: z.literal('recovery'), data: RecoveryEventDataSchema }),

  z.object({ type: z.literal('lead_created'), data: BusinessEventDataSchema }),
  z.object({ type: z.literal('cart_added'), data: BusinessEventDataSchema }),
  z.object({ type: z.literal('checkout_started'), data: BusinessEventDataSchema }),
  z.object({ type: z.literal('purchase'), data: BusinessEventDataSchema }),
  z.object({ type: z.literal('booking'), data: BusinessEventDataSchema }),
  z.object({ type: z.literal('signup'), data: BusinessEventDataSchema }),
]);
export type KernEvent = z.infer<typeof KernEventSchema>;
export type KernEventType = KernEvent['type'];

/**
 * The envelope every stored event travels in (doc 3 §5.2).
 * tenant_id is SERVER-AUTHORITATIVE: optional at the SDK boundary, stamped
 * by the API from the authenticated site — the client never self-reports
 * its tenant, so cross-tenant events are structurally impossible.
 */
export const EventEnvelopeSchema = z.object({
  event_id: z.string().min(1),
  type: z.string().min(1), // KernEventType — kept loose here; KernEventSchema validates the payload
  session_id: z.string().min(1),
  site_id: z.string().min(1),
  tenant_id: z.string().min(1).optional(),
  occurred_at: z.string().datetime(),
  data: z.record(z.string(), z.unknown()),
});
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
