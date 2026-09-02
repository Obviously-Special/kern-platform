import { z } from 'zod';

/**
 * Friction intelligence (doc 3 §11): clusters of repeated struggle patterns.
 * Score = repeat rate × severity × journey value × failure probability —
 * a ranking aid, not a scientific truth metric. Every insight links back to evidence.
 */
export const FrictionClusterSchema = z.object({
  cluster_id: z.string().min(1),
  signature: z.string().min(1), // stable pattern signature, e.g. 'booking.insurance_selection'
  volume: z.number().int().min(1),
  severity: z.enum(['low', 'medium', 'high']),
  affected_paths: z.array(z.string().max(500)).min(1),
  hypothesis: z.string().max(2000).optional(), // root-cause hypothesis
});
export type FrictionCluster = z.infer<typeof FrictionClusterSchema>;

/**
 * Revenue intelligence (doc 3 §11.3): high-intent interaction joined to
 * business outcomes, with transparent attribution. Estimates until observed
 * data replaces them.
 */
export const RevenueSignalSchema = z.object({
  signal_id: z.string().min(1),
  intent_label: z.string().optional(),
  funnel_stage: z.string().min(1),
  estimated_value: z.number().min(0),
  evidence: z.string().min(1), // what the estimate is based on — never black-box
});
export type RevenueSignal = z.infer<typeof RevenueSignalSchema>;
