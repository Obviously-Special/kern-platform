import type { FastifyReply, FastifyRequest } from 'fastify';
import { getSiteByKey, type SiteRecord } from './tenants/service';

declare module 'fastify' {
  interface FastifyRequest {
    /** Authenticated site, set by the site-key auth hook. */
    kernSite?: SiteRecord;
  }
}

/**
 * Site-key auth (doc 3 §5: "Edge/API gateway: auth, rate limits, tenant
 * routing, request validation"). Every SDK request carries the site's key;
 * the hook resolves it to the site record. Health and /admin are open
 * (dev only — admin auth arrives with the console/RBAC layer).
 */
export async function siteAuthHook(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const url = req.url;
  if (url === '/health' || url.startsWith('/admin')) return;

  const key = req.headers['x-kern-site-key'];
  const record = getSiteByKey(typeof key === 'string' ? key : undefined);
  if (!record) {
    await reply.status(401).send({ error: 'unauthorized', message: 'missing or invalid site key' });
    return;
  }
  req.kernSite = record;
}
