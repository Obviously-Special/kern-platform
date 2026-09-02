import type { PageContext } from '@kern/contracts';
import type { KnowledgeChunk } from './types';

/**
 * Deterministic lexical retriever (doc 3: "Hybrid retrieval + structured
 * source registry" — lexical is the deterministic first half; embeddings
 * join as the second half when content volume justifies it).
 *
 * Scoring is transparent and explainable: term hits + heading bonus +
 * same-page bonus + route bonus. Every score has a mechanical meaning —
 * this matters for the "explainable calculations" principle.
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
  return text
    .toLowerCase()
    .replace(/[^a-z0-9äöüéèà\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export interface RetrievedChunk {
  chunk: KnowledgeChunk;
  score: number;
  matchedTerms: string[];
}

export function retrieve(
  chunks: KnowledgeChunk[],
  question: string,
  pageContext: PageContext,
  limit = 4,
  maxTotalChars = 3000,
): RetrievedChunk[] {
  const qTerms = tokenize(question);

  const scored: RetrievedChunk[] = chunks.map((chunk) => {
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
    if (chunk.pageTypes.includes(pageContext.page_type)) score += 3; // same page as the visitor
    if (pageContext.route && pageContext.route !== '/' && chunk.url.includes(pageContext.route)) score += 1;
    return { chunk, score, matchedTerms: matched };
  });

  const withHits = scored.filter((r) => r.score > 0);
  if (withHits.length === 0) {
    // No term matched — fall back to knowledge bound to the visitor's page
    return chunks
      .filter((c) => c.pageTypes.includes(pageContext.page_type))
      .slice(0, limit)
      .map((chunk) => ({ chunk, score: 0, matchedTerms: [] }));
  }

  withHits.sort((a, b) => b.score - a.score);
  const out: RetrievedChunk[] = [];
  let totalChars = 0;
  for (const r of withHits) {
    if (out.length >= limit) break;
    if (totalChars + r.chunk.text.length > maxTotalChars) continue;
    out.push(r);
    totalChars += r.chunk.text.length;
  }
  return out;
}
