import { z } from 'zod';
import type { PermissionLevel } from '@kern/contracts';

/**
 * The typed tool registry (doc 3 §10: every tool declares name, purpose,
 * inputs, authorization scope, reversibility, side effects, success and
 * failure signals, audit event). The agent may not execute anything
 * outside these contracts.
 *
 * The description + params + example are RENDERED INTO THE MODEL PROMPT
 * (see broker.toolsPromptSection) — they are the model's contract.
 */
export interface ToolContract {
  name: string;
  description: string;
  permissionLevel: PermissionLevel;
  reversibility: 'reversible' | 'irreversible';
  sideEffects: string;
  successSignal: string;
  failureSignal: string;
  executor: 'browser' | 'api';
  paramsSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  /** Worked example rendered in the prompt — shows canonical value formats. */
  example?: Record<string, unknown>;
}

const Ref = z.string().min(1).describe('an element id or kern-el-N ref from the page context');

export const TOOLS: ToolContract[] = [
  {
    name: 'book_appointment',
    description:
      "Creates the visitor's COMPLETE booking in one step — it replaces walking the 6-step wizard entirely. Propose it whenever every required argument is present, even if the page shows a mid-flow step. Nothing runs until the visitor confirms.",
    permissionLevel: 'transactional',
    reversibility: 'irreversible',
    sideEffects: 'Creates a confirmed booking with a booking reference.',
    successSignal: 'The booking API returns a booking reference.',
    failureSignal: 'The booking API returns an error.',
    executor: 'api',
    paramsSchema: z.object({
      experience: z.string().min(1).max(100).describe('the experience name copied verbatim from the page context or COMPANY KNOWLEDGE (e.g. "Eiger Panorama Hike")'),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('ISO date YYYY-MM-DD (e.g. 2026-09-12). CURRENT_DATE is today — compute the date from it'),
      guests: z.number().int().min(1).max(8).describe('whole number of guests, 1-8'),
      name: z.string().min(1).max(100).describe('the exact name the visitor gave'),
      email: z.string().email().describe('the exact email address the visitor gave'),
      insurance: z.string().max(50).optional().describe('the insurance option name as listed on the page, or omit'),
      extras: z.array(z.string().max(50)).max(5).optional().describe('extra items as named on the page (e.g. "Equipment rental"), or omit'),
    }),
    example: {
      experience: 'Eiger Panorama Hike',
      date: '2026-09-12',
      guests: 2,
      name: 'Max Mustermann',
      email: 'max@example.com',
      insurance: 'Full cover',
      extras: ['Equipment rental'],
    },
  },
  {
    name: 'fill_field',
    description: 'Fill a non-sensitive input or textarea with a value.',
    permissionLevel: 'reversible',
    reversibility: 'reversible',
    sideEffects: 'Sets the field value; the visitor can edit it afterwards.',
    successSignal: 'The field contains the requested value.',
    failureSignal: 'The field does not contain the value, or the element is missing.',
    executor: 'browser',
    paramsSchema: z.object({
      ref: Ref,
      value: z.string().min(1).max(200).describe('the text to put into the field'),
    }),
    example: { ref: 'kern-el-0', value: 'Max Mustermann' },
  },
  {
    name: 'select_option',
    description: 'Select a radio button or checkbox.',
    permissionLevel: 'reversible',
    reversibility: 'reversible',
    sideEffects: 'Checks the option; the visitor can change it afterwards.',
    successSignal: 'The option is checked.',
    failureSignal: 'The option is not checked, or the element is missing.',
    executor: 'browser',
    paramsSchema: z.object({ ref: Ref }),
    example: { ref: 'kern-el-0' },
  },
  {
    name: 'click_element',
    description: 'Click a button or link (navigation-style elements only — never payment or confirmation buttons).',
    permissionLevel: 'reversible',
    reversibility: 'reversible',
    sideEffects: "Performs the element's own click action.",
    successSignal: 'The click was delivered to the element.',
    failureSignal: 'The element is missing or the click failed.',
    executor: 'browser',
    paramsSchema: z.object({ ref: Ref }),
    example: { ref: 'kern-el-1' },
  },
];

export function getTool(name: string): ToolContract | undefined {
  return TOOLS.find((t) => t.name === name);
}
