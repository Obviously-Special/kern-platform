import { z } from 'zod';

/**
 * The compact page model sent with every turn (doc 3 §5.2).
 * Never the raw DOM — the SDK reduces the page locally and only relevant
 * nodes travel. `state_hash` lets the platform detect changes without
 * re-serializing.
 */
export const PageTypeSchema = z.enum([
  'home',
  'product',
  'pricing',
  'search',
  'checkout',
  'booking',
  'account',
  'help',
  'other',
  'unknown',
]);
export type PageType = z.infer<typeof PageTypeSchema>;

/** A relevant interactive element the SDK selected (not every DOM node). */
export const PageElementSchema = z.object({
  id: z.string().optional(),
  /**
   * SDK-assigned stable reference (kern-el-N) so guide mode can target
   * elements that have no id — works on any site without site changes
   * (doc 3 §5.3: stable identifiers where possible, robust selectors as fallback).
   */
  ref: z.string().optional(),
  role: z.string().optional(), // ARIA role, e.g. 'button', 'textbox'
  tag: z.string().optional(), // e.g. 'button', 'a', 'input'
  label: z.string().optional(), // accessible name
  text: z.string().max(500).optional(), // truncated visible text
  href: z.string().optional(), // may be relative
});
export type PageElement = z.infer<typeof PageElementSchema>;

/** Structured visible content: what a visitor actually sees, compacted. */
export const VisibleTextSchema = z.object({
  title: z.string().max(500).optional(),
  headings: z.array(z.string().max(200)).max(20),
  description: z.string().max(2000).optional(),
});
export type VisibleText = z.infer<typeof VisibleTextSchema>;

/**
 * Journey state — which step of a multi-step flow the visitor is on
 * (doc 3 §6.1 "context mapping": current step). Detected by the SDK
 * (generic signals + per-site page-map hints) and always carries its
 * detection source and confidence so answers stay explainable.
 */
export const JourneyStateSchema = z.object({
  journey_id: z.string().min(1),
  total_steps: z.number().int().min(1),
  current_step: z.number().int().min(1),
  current_label: z.string().max(100).optional(),
  source: z.enum(['site-config', 'aria-current', 'stepper', 'url', 'visibility']),
  confidence: z.number().min(0).max(1),
});
export type JourneyState = z.infer<typeof JourneyStateSchema>;

export const PageContextSchema = z.object({
  url: z.string().min(1).max(2000),
  route: z.string().max(500).optional(), // SPA route if different from url
  page_type: PageTypeSchema.default('unknown'),
  visible_text: VisibleTextSchema,
  elements: z.array(PageElementSchema).max(50),
  errors: z.array(z.string().max(300)).max(10), // visible validation/warning states
  entities: z.array(z.string().max(200)).max(10), // product/plan/booking ids where detectable
  journey: JourneyStateSchema.optional(),
  state_hash: z.string().min(1), // changes when meaningful page state changes
  timestamp: z.string().datetime(),
});
export type PageContext = z.infer<typeof PageContextSchema>;
