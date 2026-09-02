import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { ChatRequestSchema, ChatResponseSchema, type PageContext } from '@kern/contracts';
import { createGateway } from '../gateway/index';
import { getAllChunks } from '../knowledge/store';
import { retrieve, type RetrievedChunk } from '../knowledge/retriever';

/**
 * The walking-skeleton chat route: page context + company knowledge in,
 * grounded page-aware answer out. The orchestrator (intent, tool
 * selection, guide/ask/handoff modes) is Phase 1; v0 always answers.
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
    const retrieved = retrieve(getAllChunks(), message, page_context);
    const system = buildSystemPrompt(page_context, retrieved);
    const messages = [...(history ?? []), { role: 'user' as const, content: message }];

    try {
      const replyText = await gateway.chat({ system, messages });
      return ChatResponseSchema.parse({
        message_id: randomUUID(),
        reply: replyText,
        mode: 'answer',
        citations: buildCitations(retrieved),
      });
    } catch (err) {
      app.log.error({ err }, 'gateway call failed');
      return reply.status(502).send({ error: 'gateway_error' });
    }
  });
}

/**
 * v0 system prompt (doc 2 §3 interaction rules): live page context +
 * retrieved company knowledge, each excerpt carrying its source.
 */
function buildSystemPrompt(ctx: PageContext, retrieved: RetrievedChunk[]): string {
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

  const knowledgeSection =
    retrieved.length > 0
      ? [
          '',
          'COMPANY KNOWLEDGE (relevant excerpts — ground answers in these, and name the source naturally, e.g. "per our FAQ" or "according to our policy"):',
          ...retrieved.map(
            (r, i) =>
              `[${i + 1}] ${r.chunk.heading} — source: ${r.chunk.url}\n${r.chunk.text}`,
          ),
        ].join('\n')
      : '';

  return [
    'You are KERN, the intelligent assistant embedded in this website.',
    'Your job is to help the visitor complete their task on the current page.',
    '',
    'Rules:',
    '- Anchor every answer to the current page context below.',
    '- Prefer moving the visitor forward over long explanations.',
    '- Only reference page elements that are listed in the context. Never invent buttons or links.',
    '- If COMPANY KNOWLEDGE covers the question, answer from it and name the source. Never invent policies, prices or facts.',
    '- If COMPANY KNOWLEDGE does not cover the question, say the website does not provide that information and offer a safe next step.',
    '- If you see visible_errors, acknowledge them and give the concrete next step.',
    "- Match the visitor's language.",
    '',
    'CURRENT_PAGE_TYPE: ' + ctx.page_type,
    'CURRENT_URL: ' + ctx.url,
    '',
    'Current page context (JSON):',
    ctxJson,
    knowledgeSection,
  ].join('\n');
}

/** Cited sources, deduped, in retrieval order. */
function buildCitations(retrieved: RetrievedChunk[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of retrieved) {
    const label = `${r.chunk.url} — ${r.chunk.heading}`;
    if (!seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out.slice(0, 10);
}
