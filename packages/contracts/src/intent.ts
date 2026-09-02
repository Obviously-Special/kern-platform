import { z } from 'zod';

/**
 * What the visitor is trying to accomplish (doc 3 §5.2).
 * Produced by the Intent Engine; consumed by the orchestrator and analytics.
 */
export const IntentSchema = z.object({
  intent_id: z.string().min(1),
  label: z.string().min(1), // e.g. 'book_appointment', 'delivery_question'
  confidence: z.number().min(0).max(1),
  goal: z.string().max(1000).optional(), // free-text goal description
  urgency: z.enum(['low', 'medium', 'high']).default('medium'),
  source: z.enum(['inference', 'explicit']).default('inference'),
  journey_id: z.string().optional(),
});
export type Intent = z.infer<typeof IntentSchema>;
