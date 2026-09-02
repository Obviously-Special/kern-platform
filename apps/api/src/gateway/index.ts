import { AnthropicGateway } from './anthropic-provider.js';
import { MockGateway } from './mock-provider.js';
import type { ModelGateway } from './types.js';

export type { ModelGateway, GatewayRequest } from './types.js';

/**
 * Provider selection. v0: Anthropic when a key is present, mock otherwise.
 * The gateway is the extension point for more providers and per-tenant
 * model routing (doc 3 §5: "provider abstraction, logging, fallbacks").
 */
export function createGateway(): ModelGateway {
  if (process.env.ANTHROPIC_API_KEY) {
    return new AnthropicGateway();
  }
  console.warn('[kern] ANTHROPIC_API_KEY not set — running in MOCK MODE (canned replies, no model calls).');
  return new MockGateway();
}
