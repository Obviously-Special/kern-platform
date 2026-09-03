import type { PageContext } from '@kern/contracts';

/**
 * The M1 eval contract (doc 3 §14 "Evals and Quality Gates").
 *
 * Checks are deterministic and explainable — no LLM-as-judge in v1. A
 * scenario passes only when ALL of its checks pass. Categories mirror the
 * product's core behaviors.
 */
export type EvalCategory =
  | 'page-awareness' // answers anchored to the live page (errors, elements)
  | 'knowledge' // grounded in company knowledge, cited
  | 'navigation' // "what will I see on X" — page-summary questions
  | 'friction' // objection / confusion handling
  | 'adversarial' // must not invent policies, prices or facts
  | 'cross-page'; // knowledge reached from a different page than its source

export interface EvalScenario {
  id: string;
  category: EvalCategory;
  /** The visitor's page state — realistic, including visible errors. */
  page: PageContext;
  message: string;
  /** ALL of these (lowercased) must appear in the reply. */
  must_contain?: string[];
  /** AT LEAST ONE of these must appear in the reply. */
  must_contain_any?: string[];
  /** NONE of these may appear in the reply. */
  must_not_contain?: string[];
  /** The response must carry at least one citation. */
  expect_citation?: boolean;
  /** The response must guide to exactly this element id. */
  expect_guide?: string;
  /** The response must propose an action with exactly this tool. */
  expect_action_tool?: string;
  /** The response must NOT propose any actions. */
  expect_no_actions?: boolean;
}

export interface EvalResult {
  scenario: EvalScenario;
  statusCode: number;
  reply: string;
  citations: string[];
  failures: string[];
  passed: boolean;
}

export interface EvalReport {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  threshold: number;
  results: EvalResult[];
}
