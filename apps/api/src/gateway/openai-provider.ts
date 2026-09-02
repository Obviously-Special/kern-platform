import OpenAI from 'openai';
import type { GatewayRequest, ModelGateway } from './types.js';

const client = new OpenAI(); // resolves OPENAI_API_KEY from env
const MODEL = process.env.KERN_OPENAI_MODEL ?? 'gpt-4o';

/**
 * OpenAI provider. Same contract as the Anthropic provider — the rest of
 * the platform never knows which vendor answered (doc 3: model gateway =
 * provider abstraction, logging, fallbacks).
 *
 * max_tokens 2048: consumer chat replies are deliberately short outputs.
 */
export class OpenAIGateway implements ModelGateway {
  readonly name = `openai:${MODEL}`;

  async chat({ system, messages }: GatewayRequest): Promise<string> {
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    const content = response.choices[0]?.message.content?.trim();
    if (!content) {
      // Empty or refused completion — degrade gracefully, never pretend
      return "I can't help with that request. Is there something else I can help you with on this page?";
    }
    return content;
  }
}
