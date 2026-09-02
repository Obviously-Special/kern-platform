import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSite, createTenant, listSites } from '../tenants/service';

/**
 * v0 admin endpoints for the tenant model (doc 3 Phase 0 exit:
 * "can create a tenant/site").
 * NOTE: no admin auth yet — localhost dev only, like the other /admin routes.
 */
const CreateTenantBody = z.object({
  name: z.string().min(1),
  plan: z.string().optional(),
  region: z.string().optional(),
});

const CreateSiteBody = z.object({
  tenant_id: z.string().min(1),
  domain: z.string().min(1),
  environment: z.enum(['production', 'staging']).optional(),
});

export async function tenantRoutes(app: FastifyInstance): Promise<void> {
  app.post('/admin/tenants', async (req, reply) => {
    const parsed = CreateTenantBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    return createTenant(parsed.data);
  });

  app.post('/admin/sites', async (req, reply) => {
    const parsed = CreateSiteBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    try {
      const record = createSite(parsed.data.tenant_id, parsed.data);
      return { site: record.site, site_key: record.siteKey };
    } catch (err) {
      return reply.status(404).send({ error: (err as Error).message });
    }
  });

  app.get('/admin/sites', async () => {
    return listSites();
  });
}
