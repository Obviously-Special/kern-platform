import { z } from 'zod';

/**
 * Action safety model, doc 3 §10. The LLM proposes tool calls; the
 * deterministic Action Broker applies the policy. Credentials and raw
 * permission logic are never exposed to the model.
 */
export const PermissionLevelSchema = z.enum([
  'read', // L0 — inspect page, search catalog, explain policy
  'guide', // L1 — highlight, scroll, navigate, open panel
  'reversible', // L2 — fill draft fields, add to cart, create draft
  'transactional', // L3 — book, submit application, place order
  'sensitive', // L4 — delete account, transfers, sensitive records
]);
export type PermissionLevel = z.infer<typeof PermissionLevelSchema>;

export const PolicyDecisionSchema = z.enum([
  'allowed',
  'denied',
  'confirmation_required',
]);
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;

export const ActionResultSchema = z.enum([
  'pending',
  'succeeded',
  'failed',
  'cancelled',
]);
export type ActionResult = z.infer<typeof ActionResultSchema>;

/**
 * Every executed or proposed action, audit-logged (doc 3 §5.2).
 * `policy_decision` records what the broker decided, not what the model wanted.
 */
export const ActionSchema = z.object({
  action_id: z.string().min(1),
  session_id: z.string().min(1),
  tool: z.string().min(1), // named tool from the tenant's tool registry
  arguments: z.record(z.string(), z.unknown()),
  permission_level: PermissionLevelSchema,
  policy_decision: PolicyDecisionSchema,
  result: ActionResultSchema,
  error: z.string().max(1000).optional(),
  timestamp: z.string().datetime(),
});
export type Action = z.infer<typeof ActionSchema>;
