/**
 * Session memory v1 — short-lived facts the visitor should not have to
 * repeat (doc 2 §5.2: "maintains short-lived session memory").
 *
 * The model may append `<<REMEMBER:fact>>` lines at the end of a reply
 * (like guide directives, always stripped from the visible text). Facts
 * live per session, capped, with a 30-minute TTL — in-memory for now,
 * like the event buffer; persistent storage arrives with the warehouse.
 */
const TTL_MS = 30 * 60 * 1000;
const MAX_FACTS = 10;

interface SessionEntry {
  facts: string[];
  updatedAt: number;
}

const sessions = new Map<string, SessionEntry>();

const REMEMBER_DIRECTIVE = /<<REMEMBER:([^>]+)>>/g;

/** Collects memory directives and strips them from the visible reply. */
export function extractMemories(reply: string): { reply: string; facts: string[] } {
  const facts: string[] = [];
  const clean = reply
    .replace(REMEMBER_DIRECTIVE, (_, fact: string) => {
      const trimmed = fact.trim().slice(0, 200);
      if (trimmed) facts.push(trimmed);
      return '';
    })
    .trim();
  return { reply: clean, facts };
}

export function remember(sessionId: string, facts: string[]): void {
  if (facts.length === 0) return;
  const entry = sessions.get(sessionId) ?? { facts: [], updatedAt: Date.now() };
  for (const fact of facts) {
    if (!entry.facts.includes(fact)) entry.facts.push(fact);
  }
  entry.facts = entry.facts.slice(-MAX_FACTS);
  entry.updatedAt = Date.now();
  sessions.set(sessionId, entry);
}

export function recall(sessionId: string): string[] {
  const entry = sessions.get(sessionId);
  if (!entry) return [];
  if (Date.now() - entry.updatedAt > TTL_MS) {
    sessions.delete(sessionId);
    return [];
  }
  return entry.facts;
}
