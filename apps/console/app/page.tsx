'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * KERN Console v1 — the morning briefing (doc 2 §8: answer three
 * questions in under 30 seconds): what happened, why it matters, what
 * to do next. Dev-only: talks to the unauthenticated /admin endpoints.
 */

const API = process.env.NEXT_PUBLIC_KERN_API_URL ?? 'http://localhost:8787';

interface MetricCounts {
  sessions: number;
  questions: number;
  actions_succeeded: number;
  bookings: number;
  simulated_sessions: number;
}

interface FrictionCluster {
  cluster_id: string;
  category: string;
  signature: string;
  hypothesis: string;
  volume: number;
  severity: 'low' | 'medium' | 'high';
  affected_paths: string[];
  score: number;
  failure_probability: number;
  journey_value: number;
  evidence_session_ids: string[];
}

interface Conversation {
  session: { session_id: string; last_at: string; question_count: number; had_business_outcome: boolean };
  messages: { role: 'user' | 'assistant'; text: string; simulated?: boolean }[];
}

interface JourneyFunnel {
  journey_id: string;
  steps: { step: number; count: number }[];
}

interface AuditEntry {
  action_id: string;
  tool: string;
  decision: string;
  result?: string;
  reject_reason?: string;
  proposed_at: string;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export default function ConsolePage() {
  const [metrics, setMetrics] = useState<MetricCounts | null>(null);
  const [friction, setFriction] = useState<FrictionCluster[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [funnels, setFunnels] = useState<JourneyFunnel[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, f, c, j, a] = await Promise.all([
        get<MetricCounts>('/admin/metrics'),
        get<FrictionCluster[]>('/admin/friction'),
        get<Conversation[]>('/admin/conversations?limit=6'),
        get<JourneyFunnel[]>('/admin/journeys'),
        get<AuditEntry[]>('/admin/actions'),
      ]);
      setMetrics(m);
      setFriction(f);
      setConversations(c);
      setFunnels(j);
      setAudit(a);
      setError(null);
    } catch (err) {
      setError(`The API is not reachable at ${API} — start it with npm run dev -w @kern/api`);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runSimulation = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${API}/admin/simulator/run`, { method: 'POST' });
      if (!res.ok) throw new Error('simulator failed');
      await load();
    } catch {
      setError('Simulation failed — is the API running?');
    } finally {
      setRunning(false);
    }
  };

  const top = friction[0];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 reveal">
      {/* Header */}
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-mist pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            KERN <span className="text-stone-400">Console</span>
          </h1>
          <p className="mono mt-1 text-xs text-stone-500">demo-bergblick · last 7 days · simulated traffic labelled</p>
        </div>
        <button
          onClick={() => void runSimulation()}
          disabled={running}
          className="rounded-xl bg-signal px-5 py-2.5 text-sm font-semibold text-carbon transition-colors hover:brightness-95 disabled:opacity-50"
        >
          {running ? 'Running simulation…' : 'Run simulation'}
        </button>
      </header>

      {error && (
        <div className="card mt-6 border-critical/40 p-5 text-sm text-critical">{error}</div>
      )}

      {/* What happened */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-stone-600">What happened</h2>
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-mist bg-mist md:grid-cols-5">
          {[
            { label: 'Sessions', value: metrics?.sessions, note: `${metrics?.simulated_sessions ?? 0} simulated` },
            { label: 'Questions', value: metrics?.questions },
            { label: 'Actions succeeded', value: metrics?.actions_succeeded },
            { label: 'Bookings', value: metrics?.bookings },
            { label: 'Friction patterns', value: friction.length },
          ].map((tile) => (
            <div key={tile.label} className="bg-paper p-5">
              <div className="mono text-3xl font-medium tracking-tight">{tile.value ?? '—'}</div>
              <div className="mt-2 text-xs text-stone-600">{tile.label}</div>
              {tile.note && <div className="mt-1 text-[11px] text-stone-400">{tile.note}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* What should I do next */}
      {top && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-stone-600">What should I do next</h2>
          <div className="card mt-3 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-lg font-semibold leading-snug">{top.hypothesis}</h3>
              <span className="mono text-xs text-stone-500">
                score {top.score.toFixed(0)} · {top.evidence_session_ids.length} session{top.evidence_session_ids.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="mt-2 text-sm text-stone-600">
              {top.affected_paths.length > 0 ? `Affects ${top.affected_paths.join(', ')}. ` : ''}
              Recommended fix: review this step and move or clarify the missing information.
            </p>
          </div>
        </section>
      )}

      {/* Why it matters — friction list */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold text-stone-600">Why it matters — friction, ranked</h2>
        <div className="mt-3 space-y-px overflow-hidden rounded-2xl border border-mist bg-mist">
          {friction.length === 0 && (
            <div className="bg-paper p-8 text-sm text-stone-500">
              No friction detected yet. Run the simulation to generate realistic visitor traffic, or ask the
              assistant questions on the demo site.
            </div>
          )}
          {friction.map((f) => (
            <details key={f.cluster_id} className="group bg-paper">
              <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-3 px-6 py-4">
                <span className="flex items-baseline gap-3">
                  <span
                    className={
                      f.severity === 'high' ? 'h-2 w-2 rounded-full bg-critical' : 'h-2 w-2 rounded-full bg-stone-300'
                    }
                    title={`severity: ${f.severity}`}
                  />
                  <span className="text-sm font-medium">{f.signature.slice(0, 90)}</span>
                </span>
                <span className="mono text-xs text-stone-500">
                  {f.volume}× · {f.category.replace('_', ' ')}
                </span>
              </summary>
              <div className="px-6 pb-5 pl-12 text-sm text-stone-600">
                <p>{f.hypothesis}</p>
                <p className="mono mt-3 text-xs text-stone-400">
                  score {f.score.toFixed(0)} · failure probability {(f.failure_probability * 100).toFixed(0)}% · journey
                  value CHF {f.journey_value}
                </p>
                <p className="mono mt-1 text-xs text-stone-400">
                  evidence: {f.evidence_session_ids.join(', ')}
                </p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Conversations + journeys + audit */}
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold text-stone-600">Recent conversations</h2>
          <div className="mt-3 space-y-4">
            {conversations.length === 0 && (
              <div className="card p-8 text-sm text-stone-500">No conversations yet.</div>
            )}
            {conversations.map((c) => (
              <div key={c.session.session_id} className="card p-5">
                <div className="mono flex justify-between text-[11px] text-stone-400">
                  <span>{c.session.session_id.slice(0, 26)}</span>
                  <span>{c.session.had_business_outcome ? 'completed' : 'no outcome'}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {c.messages.map((m, i) => (
                    <div key={i} className={m.role === 'user' ? 'text-sm text-carbon' : 'text-sm text-stone-500'}>
                      <span className="mono mr-2 text-[10px] text-stone-400">{m.role === 'user' ? 'visitor' : 'kern'}</span>
                      {m.text.slice(0, 140)}
                      {m.simulated && <span className="mono ml-2 text-[10px] text-stone-400">sim</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-stone-600">Journey funnels</h2>
            <div className="card mt-3 p-5">
              {funnels.length === 0 && <p className="text-sm text-stone-500">No journey steps recorded yet.</p>}
              {funnels.map((f) => (
                <div key={f.journey_id} className="space-y-2">
                  {f.steps.map((s) => (
                    <div key={s.step} className="flex items-center gap-3">
                      <span className="mono w-16 text-right text-xs text-stone-500">step {s.step}</span>
                      <div className="h-5 flex-1 rounded bg-stone-100">
                        <div
                          className="h-5 rounded bg-carbon/80"
                          style={{ width: `${Math.max(8, (s.count / Math.max(...f.steps.map((x) => x.count))) * 100)}%` }}
                        />
                      </div>
                      <span className="mono text-xs text-stone-500">{s.count}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-stone-600">Action audit</h2>
            <div className="card mt-3 overflow-x-auto p-5">
              {audit.length === 0 && <p className="text-sm text-stone-500">No actions proposed or executed yet.</p>}
              {audit.length > 0 && (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="mono text-stone-400">
                      <th className="pb-2 pr-4 font-normal">tool</th>
                      <th className="pb-2 pr-4 font-normal">decision</th>
                      <th className="pb-2 pr-4 font-normal">result</th>
                      <th className="pb-2 font-normal">reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.slice(0, 12).map((a) => (
                      <tr key={a.action_id} className="border-t border-mist/60">
                        <td className="mono py-2 pr-4">{a.tool}</td>
                        <td className="py-2 pr-4">{a.decision}</td>
                        <td className="py-2 pr-4">{a.result ?? '—'}</td>
                        <td className="py-2 text-stone-500">{a.reject_reason ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
