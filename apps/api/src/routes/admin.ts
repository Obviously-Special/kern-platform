import type { FastifyInstance } from 'fastify';
import type { PageContext, PermissionLevel } from '@kern/contracts';
import { syncKnowledge } from '../knowledge/sync';
import { getAllChunks, stats } from '../knowledge/store';
import { checkAction } from '../policy/service';
import { eventCount } from '../event-buffer';

/**
 * v0 admin endpoints — dev aids, clearly temporary.
 * NOTE: no auth yet (arrives with the tenant service in Phase 0). These
 * must never be exposed publicly before then.
 */
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.post('/admin/knowledge/sync', async () => {
    return syncKnowledge();
  });

  app.get('/admin/knowledge/stats', async () => {
    return stats();
  });

  // v0 dev aid — inspect stored chunks (debugging retrieval quality)
  app.get('/admin/knowledge/chunks', async (req) => {
    const { url } = (req.query ?? {}) as { url?: string };
    return getAllChunks()
      .filter((c) => !url || c.url.includes(url))
      .map((c) => ({ heading: c.heading, text: c.text.slice(0, 80), url: c.url, pageTypes: c.pageTypes, source: c.source }));
  });

  // v0 dev aid — run the in-process retriever directly (debugging)
  app.get('/admin/knowledge/test-retrieve', async (req) => {
    const { q, page_type } = (req.query ?? {}) as { q?: string; page_type?: string };
    const { retrieve, tokenize } = await import('../knowledge/retriever');
    const query = q ?? 'pricing';
    const terms = tokenize(query);
    const results = retrieve(
      getAllChunks(),
      query,
      {
        url: 'http://localhost:3000/',
        route: '/',
        page_type: (page_type as PageContext['page_type']) ?? 'home',
        visible_text: { headings: [] },
        elements: [],
        errors: [],
        entities: [],
        state_hash: 'debug',
        timestamp: new Date().toISOString(),
      },
    );
    return { terms, retrieved: results.map((r) => ({ heading: r.chunk.heading, score: r.score, matched: r.matchedTerms })) };
  });

  // v0 dev aid — sanity-check that events are flowing, scoped per tenant
  app.get('/admin/events/count', async (req) => {
    const { tenant_id } = (req.query ?? {}) as { tenant_id?: string };
    return { count: eventCount(tenant_id) };
  });

  // v0 dev aid — exercise the deterministic action policy (doc 3 §10)
  app.get('/admin/policy/check', async (req) => {
    const { site_id, level } = (req.query ?? {}) as { site_id?: string; level?: string };
    const valid = ['read', 'guide', 'reversible', 'transactional', 'sensitive'];
    if (!site_id || !level || !valid.includes(level)) {
      return { error: 'usage: /admin/policy/check?site_id=…&level=read|guide|reversible|transactional|sensitive' };
    }
    return { site_id, level, decision: checkAction(site_id, level as PermissionLevel) };
  });
}
