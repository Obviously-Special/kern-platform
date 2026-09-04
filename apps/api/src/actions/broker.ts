import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PageElement, ProposedAction } from '@kern/contracts';
import { getTool, TOOLS } from './registry';
import { recordProposal } from './audit';
import { evaluatePolicy } from '../policy/engine';
import { getPolicy } from '../policy/service';
import { getSitePageMap, type SitePageMap } from '../knowledge/page-map';

/**
 * The action broker (doc 3 §10): "the LLM proposes; a deterministic
 * policy layer decides." Proposals are validated against tool contracts
 * and the page context, run through the policy engine, and only valid
 * proposals become ProposedActions. REJECTIONS ARE LOGGED — a silent
 * drop is indistinguishable from "the model never proposed".
 */
const ACTION_DIRECTIVE = /<<ACTION:([a-z_]+)\|(\{[^>]*\})>>/g;

export interface ActionProposal {
  tool: string;
  args: Record<string, unknown>;
}

export interface RejectedProposal {
  tool: string;
  reason: string;
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

const REFUSAL = /can'?t|cannot|unable|won'?t|not (?:provide|able)|don'?t have/i;

/**
 * Deterministic fill fallback: when the model promised an action but
 * emitted no proposal (compliance variance), infer fill_field from the
 * visitor's own message. Conservative guards: the model must not have
 * refused, and EXACTLY ONE page element may match. The visitor still
 * confirms the card — inference never bypasses the confirmation UX.
 */
const FILL_PATTERN = /fill\s+(?:the\s+|my\s+|in\s+)?["']?([\w\s-]{2,30}?)(?:\s+(?:field|input|box))?["']?\s+(?:with|as)\s+["']?([^"',.!?\n]{1,60})["']?/i;

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

// ---- deterministic booking fallback ----------------------------------------

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
};

function parseDate(message: string, today: Date): string | undefined {
  // ISO first
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(message);
  if (iso) return iso[0];

  const monthName = Object.keys(MONTHS).join('|');
  const dayOfMonth = /(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(monthName)\s*(?:,?\s*(\d{4}))?/i
    .source.replace('monthName', monthName);
  const monthFirst = /(monthName)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})/i
    .source.replace('monthName', monthName);

  let m = new RegExp(dayOfMonth, 'i').exec(message) ?? new RegExp(monthFirst, 'i').exec(message);
  if (!m) return undefined;

  const hasDayFirst = MONTHS[m[2]?.toLowerCase() ?? ''] !== undefined;
  const day = Number(hasDayFirst ? m[1] : m[2]);
  const month = MONTHS[(hasDayFirst ? m[2] : m[1])!.toLowerCase()]!;
  let year = Number(m[3] ?? today.getFullYear());
  if (!m[3]) {
    // no year given — assume the next occurrence of that day
    const candidate = new Date(year, month - 1, day);
    if (candidate < today) year += 1;
  }
  const d = new Date(year, month - 1, day);
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return undefined; // e.g. 31 Feb
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseGuests(message: string): number | undefined {
  const m = /\b(\d+)\s+(?:people|guests?|persons?|pax)\b/i.exec(message);
  if (m) {
    const n = Number(m[1]);
    return n >= 1 && n <= 8 ? n : undefined;
  }
  const w = /\b(one|two|three|four|five|six|seven|eight)\s+(?:people|guests?|persons?)\b/i.exec(message);
  if (w) return WORD_NUMBERS[w[1]!.toLowerCase()];
  return undefined;
}

function parseName(message: string): string | undefined {
  const m = /(?:my name is|i am|name:)\s+([A-ZÀ-Ž][a-zà-ž-]+(?:\s+[A-ZÀ-Ž][a-zà-ž-]+){1,2})(?:\.|,|\s+and\b|\s*$)/i.exec(message);
  return m?.[1]?.trim();
}

function parseEmail(message: string): string | undefined {
  const m = /[\w.+-]+@[\w-]+\.[\w.]{2,}/.exec(message);
  return m?.[0];
}

/** Canonical match against the site's experience catalog — exactly one alias may match. */
function matchExperience(message: string, siteMap: SitePageMap | undefined): string | undefined {
  if (!siteMap) return undefined;
  const lower = message.toLowerCase();
  const hits = siteMap.experiences.filter((e) =>
    e.aliases.some((a) => lower.includes(a.toLowerCase())),
  );
  return hits.length === 1 ? hits[0]!.name : undefined;
}

function matchInsurance(message: string): string | undefined {
  const lower = message.toLowerCase();
  if (lower.includes('activity protection')) return 'Activity protection';
  if (lower.includes('full cover')) return 'Full cover';
  return undefined;
}

function matchExtras(message: string): string[] {
  const extras: string[] = [];
  if (/equipment rental/i.test(message)) extras.push('Equipment rental');
  return extras;
}

/**
 * Deterministic booking fallback — mirrors inferFillAction. The booking
 * analogue of "the model promised but emitted no proposal": when the
 * visitor's message contains ALL required booking facts at exactly one
 * high-confidence match each, synthesize book_appointment through the
 * same broker/policy/confirmation pipeline. ALL-OR-NOTHING: any missing
 * or ambiguous field returns undefined and the ask-more behavior stands.
 */
export function inferBookingAction(
  message: string,
  reply: string,
  siteMap: SitePageMap | undefined,
): ActionProposal | undefined {
  if (REFUSAL.test(reply)) return undefined;

  const experience = matchExperience(message, siteMap);
  const date = parseDate(message, new Date());
  const guests = parseGuests(message);
  const name = parseName(message);
  const email = parseEmail(message);
  if (!experience || !date || !guests || !name || !email) return undefined;

  const insurance = matchInsurance(message);
  const extras = matchExtras(message);
  return {
    tool: 'book_appointment',
    args: {
      experience,
      date,
      guests,
      name,
      email,
      ...(insurance ? { insurance } : {}),
      ...(extras.length > 0 ? { extras } : {}),
    },
  };
}

// ---- prompt + processing ----------------------------------------------------

/** The tools section shown to the model — generated from the registry. */
export function toolsPromptSection(): string {
  const lines = [
    "AVAILABLE TOOLS — propose them whenever they complete the visitor's request. NOTHING runs until the visitor confirms each proposal card:",
  ];
  for (const t of TOOLS) {
    lines.push(`- ${t.name} — ${t.description} (${t.permissionLevel})`);
    const params = Object.entries(t.paramsSchema.shape)
      .map(([key, schema]) => `${key}: ${(schema as z.ZodTypeAny).description ?? 'any'}${(schema as z.ZodTypeAny).isOptional() ? ' (optional)' : ''}`)
      .join('; ');
    lines.push(`  args — ${params}`);
    if (t.example) lines.push(`  example args: ${JSON.stringify(t.example)}`);
  }
  return lines.join('\n');
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

/**
 * Lenient coercion for typed fields: the strict schema carries args as a
 * JSON string and the model sometimes types numbers as strings
 * (guests: "2") — without coercion the proposal silently dies in zod.
 */
function coerceArgs(contract: ReturnType<typeof getTool>, args: Record<string, unknown>): Record<string, unknown> {
  if (!contract) return args;
  const out = { ...args };
  for (const [key, schema] of Object.entries(contract.paramsSchema.shape)) {
    if (schema instanceof z.ZodNumber && typeof out[key] === 'string' && /^\d+$/.test(out[key])) {
      out[key] = Number(out[key]);
    }
  }
  return out;
}

export function processProposals(input: {
  siteId: string;
  sessionId: string;
  tenantId: string;
  proposals: ActionProposal[];
  contextElements: PageElement[];
}): { actions: ProposedAction[]; rejected: RejectedProposal[] } {
  const actions: ProposedAction[] = [];
  const rejected: RejectedProposal[] = [];
  const siteMap = getSitePageMap(input.siteId);

  const reject = (tool: string, reason: string, args: Record<string, unknown>) => {
    rejected.push({ tool, reason });
    recordProposal({
      action_id: randomUUID(),
      session_id: input.sessionId,
      site_id: input.siteId,
      tenant_id: input.tenantId,
      tool,
      permission_level: getTool(tool)?.permissionLevel ?? 'guide',
      decision: 'denied',
      args,
      reject_reason: reason,
    });
  };

  for (const proposal of input.proposals) {
    const contract = getTool(proposal.tool);
    if (!contract) {
      reject(proposal.tool, 'unknown_tool', proposal.args);
      continue;
    }

    const parsed = contract.paramsSchema.safeParse(coerceArgs(contract, proposal.args));
    if (!parsed.success) {
      reject(proposal.tool, 'invalid_args', proposal.args);
      continue;
    }
    const args = parsed.data as Record<string, unknown>;

    // Browser tools may only target elements the model actually saw
    if (contract.executor === 'browser') {
      const ref = String(args.ref);
      const known = input.contextElements.some((e) => e.id === ref || e.ref === ref);
      if (!known) {
        reject(proposal.tool, 'unknown_ref', args);
        continue;
      }
    }
    // API tools need a site page map (their base URL comes from it)
    if (contract.executor === 'api' && !siteMap) {
      reject(proposal.tool, 'no_page_map', args);
      continue;
    }

    // Proposal-time decision: is this action confirmable under the site's
    // policy? (The autonomous check determines whether it runs directly
    // or needs the visitor's confirmation card.) The confirmed-policy
    // check re-runs at execution time — defense in depth.
    const policy = getPolicy(input.siteId);
    const level = contract.permissionLevel;
    const confirmable =
      policy.allowedLevels.includes(level) || policy.confirmationLevels.includes(level);
    if (!confirmable) {
      reject(proposal.tool, 'policy_denied', args); // 100% block (e.g. sensitive)
      continue;
    }

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
    actions.push(action);
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
  return { actions, rejected };
}
