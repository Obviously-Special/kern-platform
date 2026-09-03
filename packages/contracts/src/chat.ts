import { z } from 'zod';
import { PageContextSchema } from './page-context';

/**
 * Walking-skeleton API contract: POST /chat.
 * The SDK sends the compact page model with every message so the assistant
 * is always anchored to what the visitor is actually looking at.
 */
export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  session_id: z.string().min(1),
  site_id: z.string().min(1),
  page_context: PageContextSchema,
  message: z.string().min(1).max(4000),
  history: z.array(ChatMessageSchema).max(20).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const AssistantModeSchema = z.enum(['answer', 'guide', 'ask', 'handoff']);
export type AssistantMode = z.infer<typeof AssistantModeSchema>;

/**
 * Guide target — which page element the widget should highlight/scroll to
 * (guide mode v1). Always an element from the page context the model was
 * shown; the API never emits targets it didn't receive.
 */
export const GuideTargetSchema = z
  .object({
    element_id: z.string().min(1).optional(),
    /** SDK-assigned reference when the element has no id. */
    element_ref: z.string().min(1).optional(),
    label: z.string().max(200).optional(),
  })
  .refine((t) => t.element_id !== undefined || t.element_ref !== undefined, {
    message: 'guide target requires element_id or element_ref',
  });
export type GuideTarget = z.infer<typeof GuideTargetSchema>;

/**
 * A proposed action the visitor may confirm (doc 3 §10: the LLM proposes,
 * the policy layer decides). Denied proposals never reach the SDK.
 */
export const ProposedActionSchema = z.object({
  action_id: z.string().min(1),
  tool: z.string().min(1),
  /** Human-readable line shown on the confirmation card. */
  label: z.string().max(200),
  permission_level: z.enum(['read', 'guide', 'reversible', 'transactional', 'sensitive']),
  decision: z.enum(['allowed', 'confirmation_required']),
  args: z.record(z.string(), z.unknown()),
});
export type ProposedAction = z.infer<typeof ProposedActionSchema>;

/** Execution result reported back by the SDK (server-authoritative audit). */
export const ActionResultReportSchema = z.object({
  action_id: z.string().min(1),
  session_id: z.string().min(1),
  result: z.enum(['succeeded', 'failed', 'cancelled']),
  error: z.string().max(500).optional(),
  /** What the verification observed (explainable, doc 3 §10 tool contract). */
  evidence: z.string().max(500).optional(),
});
export type ActionResultReport = z.infer<typeof ActionResultReportSchema>;

/**
 * The structured output contract between the gateway and the chat route
 * (Phase 2 close-out). Providers constrain the response format to this
 * schema — the model cannot forget to propose actions or targets.
 */
export const AssistantOutputSchema = z.object({
  reply: z.string().min(1).max(8000),
  guide: z
    .object({
      target: z.string().min(1), // element id or kern-el-N ref from the page context
    })
    .nullable(),
  actions: z
    .array(
      z.object({
        tool: z.string().min(1),
        /** JSON-encoded args string — the broker validates against per-tool contracts. */
        args: z.string().max(2000),
      }),
    )
    .max(5),
  memories: z.array(z.string().max(200)).max(3),
});
export type AssistantOutput = z.infer<typeof AssistantOutputSchema>;

export const ChatResponseSchema = z.object({
  message_id: z.string().min(1),
  reply: z.string().min(1).max(8000),
  mode: AssistantModeSchema,
  citations: z.array(z.string().max(500)).max(10).optional(),
  guide: GuideTargetSchema.optional(),
  actions: z.array(ProposedActionSchema).max(5).optional(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
