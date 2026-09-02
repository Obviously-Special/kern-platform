import type { EventEnvelope } from '@kern/contracts';

/**
 * v0: in-memory event buffer, strictly tenant-scoped.
 * The tenant-isolated event warehouse (Phase 3) replaces this — but the
 * schema it stores is already final, so nothing downstream changes.
 */
const buffers = new Map<string, EventEnvelope[]>();
const MAX_EVENTS_PER_TENANT = 10_000;

/** Stored events always carry a server-stamped tenant_id. */
export type StoredEvent = EventEnvelope & { tenant_id: string };

export function storeEvent(event: StoredEvent): void {
  const list = buffers.get(event.tenant_id) ?? [];
  list.push(event);
  if (list.length > MAX_EVENTS_PER_TENANT) {
    list.splice(0, list.length - MAX_EVENTS_PER_TENANT);
  }
  buffers.set(event.tenant_id, list);
}

export function eventCount(tenantId?: string): number {
  if (tenantId) return buffers.get(tenantId)?.length ?? 0;
  let total = 0;
  for (const list of buffers.values()) total += list.length;
  return total;
}
