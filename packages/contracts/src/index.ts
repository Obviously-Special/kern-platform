/**
 * @kern/contracts — the shared event-first schema.
 *
 * One language across SDK → API → analytics (doc 3 §16: "common event
 * taxonomy plus configurable dimensions"). Extend carefully; renaming an
 * event type is a data migration, not a refactor.
 */
export * from './ids.js';
export * from './platform.js';
export * from './page-context.js';
export * from './intent.js';
export * from './action.js';
export * from './outcome.js';
export * from './friction.js';
export * from './events.js';
export * from './chat.js';
