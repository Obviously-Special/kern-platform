import type { PermissionLevel, PolicyDecision } from '@kern/contracts';

/**
 * The deterministic action-policy engine (doc 3 §10): the LLM proposes,
 * THIS layer decides. No model output can authorize an action.
 */
export interface SitePolicy {
  siteId: string;
  /** Kill switch (doc 3 §12): off = only read-only assistance; every
   *  autonomous action is denied. */
  autonomousActionsEnabled: boolean;
  /** Levels allowed to execute without confirmation. */
  allowedLevels: PermissionLevel[];
  /** Levels allowed only with explicit user confirmation. */
  confirmationLevels: PermissionLevel[];
}

export const DEFAULT_POLICY: Omit<SitePolicy, 'siteId'> = {
  autonomousActionsEnabled: false,
  allowedLevels: ['reversible'],
  confirmationLevels: ['transactional'],
  // 'sensitive' is never automatic by default (doc 3 §10 L4)
};

export function evaluatePolicy(policy: SitePolicy, level: PermissionLevel): PolicyDecision {
  // Read-only assistance always survives the kill switch
  if (level === 'read' || level === 'guide') return 'allowed';

  if (!policy.autonomousActionsEnabled) return 'denied';
  if (policy.allowedLevels.includes(level)) return 'allowed';
  if (policy.confirmationLevels.includes(level)) return 'confirmation_required';
  return 'denied';
}
