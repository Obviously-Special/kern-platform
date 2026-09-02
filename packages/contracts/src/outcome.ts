import { z } from 'zod';

/**
 * Closes the loop (doc 3 §5.2): did the visitor's task succeed, and what
 * business value did it carry? Joined to interactions where available.
 */
export const OutcomeStatusSchema = z.enum([
  'completed',
  'partial',
  'failed',
  'abandoned',
  'escalated',
]);
export type OutcomeStatus = z.infer<typeof OutcomeStatusSchema>;

export const OutcomeSchema = z.object({
  task_id: z.string().min(1),
  status: OutcomeStatusSchema,
  conversion_value: z.number().optional(), // e.g. order value in currency units
  currency: z.string().length(3).optional(), // ISO 4217
  timestamp: z.string().datetime(),
});
export type Outcome = z.infer<typeof OutcomeSchema>;
