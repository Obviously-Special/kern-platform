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

export function parseGuideDirective(
  reply: string,
  contextElements: PageElement[],
): { reply: string; guide?: GuideTarget } {
  const match = GUIDE_DIRECTIVE.exec(reply);
  if (!match) return { reply };

  // The directive is internal syntax — always stripped from the visible
  // reply, whether or not the target is valid.
  const cleanReply = reply.replace(match[0], '').trim();
  const elementId = match[1]!.trim();
  const element = contextElements.find((e) => e.id === elementId);
  if (!element) return { reply: cleanReply }; // unknown target — drop the guide only

  return {
    reply: cleanReply,
    guide: { element_id: elementId, label: element.label },
  };
}
