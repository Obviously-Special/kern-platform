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

export const PageContextSchema = z.object({
  url: z.string().min(1).max(2000),
  route: z.string().max(500).optional(), // SPA route if different from url
  page_type: PageTypeSchema.default('unknown'),
  visible_text: VisibleTextSchema,
  elements: z.array(PageElementSchema).max(50),
  errors: z.array(z.string().max(300)).max(10), // visible validation/warning states
  entities: z.array(z.string().max(200)).max(10), // product/plan/booking ids where detectable
  state_hash: z.string().min(1), // changes when meaningful page state changes
  timestamp: z.string().datetime(),
});
export type PageContext = z.infer<typeof PageContextSchema>;
