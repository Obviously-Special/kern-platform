import type { GatewayReply, GatewayRequest, ModelGateway } from './types';

/**
 * Mock provider for local development without an API key.
 * Clearly labelled so nobody mistakes it for real model output.
 */
export class MockGateway implements ModelGateway {
  readonly name = 'mock';

  async chat({ system }: GatewayRequest): Promise<GatewayReply> {
    const pageType = /CURRENT_PAGE_TYPE:\s*(\S+)/.exec(system)?.[1] ?? 'this';
    const url = /CURRENT_URL:\s*(\S+)/.exec(system)?.[1] ?? 'the current page';
    return {
      text:
        `(mock mode — no ANTHROPIC_API_KEY configured) ` +
        `I can see you're on the "${pageType}" page (${url}). ` +
        `Page context is flowing correctly — once a model key is set in apps/api/.env, ` +
        `I'll answer with full page awareness.`,
    };
  }
}
