import { parse } from 'node-html-parser';
import { inferPageType } from '@kern/contracts';
import type { KnowledgeChunk, KnowledgeDoc } from './types';

/**
 * Site content crawler — v1 extracts the structured content that matters:
 * headings, sections, FAQ pairs, table rows. The same crawler becomes a
 * customer-onboarding connector (doc 3: "Knowledge sources: FAQ, policies,
 * docs, catalog, CMS"). Per-site selectors live in the site's page map,
 * never here.
 */

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export async function crawlPage(baseUrl: string, route: string): Promise<KnowledgeDoc | null> {
  const url = new URL(route, baseUrl).toString();
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  } catch {
    return null; // site unreachable — caller reports the failed route
  }
  if (!res.ok) return null;

  const root = parse(await res.text());
  const pageType = inferPageType(route);
  const title = normalize(root.querySelector('title')?.text ?? route);
  const chunks: KnowledgeChunk[] = [];
  const seen = new Set<string>();

  const push = (heading: string, text: string) => {
    const h = normalize(heading);
    const t = normalize(text);
    if (!h || t.length < 30) return;
    const dedupeKey = `${h}|${t}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    chunks.push({
      id: `${route}#${chunks.length}`,
      docId: route,
      url,
      pageTypes: [pageType],
      heading: h,
      text: t.length > 1200 ? t.slice(0, 1200) : t,
      source: 'crawl',
    });
  };

  // h1 + intro paragraph → page summary
  const h1 = normalize(root.querySelector('h1')?.text ?? '');
  const intro = normalize(root.querySelector('main p')?.text ?? '');
  if (h1) push(h1, intro || h1);

  // FAQ pairs (<details>/<summary>)
  root.querySelectorAll('details').forEach((d) => {
    const q = normalize(d.querySelector('summary')?.text ?? '');
    const a = normalize(d.querySelectorAll('p').map((p) => p.text).join(' '));
    push(q, a);
  });

  // Sections: each h2 + its content until the next h2
  root.querySelectorAll('main h2').forEach((h2) => {
    let text = '';
    let el = h2.nextElementSibling;
    while (el && el.tagName.toLowerCase() !== 'h2') {
      text += ' ' + el.text;
      el = el.nextElementSibling;
    }
    push(h2.text, text);
  });

  // Table rows (pricing tables)
  root.querySelectorAll('tbody tr').forEach((tr) => {
    const cells = tr.querySelectorAll('td, th').map((c) => normalize(c.text));
    if (cells.length >= 2) push(`${cells[0]} (table row)`, cells.join(' | '));
  });

  return {
    id: route,
    url,
    pageType,
    title,
    chunks,
    crawledAt: new Date().toISOString(),
  };
}
