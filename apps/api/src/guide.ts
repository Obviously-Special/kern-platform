import type { GuideTarget, PageElement } from '@kern/contracts';

/**
 * Guide directive parsing (guide mode v1, provider-agnostic).
 *
 * The model may end its reply with a final line `<<GUIDE:element-id>>` to
 * point the visitor at a specific page element. The directive is stripped
 * from the visible reply, and the target is validated against the page
 * context the model was shown — the API never guides to an element it
 * didn't send. Upgrade path: provider structured outputs.
 */
const GUIDE_DIRECTIVE = /<<GUIDE:([^>]+)>>/;

/**
 * Deterministic fallback when the model forgot the directive: if the
 * reply mentions EXACTLY ONE element label from the page context, guide
 * to it. Multiple matches = ambiguous — never guess (doc 2: "prefer one
 * targeted question over inventing context").
 */
export function inferGuideFromReply(reply: string, elements: PageElement[]): GuideTarget | undefined {
  const lower = reply.toLowerCase();
  const candidates = elements.filter(
    (e) => e.label && lower.includes(e.label.toLowerCase()),
  );
  if (candidates.length !== 1) return undefined;
  const el = candidates[0]!;
  // The browser must be able to resolve the target — an element with
  // neither id nor ref would fail schema validation downstream.
  if (!el.id && !el.ref) return undefined;
  return { element_id: el.id, element_ref: el.ref, label: el.label };
}

export function parseGuideDirective(
  reply: string,
  contextElements: PageElement[],
): { reply: string; guide?: GuideTarget } {
  const match = GUIDE_DIRECTIVE.exec(reply);
  if (!match) return { reply };

  // The directive is internal syntax — always stripped from the visible
  // reply, whether or not the target is valid.
  const cleanReply = reply.replace(match[0], '').trim();
  const target = match[1]!.trim();
  // Resolve by element id first, then by the SDK's kern-el-N reference —
  // sites without ids stay fully guidable.
  const element =
    contextElements.find((e) => e.id === target) ??
    contextElements.find((e) => e.ref === target);
  if (!element) return { reply: cleanReply }; // unknown target — drop the guide only

  return {
    reply: cleanReply,
    guide: {
      element_id: element.id,
      element_ref: element.ref,
      label: element.label,
    },
  };
}
