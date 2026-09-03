import OpenAI from 'openai';
import type { GatewayReply, GatewayRequest, ModelGateway } from './types';
import { OUTPUT_JSON_SCHEMA, parseStructuredOutput } from './output-parser';

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
  // Lazy: the OpenAI SDK throws at construction without a key, so the
  // client is only built when this provider is actually selected.
  private _client: OpenAI | null = null;
  private get client(): OpenAI {
    return (this._client ??= new OpenAI()); // resolves OPENAI_API_KEY from env
  }

  async chat({ system, messages }: GatewayRequest): Promise<GatewayReply> {
    const response = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 2048,
      // Structured outputs (strict): the model is CONSTRAINED to the
      // KERN response schema — it cannot forget actions or targets
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'kern_assistant_output',
          strict: true,
          schema: OUTPUT_JSON_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      messages: [
        { role: 'system', content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    const usage = {
      provider: 'openai',
      model: MODEL,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    };

    const content = response.choices[0]?.message.content?.trim() ?? '';
    const output = parseStructuredOutput(content);
    if (!content) {
      // Empty or refused completion — degrade gracefully, never pretend
      output.reply = "I can't help with that request. Is there something else I can help you with on this page?";
    }
    return { output, usage };
  }
}
