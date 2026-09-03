import { z } from 'zod';
import type { PermissionLevel } from '@kern/contracts';

/**
 * The typed tool registry (doc 3 §10: every tool declares name, purpose,
 * inputs, authorization scope, reversibility, side effects, success and
 * failure signals, audit event). The agent may not execute anything
 * outside these contracts.
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
}

const Ref = z.string().min(1);

export const TOOLS: ToolContract[] = [
  {
    name: 'fill_field',
    description: 'Fill a non-sensitive input or textarea with a value.',
    permissionLevel: 'reversible',
    reversibility: 'reversible',
    sideEffects: 'Sets the field value; the visitor can edit it afterwards.',
    successSignal: 'The field contains the requested value.',
    failureSignal: 'The field does not contain the value, or the element is missing.',
    executor: 'browser',
    paramsSchema: z.object({ ref: Ref, value: z.string().min(1).max(200) }),
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
  },
  {
    name: 'click_element',
    description: 'Click a button or link (navigation-style elements only — never payment or confirmation buttons).',
    permissionLevel: 'reversible',
    reversibility: 'reversible',
    sideEffects: 'Performs the element\'s own click action.',
    successSignal: 'The click was delivered to the element.',
    failureSignal: 'The element is missing or the click failed.',
    executor: 'browser',
    paramsSchema: z.object({ ref: Ref }),
  },
  {
    name: 'book_appointment',
    description: 'Create a booking in the booking system. Requires experience, date, guests, name, email.',
    permissionLevel: 'transactional',
    reversibility: 'irreversible',
    sideEffects: 'Creates a confirmed booking with a booking reference.',
    successSignal: 'The booking API returns a booking reference.',
    failureSignal: 'The booking API returns an error.',
    executor: 'api',
    paramsSchema: z.object({
      experience: z.string().min(1).max(100),
      date: z.string().min(1).max(20),
      guests: z.number().int().min(1).max(8),
      name: z.string().min(1).max(100),
      email: z.string().email(),
      insurance: z.string().max(50).optional(),
      extras: z.array(z.string().max(50)).max(5).optional(),
    }),
  },
];

export function getTool(name: string): ToolContract | undefined {
  return TOOLS.find((t) => t.name === name);
}
