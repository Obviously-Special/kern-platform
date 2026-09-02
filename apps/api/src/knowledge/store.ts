import type { KnowledgeChunk, KnowledgeDoc } from './types';

/**
 * v0: in-memory tenant-scoped knowledge store, single site.
 * The tenant-scoped knowledge service (ingestion, freshness, versioning —
 * doc 3 §5) replaces this in the productized phase; the chunk schema
 * already matches its contract so nothing downstream changes.
 */
let docs: KnowledgeDoc[] = [];
let lastSyncAt: string | null = null;

export function replaceAll(newDocs: KnowledgeDoc[]): void {
  docs = newDocs;
  lastSyncAt = new Date().toISOString();
}

export function getAllChunks(): KnowledgeChunk[] {
  return docs.flatMap((d) => d.chunks);
}

export function stats(): { documents: number; chunks: number; lastSyncAt: string | null } {
  return {
    documents: docs.length,
    chunks: docs.reduce((n, d) => n + d.chunks.length, 0),
    lastSyncAt,
  };
}
