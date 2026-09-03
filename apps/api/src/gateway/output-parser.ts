import { AssistantOutputSchema, type AssistantOutput } from '@kern/contracts';

/**
 * Shared structured-output parsing (provider-agnostic). Providers with
 * format support constrain the model to OUTPUT_JSON_SCHEMA; when the
 * result still isn't valid JSON of the right shape (or a provider lacks
 * format support), the raw text degrades gracefully to a plain reply —
 * never a crash, never a lost answer.
 */
export function parseStructuredOutput(raw: string): AssistantOutput {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const validated = AssistantOutputSchema.safeParse(parsed);
    if (validated.success) return validated.data;
  } catch {
    /* fall through to plain-text degradation */
  }
  const text = raw.trim();
  return {
    reply: text || "I'm not sure how to help with that yet.",
    guide: null,
    actions: [],
    memories: [],
  };
}

/**
 * The response contract handed to providers that support structured
 * outputs (OpenAI strict json_schema, Anthropic output_config.format).
 * Every field required → the model cannot forget to propose actions,
 * targets or memories.
 */
export const OUTPUT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    reply: {
      type: 'string',
      description: 'The visible reply, plain text (light **bold** emphasis allowed, no markdown links).',
    },
    guide: {
      type: ['object', 'null'],
      properties: {
        target: {
          type: 'string',
          description: 'The id or kern-el-N reference of the page element the answer points the visitor to, exactly as listed in the page context.',
        },
      },
      required: ['target'],
      additionalProperties: false,
    },
    actions: {
      type: 'array',
      description: 'Proposed actions — ONLY tools from the AVAILABLE TOOLS list; each runs only after the visitor confirms it.',
      items: {
        type: 'object',
        properties: {
          tool: { type: 'string' },
          // args is a JSON-encoded STRING — strict mode requires closed
          // objects, and the broker validates args against per-tool
          // contracts anyway. Example: "{\\"ref\\":\\"kern-el-0\\",\\"value\\":\\"Max\\"}"
          args: {
            type: 'string',
            description: 'JSON string of the tool arguments, e.g. {"ref":"kern-el-0","value":"Max"}',
          },
        },
        required: ['tool', 'args'],
        additionalProperties: false,
      },
    },
    memories: {
      type: 'array',
      description: 'Up to three session facts the visitor should not have to repeat. Never names, emails or payment details.',
      items: { type: 'string' },
    },
  },
  required: ['reply', 'guide', 'actions', 'memories'],
  additionalProperties: false,
} as const;
