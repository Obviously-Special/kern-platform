/**
 * Identifier aliases used across the platform.
 *
 * Deliberately plain strings at v1: uniqueness and format are enforced by
 * zod schemas at the boundaries. Branded types can be introduced later if
 * ID confusion becomes a real bug source.
 */
export type TenantId = string;
export type SiteId = string;
export type SessionId = string;
export type EventId = string;
export type MessageId = string;
export type IntentId = string;
export type ActionId = string;
export type TaskId = string;
export type ClusterId = string;
export type SignalId = string;
