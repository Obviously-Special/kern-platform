import type { PageContext } from '@kern/contracts';
import type { KnowledgeChunk } from './types';

/**
 * Deterministic lexical retriever (doc 3: "Hybrid retrieval + structured
 * source registry" — lexical is the deterministic first half; embeddings
 * join as the second half when content volume justifies it).
 *
 * Scoring is term-first and explainable:
 * - a chunk enters contention ONLY if at least one question term matches it
 * - term hits score 1, heading hits score +2
 * - the page-type/route bonus is a tiebreaker (max +2) — page proximity
 *   must never beat an actual term match
 * - doc expansion: when a chunk from a page is selected, up to 2 sibling
 *   chunks from the same page join it, so page-summary questions
 *   ("what will I see on the pricing page") receive the page's content
 */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'do', 'does',
  'did', 'can', 'could', 'would', 'should', 'i', 'you', 'we', 'they', 'it',
  'this', 'that', 'these', 'those', 'my', 'your', 'our', 'their', 'what',
  'how', 'where', 'when', 'why', 'which', 'who', 'about', 'for', 'from',
  'with', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'there', 'here', 'if',
  'have', 'has', 'had', 'not', 'no', 'yes', 'me', 'us', 'them', 'get',
]);

export function tokenize(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9äöüéèà\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  // Light stemming: also match the singular of longer plural forms
  // ("weekends" must find a chunk about "weekend" surcharges)
  const expanded: string[] = [];
  for (const t of tokens) {
    expanded.push(t);
    if (t.length > 4 && t.endsWith('s')) expanded.push(t.slice(0, -1));
  }
  return [...new Set(expanded)];
}

export interface RetrievedChunk {
  chunk: KnowledgeChunk;
  score: number;
  matchedTerms: string[];
}

/** Empty pageTypes = site-wide knowledge (matches every page). */
function matchesPage(chunk: KnowledgeChunk, pageType: PageContext['page_type']): boolean {
  return chunk.pageTypes.length === 0 || chunk.pageTypes.includes(pageType);
}

function pageBonus(chunk: KnowledgeChunk, pageContext: PageContext): number {
  let bonus = 0;
  if (matchesPage(chunk, pageContext.page_type)) bonus += 1;
  if (pageContext.route && pageContext.route !== '/' && chunk.url.includes(pageContext.route)) bonus += 1;
  return bonus;
}

export function retrieve(
  chunks: KnowledgeChunk[],
  question: string,
  pageContext: PageContext,
  limit = 5,
  maxTotalChars = 3500,
): RetrievedChunk[] {
  const qTerms = tokenize(question);

  const scored = chunks.map((chunk) => {
    const text = `${chunk.heading} ${chunk.text}`.toLowerCase();
    const matched: string[] = [];
    let score = 0;
    for (const term of qTerms) {
      if (text.includes(term)) {
        matched.push(term);
        score += 1;
        if (chunk.heading.toLowerCase().includes(term)) score += 2; // heading hits weigh more
      }
    }
    return { chunk, score, matchedTerms: matched };
  });

  const withHits = scored.filter((r) => r.matchedTerms.length > 0);
  if (withHits.length === 0) {
    // No term matched anywhere — fall back to knowledge bound to the
    // visitor's page, then site-wide knowledge
    const bound = chunks.filter((c) => matchesPage(c, pageContext.page_type));
    const siteWide = chunks.filter((c) => c.pageTypes.length === 0 && !matchesPage(c, pageContext.page_type));
    return [...bound, ...siteWide]
      .slice(0, limit)
      .map((chunk) => ({ chunk, score: 0, matchedTerms: [] }));
  }

  withHits.sort(
    (a, b) => b.score - a.score || pageBonus(b.chunk, pageContext) - pageBonus(a.chunk, pageContext),
  );

  // At most 2 primary chunks per doc, then expand each with up to 2
  // siblings from the same page so the whole page context travels together.
  const selected: RetrievedChunk[] = [];
  const perDoc = new Map<string, number>();
  for (const r of withHits) {
    if (selected.length >= limit) break;
    if ((perDoc.get(r.chunk.docId) ?? 0) >= 2) continue;
    selected.push(r);
    perDoc.set(r.chunk.docId, (perDoc.get(r.chunk.docId) ?? 0) + 1);
  }

  const selectedIds = new Set(selected.map((r) => r.chunk.id));
  for (const r of [...selected]) {
    if (selected.length >= limit) break;
    const siblings = chunks.filter((c) => c.docId === r.chunk.docId && !selectedIds.has(c.id));
    for (const sibling of siblings.slice(0, 2)) {
      if (selected.length >= limit) break;
      selected.push({ chunk: sibling, score: 0, matchedTerms: [] });
      selectedIds.add(sibling.id);
    }
  }

  // Char budget — keep the prompt lean
  const out: RetrievedChunk[] = [];
  let totalChars = 0;
  for (const r of selected) {
    if (totalChars + r.chunk.text.length > maxTotalChars) continue;
    out.push(r);
    totalChars += r.chunk.text.length;
  }
  return out;
}
