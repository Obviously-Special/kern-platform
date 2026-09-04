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
          tool: {
            type: 'string',
            description: 'One of: book_appointment, fill_field, select_option, click_element',
          },
          // args is a JSON-encoded STRING — strict mode requires closed
          // objects, and the broker validates args against per-tool
          // contracts anyway. The string must contain a valid JSON object
          // with inner quotes escaped. Example for book_appointment:
          // "{\\"experience\\":\\"Eiger Panorama Hike\\",\\"date\\":\\"2026-09-12\\",\\"guests\\":2,\\"name\\":\\"Max Mustermann\\",\\"email\\":\\"max@example.com\\"}"
          args: {
            type: 'string',
            description: 'A JSON-encoded string of the tool arguments — the string itself is a JSON object with inner quotes escaped, e.g. for fill_field: "{\\"ref\\":\\"kern-el-0\\",\\"value\\":\\"Max\\"}"',
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
