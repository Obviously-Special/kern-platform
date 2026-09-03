import { randomUUID } from 'node:crypto';
import type { PageElement, ProposedAction } from '@kern/contracts';
import { getTool, TOOLS } from './registry';
import { recordProposal } from './audit';
import { evaluatePolicy } from '../policy/engine';
import { getPolicy } from '../policy/service';
import { getSitePageMap } from '../knowledge/page-map';

/**
 * The action broker (doc 3 §10): "the LLM proposes; a deterministic
 * policy layer decides." Model directives are parsed, validated against
 * tool contracts and the page context, run through the policy engine,
 * and only valid proposals become ProposedActions.
 */
const ACTION_DIRECTIVE = /<<ACTION:([a-z_]+)\|(\{[^>]*\})>>/g;

export interface ActionProposal {
  tool: string;
  args: Record<string, unknown>;
}

export function parseActionDirectives(reply: string): { reply: string; proposals: ActionProposal[] } {
  const proposals: ActionProposal[] = [];
  const clean = reply
    .replace(ACTION_DIRECTIVE, (_, tool: string, json: string) => {
      try {
        const args = JSON.parse(json);
        if (typeof args === 'object' && args !== null) {
          proposals.push({ tool: tool as string, args: args as Record<string, unknown> });
        }
      } catch {
        /* malformed directive — dropped, never crashes the pipeline */
      }
      return '';
    })
    .trim();
  return { reply: clean, proposals };
}

/**
 * Deterministic fill fallback: when the model promised an action but
 * emitted no directive (compliance variance), infer a fill_field proposal
 * from the visitor's own message. Conservative guards: the model must not
 * have refused, the message must contain a fill pattern with a value, and
 * EXACTLY ONE page element may match the target word. The visitor still
 * confirms the card before anything executes — inference never bypasses
 * the confirmation UX or the broker's validation.
 */
const FILL_PATTERN = /fill\s+(?:the\s+|my\s+|in\s+)?["']?([\w\s-]{2,30}?)(?:\s+(?:field|input|box))?["']?\s+(?:with|as)\s+["']?([^"',.!?\n]{1,60})["']?/i;
const REFUSAL = /can'?t|cannot|unable|won'?t|not (?:provide|able)|don'?t have/i;

export function inferFillAction(
  message: string,
  reply: string,
  elements: PageElement[],
): ActionProposal | undefined {
  if (REFUSAL.test(reply)) return undefined;
  const m = FILL_PATTERN.exec(message);
  if (!m) return undefined;

  const target = m[1]!.trim().toLowerCase();
  const value = m[2]!.trim();
  if (!target || !value) return undefined;

  const matches = elements.filter((e) => e.label?.toLowerCase().includes(target));
  if (matches.length !== 1) return undefined; // ambiguous — never guess

  const el = matches[0]!;
  if (!el.id && !el.ref) return undefined;
  return { tool: 'fill_field', args: { ref: el.id ?? el.ref, value } };
}

/** The tools section shown to the model — generated from the registry. */
export function toolsPromptSection(): string {
  return [
    'AVAILABLE TOOLS (propose them ONLY when they directly serve the visitor\'s request; each runs only after the visitor confirms it):',
    ...TOOLS.map(
      (t) =>
        `- ${t.name} ${JSON.stringify(Object.keys(t.paramsSchema.shape))} — ${t.description} (${t.permissionLevel})`,
    ),
  ].join('\n');
}

function buildLabel(tool: string, args: Record<string, unknown>, elements: PageElement[]): string {
  const ref = typeof args.ref === 'string' ? args.ref : undefined;
  const el = ref ? elements.find((e) => e.id === ref || e.ref === ref) : undefined;
  const label = el?.label ?? 'this element';
  switch (tool) {
    case 'fill_field':
      return `Fill "${label}" with "${String(args.value).slice(0, 60)}"`;
    case 'select_option':
      return `Select "${label}"`;
    case 'click_element':
      return `Click "${label}"`;
    case 'book_appointment':
      return `Book ${String(args.experience)} for ${String(args.date)} (${Number(args.guests)} guest(s))`;
    default:
      return tool;
  }
}

export function processProposals(input: {
  siteId: string;
  sessionId: string;
  tenantId: string;
  proposals: ActionProposal[];
  contextElements: PageElement[];
}): ProposedAction[] {
  const out: ProposedAction[] = [];
  const siteMap = getSitePageMap(input.siteId);

  for (const proposal of input.proposals) {
    const contract = getTool(proposal.tool);
    if (!contract) continue; // unknown tool — dropped silently, never executes

    const parsed = contract.paramsSchema.safeParse(proposal.args);
    if (!parsed.success) continue; // args outside the contract — dropped

    const args = parsed.data as Record<string, unknown>;

    // Browser tools may only target elements the model actually saw
    if (contract.executor === 'browser') {
      const ref = String(args.ref);
      const known = input.contextElements.some((e) => e.id === ref || e.ref === ref);
      if (!known) continue;
    }
    // API tools need a site page map (their base URL comes from it)
    if (contract.executor === 'api' && !siteMap) continue;

    // Proposal-time decision: is this action confirmable under the site's
    // policy? (The autonomous check determines whether it runs directly
    // or needs the visitor's confirmation card.) The confirmed-policy
    // check re-runs at execution time — defense in depth.
    const policy = getPolicy(input.siteId);
    const level = contract.permissionLevel;
    const confirmable =
      policy.allowedLevels.includes(level) || policy.confirmationLevels.includes(level);
    if (!confirmable) continue; // 100% block — never proposed (e.g. sensitive)

    const autonomous = evaluatePolicy(policy, level); // unconfirmed = autonomous
    const decision = autonomous === 'allowed' ? 'allowed' : 'confirmation_required';

    const action: ProposedAction = {
      action_id: randomUUID(),
      tool: proposal.tool,
      label: buildLabel(proposal.tool, args, input.contextElements),
      permission_level: contract.permissionLevel,
      decision,
      args,
    };
    out.push(action);
    recordProposal({
      action_id: action.action_id,
      session_id: input.sessionId,
      site_id: input.siteId,
      tenant_id: input.tenantId,
      tool: proposal.tool,
      label: action.label,
      permission_level: contract.permissionLevel,
      decision: action.decision,
      args,
    });
  }
  return out;
}
