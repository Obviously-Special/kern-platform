import type { PermissionLevel } from '@kern/contracts';

/**
 * The action ledger (doc 3 §10: auditable log of proposed actions,
 * confirmations and results). Server-authoritative: the SDK reports
 * outcomes, but only entries THIS ledger knows about can be resolved.
 */
export interface AuditEntry {
  action_id: string;
  session_id: string;
  site_id: string;
  tenant_id: string;
  tool: string;
  label?: string;
  permission_level: PermissionLevel;
  decision: 'allowed' | 'confirmation_required' | 'denied';
  args: Record<string, unknown>;
  proposed_at: string;
  result?: 'succeeded' | 'failed' | 'cancelled';
  error?: string;
  evidence?: string;
  resolved_at?: string;
}

const ledger = new Map<string, AuditEntry>();

export function recordProposal(entry: Omit<AuditEntry, 'proposed_at'>): void {
  ledger.set(entry.action_id, { ...entry, proposed_at: new Date().toISOString() });
}

export function getPending(actionId: string): AuditEntry | undefined {
  const entry = ledger.get(actionId);
  if (!entry || entry.resolved_at) return undefined;
  return entry;
}

export function resolve(
  actionId: string,
  result: 'succeeded' | 'failed' | 'cancelled',
  error?: string,
  evidence?: string,
): AuditEntry | undefined {
  const entry = ledger.get(actionId);
  if (!entry || entry.resolved_at) return undefined;
  entry.result = result;
  entry.error = error;
  entry.evidence = evidence;
  entry.resolved_at = new Date().toISOString();
  return entry;
}

export function listAudit(): AuditEntry[] {
  return [...ledger.values()];
}
