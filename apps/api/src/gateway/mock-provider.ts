import type { GatewayRequest, ModelGateway } from './types.js';

/**
 * Mock provider for local development without an API key.
 * Clearly labelled so nobody mistakes it for real model output.
 */
export class MockGateway implements ModelGateway {
  readonly name = 'mock';

  async chat({ system }: GatewayRequest): Promise<string> {
    const pageType = /CURRENT_PAGE_TYPE:\s*(\S+)/.exec(system)?.[1] ?? 'this';
    const url = /CURRENT_URL:\s*(\S+)/.exec(system)?.[1] ?? 'the current page';
    return (
      `(mock mode — no ANTHROPIC_API_KEY configured) ` +
      `I can see you're on the "${pageType}" page (${url}). ` +
      `Page context is flowing correctly — once a model key is set in apps/api/.env, ` +
      `I'll answer with full page awareness.`
    );
  }
}
