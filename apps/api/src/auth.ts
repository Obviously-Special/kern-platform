import type { FastifyReply, FastifyRequest } from 'fastify';
import { getSiteByKey, type SiteRecord } from './tenants/service';

declare module 'fastify' {
  interface FastifyRequest {
    /** Authenticated site, set by the site-key auth hook. */
    kernSite?: SiteRecord;
  }
}

/**
 * Site-key identification & tenant routing. Every SDK request carries the
 * site's key; the hook resolves it to the site record, and tenant IDs are
 * stamped server-side from that record (never trusted from the client).
 * The browser holds the key, so it is NOT a confidential credential —
 * a production deployment would additionally need origin controls, rate
 * limiting, and stronger session boundaries. Health and /admin are open;
 * /admin is development-only and must not be exposed publicly without
 * authentication and authorization controls.
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
