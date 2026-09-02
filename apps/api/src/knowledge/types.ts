import type { PageType } from '@kern/contracts';

/**
 * Knowledge layer v1 (doc 3 §5: "tenant-scoped corpus + provenance").
 * Every chunk carries its source URL and origin so answers stay grounded
 * and citable.
 */
export interface KnowledgeChunk {
  id: string;
  docId: string;
  /** Source URL, or 'page-map' marker for curated business facts. */
  url: string;
  /** Page types this chunk applies to (empty = site-wide). */
  pageTypes: PageType[];
  heading: string;
  text: string;
  source: 'crawl' | 'page-map';
}

export interface KnowledgeDoc {
  id: string;
  url: string;
  pageType: PageType;
  title: string;
  chunks: KnowledgeChunk[];
  crawledAt: string;
}
