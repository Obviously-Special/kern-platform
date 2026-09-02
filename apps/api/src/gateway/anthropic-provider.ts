import Anthropic from '@anthropic-ai/sdk';
import type { GatewayReply, GatewayRequest, ModelGateway } from './types';

const MODEL = process.env.KERN_MODEL ?? 'claude-opus-5';

/**
 * Anthropic provider. Chat route specifics:
 * - max_tokens 2048: consumer chat replies are deliberately short outputs
 * - effort "medium": latency-sensitive customer chat (skill guidance: chat
 *   routes rarely repay high effort; medium is the cost-saving step-down)
 * - adaptive thinking is on by default for claude-opus-5
 * - server-side refusal fallbacks ("default"): on a policy decline the API
 *   re-runs the request on a fallback model inside the same call
 */
export class AnthropicGateway implements ModelGateway {
  readonly name = `anthropic:${MODEL}`;
  // Lazy for symmetry with the OpenAI provider; auth resolves from env
  // (ANTHROPIC_API_KEY or an ant auth profile) at first use.
  private _client: Anthropic | null = null;
  private get client(): Anthropic {
    return (this._client ??= new Anthropic());
  }

  async chat({ system, messages }: GatewayRequest): Promise<GatewayReply> {
    const response = await this.client.beta.messages.create({
      model: MODEL,
      max_tokens: 2048,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      // Stable system prompt with ephemeral caching — repeated turns reuse it
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const usage = {
      provider: 'anthropic',
      model: MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };

    if (response.stop_reason === 'refusal') {
      return {
        text: "I can't help with that request. Is there something else I can help you with on this page?",
        usage,
      };
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    return { text: text || "I'm not sure how to help with that yet.", usage };
  }
}
