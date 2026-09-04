import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { ChatRequestSchema, ChatResponseSchema, type GuideTarget, type PageContext, type PageElement } from '@kern/contracts';
import { createGateway } from '../gateway/index';
import { inferGuideFromReply } from '../guide';
import { detectIntent, type IntentResult } from '../intent';
import { recall, remember } from '../memory';
import { inferBookingAction, inferFillAction, processProposals, toolsPromptSection, type ActionProposal } from '../actions/broker';
import { getSitePageMap } from '../knowledge/page-map';
import { getAllChunks } from '../knowledge/store';
import { retrieve, type RetrievedChunk } from '../knowledge/retriever';
import { storeEvent } from '../event-buffer';

/**
 * The walking-skeleton chat route: page context + company knowledge in,
 * grounded page-aware answer out. The orchestrator (intent, tool
 * selection, guide/ask/handoff modes) is Phase 1; v0 always answers.
 */
export async function chatRoutes(app: FastifyInstance): Promise<void> {
  const gateway = createGateway();

  app.post('/chat', async (req, reply) => {
    const site = req.kernSite;
    if (!site) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_request',
        details: parsed.error.flatten(),
      });
    }
    if (parsed.data.site_id !== site.site.site_id) {
      return reply.status(403).send({ error: 'site_id_does_not_match_authenticated_site' });
    }

    const { session_id, page_context, message, history } = parsed.data;
    const intent = detectIntent(message, page_context);
    const retrieved = retrieve(getAllChunks(), message, page_context);
    const system = buildSystemPrompt(page_context, retrieved, intent, recall(session_id));

    // Server-side event: intent becomes part of the analytics stream
    storeEvent({
      event_id: randomUUID(),
      type: 'intent_detected',
      session_id,
      site_id: site.site.site_id,
      tenant_id: site.site.tenant_id,
      occurred_at: new Date().toISOString(),
      data: {
        intent_id: `int_${randomUUID().slice(0, 8)}`,
        label: intent.label,
        confidence: intent.confidence,
      },
    });

    const messages = [...(history ?? []), { role: 'user' as const, content: message }];

    try {
      const result = await gateway.chat({ system, messages });
      if (result.usage) {
        app.log.info({ ...result.usage, site_id: site.site.site_id }, 'gateway call');
      }
      const output = result.output;

      // Memories: stored verbatim from the structured output
      remember(session_id, output.memories);

      // Guide target: validated against the context the model saw;
      // deterministic reply-inference covers a missed target
      const guide =
        resolveGuideTarget(output.guide?.target, page_context.elements) ??
        inferGuideFromReply(output.reply, page_context.elements);

      // Actions: structured proposals -> tool contracts -> policy decisions.
      // Deterministic fallbacks (fill + booking) run whenever ZERO actions
      // survive — whether the model proposed nothing or every proposal was
      // rejected. The confirmation card and broker validation still gate
      // execution; inference never bypasses them.
      const siteMap = getSitePageMap(site.site.site_id);
      const run = (proposals: ActionProposal[]) =>
        processProposals({
          siteId: site.site.site_id,
          sessionId: session_id,
          tenantId: site.site.tenant_id,
          proposals,
          contextElements: page_context.elements,
        });

      const modelProposals = output.actions.map((a) => ({
        tool: a.tool,
        args: parseJsonArgs(a.args),
      }));
      let { actions, rejected } = run(modelProposals);

      if (actions.length === 0) {
        const inferred =
          inferFillAction(message, output.reply, page_context.elements) ??
          inferBookingAction(message, output.reply, siteMap);
        if (inferred) ({ actions, rejected } = run([inferred]));
      }
      if (rejected.length > 0) {
        app.log.info({ session_id, rejected }, 'action proposals rejected');
      }

      return ChatResponseSchema.parse({
        message_id: randomUUID(),
        reply: output.reply,
        mode: guide ? 'guide' : 'answer',
        citations: buildCitations(retrieved),
        guide,
        actions: actions.length > 0 ? actions : undefined,
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
/** args travel as a JSON string from the structured output; unparseable args become empty (the broker drops them). */
function parseJsonArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Structured-output guide target -> validated GuideTarget (never an element the model didn't see). */
function resolveGuideTarget(target: string | undefined, elements: PageElement[]): GuideTarget | undefined {
  if (!target) return undefined;
  const el = elements.find((e) => e.id === target || e.ref === target);
  if (!el || (!el.id && !el.ref)) return undefined;
  return { element_id: el.id, element_ref: el.ref, label: el.label };
}

/** Per-intent behavior guidance for the model (doc 2 §3 agent behavior model). */
function intentBehavior(intent: IntentResult): string {
  switch (intent.label) {
    case 'navigation':
    case 'task_attempt':
      return 'The visitor wants to DO something — complete it through "actions": when every required argument of a tool is present, propose the matching tool; only when information is missing, guide to the next element and ask for exactly what is missing. Keep prose minimal. Set "guide" only to an element your reply actually refers to.';
    case 'help_request':
      return 'The visitor may be stuck — acknowledge that, be concrete, and give exactly ONE next step.';
    case 'objection':
      return 'The visitor raised a concern — acknowledge it, answer from COMPANY KNOWLEDGE, and give a concrete next step. If the knowledge does not cover the specific concern, say so explicitly — never fill the gap with general knowledge.';
    case 'comparison':
      return 'The visitor is comparing — give a short factual comparison from COMPANY KNOWLEDGE, then ONE recommendation.';
    default:
      return 'Answer the question directly from the current context and COMPANY KNOWLEDGE.';
  }
}

function buildSystemPrompt(
  ctx: PageContext,
  retrieved: RetrievedChunk[],
  intent: IntentResult,
  sessionFacts: string[],
): string {
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
      journey: ctx.journey
        ? {
            journey_id: ctx.journey.journey_id,
            current_step: ctx.journey.current_step,
            total_steps: ctx.journey.total_steps,
            current_label: ctx.journey.current_label,
          }
        : undefined,
    },
    null,
    0,
  );

  const memorySection =
    sessionFacts.length > 0
      ? ['', 'SESSION MEMORY (facts from earlier in this conversation — use them; do not make the visitor repeat themselves):', ...sessionFacts.map((f) => `- ${f}`)].join('\n')
      : '';

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
    '- When your answer refers to a specific page element (a button, link, field or option), set "guide": {"target": "<id or kern-el-N ref from the page context>"} to the element your answer is about. Otherwise set "guide": null.',
    '- When the visitor asks to be shown a button, link or field BY NAME, choose as the guide target the element whose label matches that name most closely — prefer the one inside the current step or current view. If several elements share the name, pick the most specific match; never guess when the labels differ.',
    '- Proposing an action is always safe: NOTHING executes until the visitor confirms the on-screen proposal card. "actions" is how you get things done — prose alone never completes a task.',
    '- When EVERY required argument of a tool is present in the conversation, PROPOSE the tool instead of describing or discussing it, and say briefly in "reply" what you are proposing.',
    '- book_appointment creates the WHOLE booking in one step — it replaces walking the wizard, so propose it whenever the visitor supplied all required details, even while the page shows a mid-flow step. Map the visitor\'s words to canonical names from the page context or COMPANY KNOWLEDGE ("Eiger hike" → the listed experience name) and dates to YYYY-MM-DD — that mapping is not inventing.',
    '- If a required argument is truly absent, ASK for exactly that one thing in "reply" and propose nothing until provided — never invent a name, email or date. Use [] only when no listed tool serves the request. Never propose actions for passwords, payment details or account deletion.',
    '- Put up to three session facts the visitor should not have to repeat into "memories" (e.g. "guest is booking the Eiger hike for 2"). Never store names, emails or payment details.',
    '- Only reference page elements that are listed in the context. Never invent buttons or links.',
    '- If COMPANY KNOWLEDGE covers the question, answer from it and name the source. Never invent policies, prices or facts.',
    '- When the visitor asks what is on a page or what they will see there, summarize the relevant COMPANY KNOWLEDGE concretely — include prices, options and specific facts when they are present.',
    '- Use COMPANY KNOWLEDGE directly whenever any excerpt relates to the question or the page the visitor asks about. The "does not provide" fallback applies ONLY when nothing in the knowledge relates to the question — if related knowledge exists, answer from it instead.',
    '- NEVER present general industry practice ("standard payment systems", "typically", "usually") as this company\'s policy. If COMPANY KNOWLEDGE does not state a specific fact, say the website does not provide it — do not fill the gap with general knowledge.',
    '- If you see visible_errors, acknowledge them and give the concrete next step.',
    '- If the page context includes journey state and the visitor asks where they are or which step they are on, answer with the exact step number and total (e.g. "step 4 of 6 — Insurance").',
    '- Use plain text with light emphasis only (e.g. **important**). No headings, no tables, no markdown links — the widget renders a compact chat.',
    "- Match the visitor's language.",
    '',
    'CURRENT_PAGE_TYPE: ' + ctx.page_type,
    'CURRENT_URL: ' + ctx.url,
    'CURRENT_DATE: ' + new Date().toISOString().slice(0, 10) + ' (' + new Date().toLocaleDateString('en-US', { weekday: 'long' }) + ') — use it to resolve relative dates like "Saturday" against the dates in the page context.',
    `DETECTED_INTENT: ${intent.label} (confidence ${intent.confidence.toFixed(2)})`,
    intentBehavior(intent),
    '',
    'Current page context (JSON):',
    ctxJson,
    memorySection,
    knowledgeSection,
    '',
    toolsPromptSection(),
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
