/**
 * @kern/contracts — the shared event-first schema.
 *
 * One language across SDK → API → analytics (doc 3 §16: "common event
 * taxonomy plus configurable dimensions"). Extend carefully; renaming an
 * event type is a data migration, not a refactor.
 */
export * from './ids';
export * from './platform';
export * from './page-context';
export * from './page-classifier';
export * from './intent';
export * from './action';
export * from './outcome';
export * from './friction';
export * from './events';
export * from './chat';
