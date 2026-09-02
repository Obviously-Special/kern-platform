import type { FastifyInstance } from 'fastify';
import { syncKnowledge } from '../knowledge/sync';
import { stats } from '../knowledge/store';

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
}
