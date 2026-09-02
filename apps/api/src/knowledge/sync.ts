import { crawlPage } from './crawler';
import { demoSiteMap } from './page-map';
import { replaceAll, stats } from './store';
import type { KnowledgeDoc } from './types';

/**
 * Knowledge sync: crawl the configured routes + merge curated page-map
 * facts into the store. Best-effort — failed routes are reported, not
 * fatal. Runs at boot and on POST /admin/knowledge/sync.
 */
export async function syncKnowledge(): Promise<{
  documents: number;
  chunks: number;
  failedRoutes: string[];
}> {
  const docs: KnowledgeDoc[] = [];
  const failedRoutes: string[] = [];

  for (const route of demoSiteMap.routes) {
    const doc = await crawlPage(demoSiteMap.baseUrl, route);
    if (doc) docs.push(doc);
    else failedRoutes.push(route);
  }

  const now = new Date().toISOString();
  docs.push({
    id: 'page-map',
    url: demoSiteMap.baseUrl,
    pageType: 'other',
    title: 'Curated business facts',
    crawledAt: now,
    chunks: demoSiteMap.facts.map((f, i) => ({
      id: `page-map#${i}`,
      docId: 'page-map',
      url: `${demoSiteMap.baseUrl}/page-map`,
      pageTypes: f.pageTypes,
      heading: f.heading,
      text: f.text,
      source: 'page-map' as const,
    })),
  });

  replaceAll(docs);
  return { ...stats(), failedRoutes };
}
