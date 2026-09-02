import type { EventEnvelope } from '@kern/contracts';

/**
 * v0: in-memory event buffer.
 * The tenant-isolated event warehouse (Phase 3) replaces this — but the
 * schema it stores is already final, so nothing downstream changes.
 */
const buffer: EventEnvelope[] = [];
const MAX_EVENTS = 10_000;

export function storeEvent(event: EventEnvelope): void {
  buffer.push(event);
  if (buffer.length > MAX_EVENTS) {
    buffer.splice(0, buffer.length - MAX_EVENTS);
  }
}

export function eventCount(): number {
  return buffer.length;
}
