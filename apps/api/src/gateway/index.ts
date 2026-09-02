import { AnthropicGateway } from './anthropic-provider';
import { MockGateway } from './mock-provider';
import { OpenAIGateway } from './openai-provider';
import type { ModelGateway } from './types';

export type { ModelGateway, GatewayRequest } from './types';

/**
 * Provider selection (doc 3 §5: "provider abstraction, logging, fallbacks").
 *
 * Priority: explicit KERN_PROVIDER (with matching key) → any key present
 * (Anthropic preferred) → mock. Per-tenant model routing arrives with the
 * tenant service; this is the extension point for it.
 */
export function createGateway(): ModelGateway {
  const explicit = process.env.KERN_PROVIDER;

  if (explicit === 'anthropic' && process.env.ANTHROPIC_API_KEY) return new AnthropicGateway();
  if (explicit === 'openai' && process.env.OPENAI_API_KEY) return new OpenAIGateway();
  if (explicit) {
    console.warn(`[kern] KERN_PROVIDER=${explicit} requested but its key is not set — falling through.`);
  }

  if (process.env.ANTHROPIC_API_KEY) return new AnthropicGateway();
  if (process.env.OPENAI_API_KEY) return new OpenAIGateway();

  console.warn('[kern] No ANTHROPIC_API_KEY or OPENAI_API_KEY set — running in MOCK MODE (canned replies, no model calls).');
  return new MockGateway();
}
