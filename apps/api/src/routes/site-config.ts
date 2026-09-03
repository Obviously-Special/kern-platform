import type { FastifyInstance } from 'fastify';
import { getSitePageMap } from '../knowledge/page-map';

/**
 * Serves the PUBLIC slice of the site's page map to its own SDK
 * (journeys + detection hints). Site-key authenticated; contains no
 * sensitive configuration — business rules and credentials never leave
 * the server.
 */
export async function siteConfigRoutes(app: FastifyInstance): Promise<void> {
  app.get('/site-config', async (req, reply) => {
    const site = req.kernSite;
    if (!site) {
      return reply.status(401).send({ error: 'unauthorized' });
    }
    const map = getSitePageMap(site.site.site_id);
    return {
      site_id: site.site.site_id,
      journeys: map?.journeys ?? [],
    };
  });
}
