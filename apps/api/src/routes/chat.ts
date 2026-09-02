import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { ChatRequestSchema, ChatResponseSchema, type PageContext } from '@kern/contracts';
import { createGateway } from '../gateway/index.js';

/**
 * The walking-skeleton chat route: page context in, page-aware answer out.
 * The orchestrator (intent, tool selection, guide/ask/handoff modes) is
 * Phase 1; v0 always answers in "answer" mode.
 */
export async function chatRoutes(app: FastifyInstance): Promise<void> {
  const gateway = createGateway();

  app.post('/chat', async (req, reply) => {
    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_request',
        details: parsed.error.flatten(),
      });
    }

    const { page_context, message, history } = parsed.data;
    const system = buildSystemPrompt(page_context);
    const messages = [...(history ?? []), { role: 'user' as const, content: message }];

    try {
      const replyText = await gateway.chat({ system, messages });
      return ChatResponseSchema.parse({
        message_id: randomUUID(),
        reply: replyText,
        mode: 'answer',
      });
    } catch (err) {
      app.log.error({ err }, 'gateway call failed');
      return reply.status(502).send({ error: 'gateway_error' });
    }
  });
}

/**
 * The v0 system prompt (doc 2 §3 interaction rules). Compact page context
 * embedded as structured text so the model can reference real elements.
 */
function buildSystemPrompt(ctx: PageContext): string {
  const ctxJson = JSON.stringify(
    {
      url: ctx.url,
      page_type: ctx.page_type,
      headings: ctx.visible_text.headings,
      elements: ctx.elements.map((e) => ({
        id: e.id,
        role: e.role,
        tag: e.tag,
        label: e.label,
      })),
      visible_errors: ctx.errors,
    },
    null,
    0,
  );

  return [
    'You are KERN, the intelligent assistant embedded in this website.',
    'Your job is to help the visitor complete their task on the current page.',
    '',
    'Rules:',
    '- Anchor every answer to the current page context below.',
    '- Prefer moving the visitor forward over long explanations.',
    '- Only reference page elements that are listed in the context. Never invent buttons or links.',
    '- If the page context is insufficient, ask ONE targeted clarifying question.',
    '- If you see visible_errors, acknowledge them and give the concrete next step.',
    '- Match the visitor\'s language.',
    '',
    'CURRENT_PAGE_TYPE: ' + ctx.page_type,
    'CURRENT_URL: ' + ctx.url,
    '',
    'Current page context (JSON):',
    ctxJson,
  ].join('\n');
}
