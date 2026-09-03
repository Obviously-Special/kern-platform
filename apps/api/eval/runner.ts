import 'dotenv/config';
import { buildApp } from '../src/app';
import { syncKnowledge } from '../src/knowledge/sync';
import { stats } from '../src/knowledge/store';
import { scenarios } from './scenarios';
import type { EvalReport, EvalResult, EvalScenario } from './types';

/**
 * M1 eval runner — drives the REAL app (auth, retrieval, prompt, model)
 * via fastify inject and scores every scenario with deterministic checks.
 *
 * Run: npm run eval -w @kern/api
 * Uses the live model (OPENAI_API_KEY or ANTHROPIC_API_KEY). Not part of
 * `npm test` — it costs tokens and takes minutes. CI runs it on demand.
 */
const THRESHOLD = 0.8; // M1 gate: ≥80% of scenarios must pass
const DEMO_KEY = 'kern-demo-site-key-v0';

function evaluate(scenario: EvalScenario, reply: string, citations: string[]): string[] {
  const failures: string[] = [];
  const r = reply.toLowerCase();

  for (const t of scenario.must_contain ?? []) {
    if (!r.includes(t.toLowerCase())) failures.push(`missing required term: "${t}"`);
  }
  if ((scenario.must_contain_any ?? []).length > 0) {
    const any = (scenario.must_contain_any ?? []).some((t) => r.includes(t.toLowerCase()));
    if (!any) failures.push(`missing any-of: ${scenario.must_contain_any!.join(' | ')}`);
  }
  for (const t of scenario.must_not_contain ?? []) {
    if (r.includes(t.toLowerCase())) failures.push(`forbidden term present: "${t}"`);
  }
  if (scenario.expect_citation && citations.length === 0) {
    failures.push('expected citations, none returned');
  }
  return failures;
}

function evaluateGuide(
  scenario: EvalScenario,
  guide: { element_id?: string; element_ref?: string } | undefined,
): string[] {
  if (!scenario.expect_guide) return [];
  const actual = guide?.element_id ?? guide?.element_ref;
  if (actual === scenario.expect_guide) return [];
  return [`expected guide to ${scenario.expect_guide}, got ${actual ?? 'none'}`];
}

function evaluateActions(
  scenario: EvalScenario,
  actions: { tool: string }[] | undefined,
): string[] {
  const failures: string[] = [];
  if (scenario.expect_action_tool) {
    const found = (actions ?? []).some((a) => a.tool === scenario.expect_action_tool);
    if (!found) {
      failures.push(`expected action tool ${scenario.expect_action_tool}, got ${(actions ?? []).map((a) => a.tool).join(', ') || 'none'}`);
    }
  }
  if (scenario.expect_action_tool_any) {
    const found = (actions ?? []).some((a) => scenario.expect_action_tool_any!.includes(a.tool));
    if (!found) {
      failures.push(`expected any action of ${scenario.expect_action_tool_any.join('/')}, got ${(actions ?? []).map((a) => a.tool).join(', ') || 'none'}`);
    }
  }
  if (scenario.expect_no_actions && (actions ?? []).length > 0) {
    failures.push(`expected no actions, got ${actions!.map((a) => a.tool).join(', ')}`);
  }
  return failures;
}

async function main(): Promise<void> {
  const app = await buildApp();

  // Knowledge must be loaded (demo site must be reachable)
  const sync = await syncKnowledge();
  console.log(`knowledge: ${sync.documents} documents, ${sync.chunks} chunks, failed routes: ${sync.failedRoutes.join(', ') || 'none'}`);
  if (stats().chunks === 0) {
    console.error('FATAL: no knowledge loaded — is the demo site running on :3000?');
    process.exit(1);
  }

  const results: EvalResult[] = [];
  for (const scenario of scenarios) {
    // Rate-limit courtesy: rapid sequential calls blow through TPM limits
    // on dev API keys (observed 429s). 1.5s between scenarios keeps runs stable.
    if (results.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    const res = await app.inject({
      method: 'POST',
      url: '/chat',
      headers: { 'x-kern-site-key': DEMO_KEY },
      payload: {
        session_id: `eval-${scenario.id}`,
        site_id: 'demo-bergblick',
        page_context: scenario.page,
        message: scenario.message,
      },
    });

    if (res.statusCode !== 200) {
      results.push({
        scenario,
        statusCode: res.statusCode,
        reply: '',
        citations: [],
        failures: [`HTTP ${res.statusCode}`],
        passed: false,
      });
      continue;
    }

    const body = res.json();
    const reply: string = body.reply ?? '';
    const citations: string[] = body.citations ?? [];
    const failures = [
      ...evaluate(scenario, reply, citations),
      ...evaluateGuide(scenario, body.guide),
      ...evaluateActions(scenario, body.actions),
    ];
    results.push({ scenario, statusCode: 200, reply, citations, failures, passed: failures.length === 0 });
  }

  const passed = results.filter((r) => r.passed).length;
  const report: EvalReport = {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: passed / results.length,
    threshold: THRESHOLD,
    results,
  };

  console.log(`\n=== M1 EVAL REPORT ===`);
  console.log(`passed ${passed}/${results.length} (${(report.passRate * 100).toFixed(1)}%), threshold ${THRESHOLD * 100}%`);

  const byCategory = new Map<string, { total: number; passed: number }>();
  for (const r of results) {
    const c = byCategory.get(r.scenario.category) ?? { total: 0, passed: 0 };
    c.total++;
    if (r.passed) c.passed++;
    byCategory.set(r.scenario.category, c);
  }
  for (const [cat, c] of byCategory) {
    console.log(`  ${cat.padEnd(16)} ${c.passed}/${c.total}`);
  }

  const failures = results.filter((r) => !r.passed);
  if (failures.length > 0) {
    console.log(`\n--- FAILURES ---`);
    for (const f of failures) {
      console.log(`\n✗ ${f.scenario.id} [${f.scenario.category}]`);
      console.log(`  Q: ${f.scenario.message}`);
      console.log(`  A: ${f.reply.slice(0, 300) || '(no reply)'}`);
      console.log(`  failures: ${f.failures.join(' · ')}`);
    }
  }

  await app.close();
  process.exit(report.passRate >= THRESHOLD ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
